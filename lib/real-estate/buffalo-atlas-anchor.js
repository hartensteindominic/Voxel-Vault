import { fetchBuffaloPropertyReference } from './buffalo-property-reference.js';
import {
  ERIE_COUNTY_MAPPING_DISCLAIMER,
  fetchErieCountySpatialIntake,
  geometryReferencePoint,
} from './erie-county-gis.js';
import { inspectWorldAtlas } from '../world-atlas.js';

const clean = (value) => String(value ?? '').trim();
const finite = (value) => Number.isFinite(Number(value));

function haversineMeters(lat1, lon1, lat2, lon2) {
  const values = [lat1, lon1, lat2, lon2].map(Number);
  if (!values.every(Number.isFinite)) return null;
  const [aLat, aLon, bLat, bLon] = values;
  const toRad = (degrees) => degrees * Math.PI / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function cityHeight(reference) {
  const meters = Number(reference?.visualHeightReferenceMeters);
  if (!(meters > 0)) return null;
  return {
    referenceHeightMeters: Number(meters.toFixed(3)),
    heightStatus: 'derived_from_levels',
    heightSource: 'City of Buffalo assessment story count / story-height reference used for display calibration only',
    measuredHeightAccepted: false,
  };
}

function buildCountyBuilding(evidence, city) {
  const geometry = evidence?.twin?.structure?.buildingGeometry || null;
  if (!geometry) return null;
  const point = geometryReferencePoint(geometry);
  const latitude = finite(point?.latitude) ? Number(point.latitude) : Number(evidence?.twin?.location?.latitude);
  const longitude = finite(point?.longitude) ? Number(point.longitude) : Number(evidence?.twin?.location?.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const record = evidence?.countyRecord || {};
  const source = evidence?.twin?.structure?.source || {};
  const parcelId = clean(record.pin || evidence?.twin?.identity?.parcelId || record.sbl || city?.printKey);
  return {
    atlasId: `erie-building:${parcelId || `${latitude.toFixed(6)}:${longitude.toFixed(6)}`}`,
    latitude,
    longitude,
    regionId: null,
    selected: true,
    distanceMeters: 0,
    geometry,
    tags: {
      building: clean(record.propertyType || record.propertyDescription || city?.landUse || 'building'),
      name: clean(city?.address || record.parcelAddress || evidence?.twin?.label || 'Parcel-linked building'),
      levels: city?.stories ? String(city.stories) : '',
      houseNumber: clean(city?.address).split(/\s+/)[0] || '',
      street: clean(city?.address).replace(/^\S+\s+/, ''),
      material: clean(city?.exteriorWallDescription),
      style: clean(city?.buildingStyleDescription),
    },
    height: cityHeight(city),
    source: {
      authority: source.authority || 'Erie County Office of GIS — BUILDING layer',
      recordId: source.recordId || parcelId,
      observedAt: source.observedAt || evidence?.provenance?.observedAt || new Date().toISOString(),
      sourceUrl: source.sourceUrl || evidence?.provenance?.buildingLayer || '',
      attributionUrl: ERIE_COUNTY_MAPPING_DISCLAIMER,
      license: 'Jurisdiction GIS reference — see source terms',
      release: null,
      note: 'Parcel-linked county BUILDING geometry. Not a legal survey and not a current facade scan.',
    },
    mesh: {
      provider: 'Meshy 7',
      eligible: false,
      blocker: '2–4 rights-cleared visual references are required before AI reconstruction.',
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

function authoritativeReference(building, atlas, evidence) {
  const neighbors = [building, ...(Array.isArray(atlas?.buildings) ? atlas.buildings : []).filter((item) => item?.atlasId !== building.atlasId)].slice(0, 36);
  return {
    ...(atlas?.reference || {}),
    found: true,
    latitude: building.latitude,
    longitude: building.longitude,
    geometry: building.geometry,
    tags: building.tags,
    height: building.height,
    matchStrategy: 'erie_county_parcel_linked_building',
    source: building.source,
    neighborhoodBuildings: neighbors.map((item) => ({
      id: item.atlasId,
      selected: item.atlasId === building.atlasId,
      distanceMeters: item.distanceMeters,
      center: { latitude: item.latitude, longitude: item.longitude },
      geometry: item.geometry,
      tags: item.tags || {},
      height: item.height || null,
      sourceUrl: item.source?.sourceUrl || '',
    })),
    note: 'Selected geometry comes from the parcel-linked Erie County BUILDING layer; surrounding context may come from Overture/OSM. Neither establishes title or legal survey boundaries.',
    parcelGeometry: evidence?.twin?.location?.parcelGeometry || null,
  };
}

export async function resolveBuffaloAtlasAnchor(input = {}, options = {}) {
  const sbl = clean(input.sbl || input.printKey);
  const pin = clean(input.pin);
  if (!sbl && !pin) throw new Error('Buffalo atlas anchor requires an SBL or Erie PIN.');

  const [cityResult, countyResult] = await Promise.allSettled([
    fetchBuffaloPropertyReference({ sbl, pin }, options),
    fetchErieCountySpatialIntake(sbl ? { sbl } : { pin }, options),
  ]);

  const city = cityResult.status === 'fulfilled' ? cityResult.value : null;
  const evidence = countyResult.status === 'fulfilled' ? countyResult.value : null;
  if (!city?.found && !evidence?.twin) {
    const messages = [cityResult, countyResult].filter((result) => result.status === 'rejected').map((result) => clean(result.reason?.message || result.reason));
    throw new Error(messages.join(' · ') || 'No authoritative Buffalo/Erie property anchor was returned.');
  }

  const countyLat = Number(evidence?.twin?.location?.latitude);
  const countyLng = Number(evidence?.twin?.location?.longitude);
  const cityLat = Number(city?.latitude);
  const cityLng = Number(city?.longitude);
  const latitude = Number.isFinite(countyLat) ? countyLat : cityLat;
  const longitude = Number.isFinite(countyLng) ? countyLng : cityLng;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) throw new Error('Authoritative parcel sources did not return usable coordinates.');

  const sourceSeparationMeters = Number.isFinite(cityLat) && Number.isFinite(cityLng) && Number.isFinite(countyLat) && Number.isFinite(countyLng)
    ? haversineMeters(cityLat, cityLng, countyLat, countyLng)
    : null;
  if (sourceSeparationMeters !== null && sourceSeparationMeters > 250) {
    throw new Error(`City and county property anchors conflict by ${Math.round(sourceSeparationMeters)} m; no building was selected.`);
  }

  let atlas = null;
  let atlasError = '';
  try {
    atlas = await inspectWorldAtlas({ latitude, longitude, radiusMeters: input.radiusMeters || 180 });
  } catch (error) {
    atlasError = clean(error?.message || error || 'World context lookup failed.');
    atlas = {
      ok: true,
      latitude,
      longitude,
      radiusMeters: Number(input.radiusMeters || 180),
      buildings: [],
      buildingCount: 0,
      selectedBuilding: null,
      reference: { found: false, latitude, longitude, neighborhoodBuildings: [] },
      sourceStatus: { primary: 'overture-pmtiles', fallbackUsed: true, fallback: 'openstreetmap-overpass', unavailable: true },
      rights: { digitalStewardshipOnly: true },
    };
  }

  const localBuilding = buildCountyBuilding(evidence, city);
  if (localBuilding) {
    const buildings = [localBuilding, ...(Array.isArray(atlas?.buildings) ? atlas.buildings : []).filter((item) => item?.atlasId !== localBuilding.atlasId)].slice(0, 36);
    atlas = {
      ...atlas,
      latitude,
      longitude,
      buildings,
      buildingCount: buildings.length,
      selectedBuilding: localBuilding,
      reference: authoritativeReference(localBuilding, { ...atlas, buildings }, evidence),
      sourceStatus: {
        ...(atlas?.sourceStatus || {}),
        authoritativeLocal: true,
        authoritativeLocalSource: 'erie-county-building',
      },
    };
  }

  return {
    ok: true,
    anchor: {
      latitude,
      longitude,
      sourceSeparationMeters: sourceSeparationMeters === null ? null : Number(sourceSeparationMeters.toFixed(2)),
      authority: evidence?.twin?.location?.source?.authority || city?.source?.authority || 'Buffalo / Erie jurisdiction source',
      label: city?.address || evidence?.countyRecord?.parcelAddress || input.address || 'Buffalo property',
      sbl: city?.printKey || evidence?.countyRecord?.sbl || sbl,
      pin: evidence?.countyRecord?.pin || pin,
    },
    cityReference: city,
    authoritativeEvidence: evidence,
    atlas,
    atlasError,
    localBuildingStatus: localBuilding ? 'parcel_linked_building' : evidence?.twin?.location?.parcelGeometry ? 'parcel_only' : 'location_only',
    legalEffects: {
      createsOwnership: false,
      createsTitle: false,
      createsSecurity: false,
      createsGovernmentTax: false,
      createsExclusiveMapDataOwnership: false,
    },
  };
}
