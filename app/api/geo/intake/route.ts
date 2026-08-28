import { NextResponse } from 'next/server';
import { fetchErieCountyEvidence } from '../../../../lib/real-estate/erie-county-evidence.js';
import { geocodeGeoAddress } from '../../../../lib/real-estate/global-building-reference.js';
import { fetchGlobalNeighborhoodReference } from '../../../../lib/real-estate/global-neighborhood-reference.js';
import { fetchUsgsTerrainReference } from '../../../../lib/real-estate/usgs-terrain-reference.js';
import { fetchNysErieLidarCoverage } from '../../../../lib/real-estate/nys-lidar-evidence.js';
import { evaluateMeasuredBuildingHeight } from '../../../../lib/real-estate/measured-building-height.js';
import { buildGeoPropertyReadiness, buildGlobalReferenceRequest, normalizeGeoPropertyIntake } from '../../../../lib/real-estate/geo-property-onboarding.js';
import { factCheckProperty, PROPERTY_FACT_SOURCE_KINDS } from '../../../../lib/real-estate/property-fact-check.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function globalFacts(reference: any) {
  if (!reference?.found && !reference?.publicRealm?.found) return [];
  const facts: any[] = [];
  if (reference?.found) {
    facts.push(
      {
        field: 'building_footprint',
        label: 'Global building footprint',
        value: reference.geometry,
        sourceKind: PROPERTY_FACT_SOURCE_KINDS.GLOBAL_MAP,
        authority: reference.source?.authority,
        recordId: reference.source?.recordId,
        observedAt: reference.source?.observedAt,
        sourceUrl: reference.source?.sourceUrl,
        note: reference.matchStrategy === 'exact_source_address_match'
          ? 'Reference building geometry with source-reported address tags matching the requested address; not a cadastral parcel boundary.'
          : 'Nearest source building reference only; not proven to be the exact address and not a cadastral parcel boundary.',
      },
      {
        field: 'nearby_building_count',
        label: 'Nearby source building count',
        value: reference.neighborhoodBuildingCount ?? 0,
        sourceKind: PROPERTY_FACT_SOURCE_KINDS.GLOBAL_MAP,
        authority: reference.source?.authority,
        recordId: `neighborhood:${reference.source?.recordId || 'reference'}`,
        observedAt: reference.source?.observedAt,
        sourceUrl: reference.source?.sourceUrl,
        note: 'Count of nearby source-backed global map building footprints returned for the 3D reference scene.',
      },
    );
  }
  if (reference?.publicRealm?.found) facts.push({
    field: 'mapped_public_realm_way_count',
    label: 'Mapped streets and paths',
    value: reference.publicRealm.mappedWayCount ?? 0,
    sourceKind: PROPERTY_FACT_SOURCE_KINDS.GLOBAL_MAP,
    authority: reference.publicRealm.source?.authority || reference.source?.authority,
    recordId: `public-realm:${reference.source?.recordId || 'reference'}`,
    observedAt: reference.publicRealm.source?.observedAt || reference.source?.observedAt,
    sourceUrl: reference.source?.sourceUrl,
    note: 'Source-backed map centerlines for neighborhood orientation. Rendered stroke thickness is visual styling only and is not a measured road, lane, right-of-way, or sidewalk width.',
  });
  if (reference.tags?.building) facts.push({
    field: 'building_type', label: 'Building type', value: reference.tags.building,
    sourceKind: PROPERTY_FACT_SOURCE_KINDS.GLOBAL_MAP, authority: reference.source?.authority,
    recordId: reference.source?.recordId, observedAt: reference.source?.observedAt, sourceUrl: reference.source?.sourceUrl,
  });
  if (reference.tags?.levels) facts.push({
    field: 'building_levels', label: 'Building levels', value: reference.tags.levels,
    sourceKind: PROPERTY_FACT_SOURCE_KINDS.GLOBAL_MAP, authority: reference.source?.authority,
    recordId: reference.source?.recordId, observedAt: reference.source?.observedAt, sourceUrl: reference.source?.sourceUrl,
  });
  if (reference.tags?.height) facts.push({
    field: 'building_height_reported', label: 'Source-reported height', value: reference.tags.height,
    sourceKind: PROPERTY_FACT_SOURCE_KINDS.GLOBAL_MAP, authority: reference.source?.authority,
    recordId: reference.source?.recordId, observedAt: reference.source?.observedAt, sourceUrl: reference.source?.sourceUrl,
  });
  return facts;
}

function terrainFacts(terrain: any) {
  if (!terrain?.available) return [];
  return [
    {
      field: 'ground_elevation_reference',
      label: 'Ground elevation reference',
      value: terrain.referenceElevationMeters,
      sourceKind: PROPERTY_FACT_SOURCE_KINDS.JURISDICTION_GIS,
      authority: terrain.source?.authority,
      recordId: `EPQS:${terrain.latitude},${terrain.longitude}`,
      observedAt: terrain.source?.observedAt,
      sourceUrl: terrain.source?.sourceUrl,
      note: 'USGS 3DEP interpolated elevation reference. Not a surveyed control elevation and not a building roof height.',
    },
    {
      field: 'terrain_relief_reference',
      label: 'Local terrain relief reference',
      value: terrain.reliefMeters,
      sourceKind: PROPERTY_FACT_SOURCE_KINDS.JURISDICTION_GIS,
      authority: terrain.source?.authority,
      recordId: `EPQS-GRID:${terrain.latitude},${terrain.longitude}`,
      observedAt: terrain.source?.observedAt,
      sourceUrl: terrain.source?.sourceUrl,
      note: 'Difference between minimum and maximum sampled ground elevations in the local 3×3 reference grid.',
    },
  ];
}

function lidarFacts(lidarCoverage: any, measuredHeight: any) {
  if (!lidarCoverage) return [];
  const facts: any[] = [
    {
      field: 'lidar_coverage',
      label: 'NYS LiDAR coverage',
      value: lidarCoverage.coverageStatus,
      sourceKind: PROPERTY_FACT_SOURCE_KINDS.JURISDICTION_GIS,
      authority: lidarCoverage.source?.authority,
      recordId: lidarCoverage.tiles?.[0]?.filename || lidarCoverage.collection,
      observedAt: lidarCoverage.source?.observedAt,
      sourceUrl: lidarCoverage.source?.sourceUrl,
      note: 'Coverage proves an official LiDAR tile exists for the area. It does not by itself measure this building.',
    },
  ];
  if (measuredHeight?.verifiedMeasuredHeight) facts.push({
    field: 'building_height_measured',
    label: 'Measured building height',
    value: measuredHeight.heightMeters,
    sourceKind: PROPERTY_FACT_SOURCE_KINDS.JURISDICTION_GIS,
    authority: measuredHeight.sourceAuthority,
    recordId: measuredHeight.sourceRecordId,
    observedAt: measuredHeight.observedAt,
    sourceUrl: lidarCoverage.source?.sourceUrl,
    note: `Roof-minus-ground LiDAR measurement; documented uncertainty ${measuredHeight.uncertaintyMeters} m.`,
  });
  return facts;
}

function erieFacts(evidence: any) {
  if (!evidence?.twin) return [];
  const record = evidence.countyRecord || {};
  const source = evidence.twin.location?.source || {};
  const facts: any[] = [
    {
      field: 'parcel_id', label: 'Erie County parcel ID / PIN', value: record.pin || evidence.twin.identity?.parcelId,
      sourceKind: PROPERTY_FACT_SOURCE_KINDS.JURISDICTION_GIS, authority: source.authority,
      recordId: source.recordId, observedAt: source.observedAt, sourceUrl: source.sourceUrl,
    },
    {
      field: 'parcel_boundary', label: 'Erie County parcel boundary', value: evidence.twin.location?.parcelGeometry,
      sourceKind: PROPERTY_FACT_SOURCE_KINDS.JURISDICTION_GIS, authority: source.authority,
      recordId: source.recordId, observedAt: source.observedAt, sourceUrl: source.sourceUrl,
    },
  ];
  if (record.totalAssessedValueUsd !== null && record.totalAssessedValueUsd !== undefined) facts.push({
    field: 'assessed_value', label: 'County assessed value', value: record.totalAssessedValueUsd,
    sourceKind: PROPERTY_FACT_SOURCE_KINDS.JURISDICTION_GIS, authority: source.authority,
    recordId: source.recordId, observedAt: source.observedAt, sourceUrl: source.sourceUrl,
    note: 'Assessment reference; not market value.',
  });
  if (record.yearBuilt) facts.push({
    field: 'year_built', label: 'Year built reference', value: record.yearBuilt,
    sourceKind: PROPERTY_FACT_SOURCE_KINDS.JURISDICTION_GIS, authority: source.authority,
    recordId: source.recordId, observedAt: source.observedAt, sourceUrl: source.sourceUrl,
  });
  return facts;
}

function addressAnchor(value: unknown) {
  const normalized = String(value ?? '').toUpperCase().replace(/[^A-Z0-9 -]/g, ' ').replace(/\s+/g, ' ').trim();
  const match = normalized.match(/^(\d+[A-Z-]*)\s+([A-Z0-9]+)/);
  return match ? { number: match[1], street: match[2] } : null;
}

function locationDistanceMeters(aLat: unknown, aLon: unknown, bLat: unknown, bLon: unknown) {
  const values = [aLat, aLon, bLat, bLon].map(Number);
  if (!values.every(Number.isFinite)) return null;
  const [lat1, lon1, lat2, lon2] = values;
  const toRad = (degrees: number) => degrees * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function parcelMatchesSubmittedLocation(intake: any, evidence: any) {
  const submittedAddress = addressAnchor(intake?.address);
  const countyAddress = addressAnchor(evidence?.countyRecord?.parcelAddress);
  if (submittedAddress && countyAddress && (submittedAddress.number !== countyAddress.number || submittedAddress.street !== countyAddress.street)) {
    return { matches: false, reason: 'submitted address anchor does not match the county parcel address' };
  }
  const distance = locationDistanceMeters(intake?.latitude, intake?.longitude, evidence?.twin?.location?.latitude, evidence?.twin?.location?.longitude);
  if (distance !== null && distance > 250) {
    return { matches: false, reason: `submitted/geocoded point is ${Math.round(distance)} m from the county parcel reference point` };
  }
  return { matches: true, reason: '' };
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    let intake = normalizeGeoPropertyIntake(body || {});
    let geocode = null;

    if (!intake.hasCoordinates && intake.address) {
      geocode = await geocodeGeoAddress(intake.address);
      intake = normalizeGeoPropertyIntake({ ...intake, latitude: geocode.latitude, longitude: geocode.longitude });
    }

    let globalReference = null;
    let globalReferenceError = '';
    let terrain = null;
    let terrainError = '';

    if (intake.hasCoordinates) {
      const [neighborhoodResult, terrainResult] = await Promise.allSettled([
        fetchGlobalNeighborhoodReference({ address: intake.address, latitude: intake.latitude, longitude: intake.longitude, radiusMeters: 130 }),
        fetchUsgsTerrainReference({ latitude: intake.latitude, longitude: intake.longitude, countryCode: intake.countryCode, radiusMeters: 90 }),
      ]);
      if (neighborhoodResult.status === 'fulfilled') globalReference = neighborhoodResult.value;
      else globalReferenceError = neighborhoodResult.reason instanceof Error ? neighborhoodResult.reason.message : 'Global neighborhood lookup failed.';
      if (terrainResult.status === 'fulfilled') terrain = terrainResult.value;
      else terrainError = terrainResult.reason instanceof Error ? terrainResult.reason.message : 'Terrain reference lookup failed.';
    }

    let authoritativeEvidence = null;
    let authoritativeError = '';
    let lidarCoverage = null;
    let lidarError = '';
    const isErie = intake.countryCode === 'US' && intake.subdivisionCode === 'NY' && intake.countyCode === 'ERIE';

    if (isErie && (intake.pin || intake.sbl)) {
      try {
        const candidate = await fetchErieCountyEvidence(intake.pin ? { pin: intake.pin } : { sbl: intake.sbl });
        const locationCheck = parcelMatchesSubmittedLocation(intake, candidate);
        if (!locationCheck.matches) authoritativeError = `Parcel identifier conflict: ${locationCheck.reason}. GEO did not attach the county parcel evidence.`;
        else authoritativeEvidence = candidate;
      } catch (error) {
        authoritativeError = error instanceof Error ? error.message : 'Erie County parcel verification failed.';
      }
    }

    if (isErie && intake.hasCoordinates) {
      try {
        lidarCoverage = await fetchNysErieLidarCoverage({ latitude: intake.latitude, longitude: intake.longitude });
      } catch (error) {
        lidarError = error instanceof Error ? error.message : 'NYS LiDAR coverage lookup failed.';
      }
    }

    const measuredHeight = evaluateMeasuredBuildingHeight({
      acceptedBuildingGeometry: authoritativeEvidence?.twin?.structure?.buildingGeometry || null,
      lidarCoverage,
      measurement: null,
    });

    if (globalReference) globalReference = { ...globalReference, terrain, measuredHeight, lidarCoverage };

    const factCheck = factCheckProperty({
      propertyId: authoritativeEvidence?.twin?.propertyId || intake.parcelId || intake.pin || intake.sbl || intake.address || 'GEO:REFERENCE',
      facts: [
        ...globalFacts(globalReference),
        ...terrainFacts(terrain),
        ...erieFacts(authoritativeEvidence),
        ...lidarFacts(lidarCoverage, measuredHeight),
      ],
    });
    const globalRequest = buildGlobalReferenceRequest(intake);
    const readiness = buildGeoPropertyReadiness({
      intake,
      twin: authoritativeEvidence?.twin || null,
      globalReference,
      investment: { goalEnabled: true, providerHandoffReady: false },
    });

    return NextResponse.json({
      ok: true,
      intake,
      geocode,
      globalReference,
      globalReferenceError,
      terrain,
      terrainError,
      lidarCoverage,
      lidarError,
      measuredHeight,
      authoritativeEvidence,
      authoritativeError,
      factCheck,
      readiness,
      globalDataPlan: {
        ...globalRequest,
        overtureRelease: '2026-07-22.0',
        overtureBuildingsPmtiles: 'https://overturemaps-extras-us-west-2.s3.us-west-2.amazonaws.com/tiles/2026-07-22.0/buildings.pmtiles',
        terrainAdapter: intake.countryCode === 'US' ? 'USGS 3DEP EPQS 3×3 ground-elevation reference grid with visualization-only interpolation between returned samples' : 'no authoritative terrain adapter attached for this country yet',
        neighborhoodAdapter: 'OpenStreetMap / Overpass nearby building footprints plus mapped street/path centerlines, with exact source-address preference and nearest-building fallback',
        measuredHeightPolicy: 'Measured building height requires accepted parcel-specific building geometry plus actual roof/ground LiDAR processing. Coverage or ground elevation alone cannot satisfy the gate.',
        note: 'GEO fetches/cache-bounds around a requested property instead of storing the entire planet in the web app. Overture/OSM are global reference layers; jurisdiction sources remain the parcel authority where available. Public-realm stroke thickness and interpolated terrain mesh density are rendering choices, not additional measurements.',
      },
      legalEffects: {
        createsOwnership: false,
        createsSecurity: false,
        verifiesTitle: false,
        transfersFunds: false,
        terrainCreatesPropertyRights: false,
        neighborhoodGeometryCreatesParcelRights: false,
        publicRealmCreatesParcelRights: false,
      },
    }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'GEO intake failed.',
      legalEffects: { createsOwnership: false, createsSecurity: false, verifiesTitle: false, transfersFunds: false },
    }, { status: 400, headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  }
}