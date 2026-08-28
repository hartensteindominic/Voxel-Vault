import { geocodeGeoAddress } from './real-estate/global-building-reference.js';
import { fetchGlobalNeighborhoodReference } from './real-estate/global-neighborhood-reference.js';
import {
  fetchOvertureBuildingNeighborhood,
  OVERTURE_BUILDINGS_PMTILES_URL,
  OVERTURE_BUILDINGS_RELEASE,
} from './overture-building-tiles.js';
import { worldStewardshipRegionId } from './world-stewardship.js';

const clean = (value) => String(value ?? '').trim();
const finite = (value) => value !== null && value !== undefined && clean(value) !== '' && Number.isFinite(Number(value));

export const WORLD_ATLAS_DATA_RELEASE = OVERTURE_BUILDINGS_RELEASE;
export const WORLD_ATLAS_OVERTURE_BUILDINGS_PM_TILES = OVERTURE_BUILDINGS_PMTILES_URL;
export const WORLD_ATLAS_MESH_POLICY = Object.freeze({
  provider: 'Meshy 7',
  aiModel: 'meshy-7',
  generationMode: 'multi-image-preferred',
  targetPolycount: 30_000,
  textureResolution: '2k',
  enablePbr: true,
  minLicensedReferenceImages: 2,
  maxLicensedReferenceImages: 4,
  automaticGeneration: false,
  reason: 'World coverage stays lightweight. Meshy 7 is reserved for explicitly selected hero properties with user-owned, open-licensed, or explicitly derivative-licensed visual references.',
});

function coordinate(value, min, max, label) {
  if (!finite(value)) throw new Error(`${label} is required.`);
  const number = Number(value);
  if (number < min || number > max) throw new Error(`${label} is outside its valid range.`);
  return number;
}

function radiusMeters(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 160;
  return Math.max(80, Math.min(240, number));
}

function normalizeSource(building, fallbackSource = {}) {
  const authority = clean(fallbackSource.authority) || 'Overture Maps Foundation';
  const overture = /overture/i.test(authority);
  const buildingId = clean(building?.overtureId || building?.id);
  return {
    authority,
    recordId: buildingId || clean(fallbackSource.recordId),
    observedAt: fallbackSource.observedAt || new Date().toISOString(),
    sourceUrl: building?.sourceUrl || fallbackSource.sourceUrl || (overture ? 'https://explore.overturemaps.org/' : 'https://www.openstreetmap.org/'),
    attributionUrl: fallbackSource.attributionUrl || (overture ? 'https://docs.overturemaps.org/attribution/' : 'https://www.openstreetmap.org/copyright'),
    license: fallbackSource.license || 'ODbL',
    release: fallbackSource.release || (overture ? WORLD_ATLAS_DATA_RELEASE : null),
    note: fallbackSource.note || null,
  };
}

function normalizeAtlasBuilding(building, fallbackSource = {}) {
  const latitude = Number(building?.center?.latitude);
  const longitude = Number(building?.center?.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !building?.geometry) return null;
  const source = normalizeSource(building, fallbackSource);
  const sourceKey = /overture/i.test(source.authority) ? 'overture' : source.license.toLowerCase();
  const atlasId = `${sourceKey}:${source.recordId || `${latitude.toFixed(6)}:${longitude.toFixed(6)}`}`;
  return {
    atlasId,
    latitude,
    longitude,
    regionId: worldStewardshipRegionId(latitude, longitude),
    selected: building?.selected === true,
    distanceMeters: Number.isFinite(Number(building?.distanceMeters)) ? Number(building.distanceMeters) : null,
    geometry: building.geometry,
    tags: {
      building: clean(building?.tags?.building),
      name: clean(building?.tags?.name),
      height: clean(building?.tags?.height),
      levels: clean(building?.tags?.levels),
      houseNumber: clean(building?.tags?.houseNumber),
      street: clean(building?.tags?.street),
    },
    height: building?.height || null,
    source,
    mesh: {
      ...WORLD_ATLAS_MESH_POLICY,
      eligible: false,
      blocker: 'Attach 2–4 visual references with explicit derivative-generation rights before Meshy 7 can run.',
    },
    rights: {
      mapReferenceOnly: true,
      createsPhysicalPropertyOwnership: false,
      createsTitle: false,
      createsRentRights: false,
      createsExclusiveMapDataOwnership: false,
    },
  };
}

async function readPrimaryAtlasReference(input, options) {
  try {
    const reference = await fetchOvertureBuildingNeighborhood(input, options);
    return { reference, sourceStatus: { primary: 'overture-pmtiles', fallbackUsed: false, fallback: null } };
  } catch (error) {
    return {
      reference: null,
      sourceStatus: {
        primary: 'overture-pmtiles',
        fallbackUsed: false,
        fallback: null,
        primaryError: clean(error?.message || error || 'Overture lookup failed.').slice(0, 220),
      },
    };
  }
}

async function readFallbackAtlasReference(input, options, sourceStatus) {
  try {
    const fallback = await fetchGlobalNeighborhoodReference(input, options);
    return {
      reference: fallback,
      sourceStatus: {
        ...sourceStatus,
        fallbackUsed: true,
        fallback: 'openstreetmap-overpass',
      },
    };
  } catch (error) {
    return {
      reference: null,
      sourceStatus: {
        ...sourceStatus,
        fallbackUsed: true,
        fallback: 'openstreetmap-overpass',
        fallbackError: clean(error?.message || error || 'Fallback lookup failed.').slice(0, 220),
      },
    };
  }
}

export async function inspectWorldAtlas(input = {}, options = {}) {
  const address = clean(input.address).slice(0, 180);
  let geocode = null;
  let latitude = finite(input.latitude) ? coordinate(input.latitude, -90, 90, 'Latitude') : null;
  let longitude = finite(input.longitude) ? coordinate(input.longitude, -180, 180, 'Longitude') : null;

  if ((latitude === null || longitude === null) && address) {
    geocode = await geocodeGeoAddress(address, options);
    latitude = coordinate(geocode.latitude, -90, 90, 'Latitude');
    longitude = coordinate(geocode.longitude, -180, 180, 'Longitude');
  }
  if (latitude === null || longitude === null) throw new Error('Latitude/longitude or an address is required.');

  const radius = radiusMeters(input.radiusMeters);
  const lookupInput = { address, latitude, longitude, radiusMeters: radius };
  let { reference, sourceStatus } = await readPrimaryAtlasReference(lookupInput, options);
  if (!reference?.found || !Array.isArray(reference?.neighborhoodBuildings) || !reference.neighborhoodBuildings.length) {
    const fallbackResult = await readFallbackAtlasReference(lookupInput, options, sourceStatus);
    if (fallbackResult.reference?.found || fallbackResult.reference?.neighborhoodBuildings?.length) {
      reference = fallbackResult.reference;
      sourceStatus = fallbackResult.sourceStatus;
    } else {
      sourceStatus = fallbackResult.sourceStatus;
    }
  }

  if (!reference && sourceStatus?.primaryError && sourceStatus?.fallbackError) {
    throw new Error('World building data is temporarily unavailable. No replacement building was invented.');
  }

  const buildings = (Array.isArray(reference?.neighborhoodBuildings) ? reference.neighborhoodBuildings : [])
    .map((building) => normalizeAtlasBuilding(building, reference?.source || {}))
    .filter(Boolean)
    .slice(0, 36);
  const selectedBuilding = buildings.find((building) => building.selected) || buildings[0] || null;

  return {
    ok: true,
    latitude,
    longitude,
    address: address || geocode?.displayName || null,
    geocode,
    radiusMeters: radius,
    regionId: worldStewardshipRegionId(latitude, longitude),
    buildingCount: buildings.length,
    buildings,
    selectedBuilding,
    sourceStatus,
    reference: {
      found: Boolean(selectedBuilding),
      latitude,
      longitude,
      radiusMeters: radius,
      geometry: selectedBuilding?.geometry || null,
      tags: selectedBuilding?.tags || {},
      height: selectedBuilding?.height || null,
      neighborhoodBuildings: buildings.map((building) => ({
        id: building.atlasId,
        selected: building.atlasId === selectedBuilding?.atlasId,
        distanceMeters: building.distanceMeters,
        center: { latitude: building.latitude, longitude: building.longitude },
        geometry: building.geometry,
        tags: building.tags,
        height: building.height,
        sourceUrl: building.source?.sourceUrl || '',
      })),
      publicRealm: reference?.publicRealm || null,
      terrain: reference?.terrain || null,
      matchStrategy: reference?.matchStrategy || 'world_atlas_point_lookup',
      source: reference?.source || selectedBuilding?.source || null,
      note: reference?.note || 'Worldwide source-backed map reference. Not a cadastral parcel survey.',
    },
    coverage: {
      interactivePointLookup: 'Overture Maps Foundation buildings PMTiles with OpenStreetMap / Overpass fallback',
      productionBulkSource: 'Overture Maps Foundation buildings PMTiles / GeoParquet',
      overtureRelease: WORLD_ATLAS_DATA_RELEASE,
      overtureBuildingsPmtiles: WORLD_ATLAS_OVERTURE_BUILDINGS_PM_TILES,
      loadingStrategy: 'progressive-region-streaming',
      note: 'Voxel Vault does not download the whole planet into the browser. The globe streams small regions around what the user explores, using Overture first and an OSM fallback only when needed.',
    },
    meshPolicy: WORLD_ATLAS_MESH_POLICY,
    rights: {
      platformOwns: 'Voxel Vault software, UI, original derived metadata, caches and generated assets subject to source/provider licenses.',
      platformDoesNotOwn: 'The physical Earth, deeds, Google Earth imagery, OSM/Overture source data, or municipal GIS merely because those sources are displayed.',
      digitalStewardshipOnly: true,
    },
  };
}
