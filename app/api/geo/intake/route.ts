import { NextResponse } from 'next/server';
import { fetchErieCountyEvidence } from '../../../../lib/real-estate/erie-county-evidence.js';
import { fetchGlobalBuildingReference, geocodeGeoAddress } from '../../../../lib/real-estate/global-building-reference.js';
import { buildGeoPropertyReadiness, buildGlobalReferenceRequest, normalizeGeoPropertyIntake } from '../../../../lib/real-estate/geo-property-onboarding.js';
import { factCheckProperty, PROPERTY_FACT_SOURCE_KINDS } from '../../../../lib/real-estate/property-fact-check.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function globalFacts(reference: any) {
  if (!reference?.found) return [];
  const facts: any[] = [
    {
      field: 'building_footprint',
      label: 'Global building footprint',
      value: reference.geometry,
      sourceKind: PROPERTY_FACT_SOURCE_KINDS.GLOBAL_MAP,
      authority: reference.source?.authority,
      recordId: reference.source?.recordId,
      observedAt: reference.source?.observedAt,
      sourceUrl: reference.source?.sourceUrl,
      note: 'Reference building geometry only; not a cadastral parcel boundary.',
    },
  ];
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
    if (intake.hasCoordinates) {
      try {
        globalReference = await fetchGlobalBuildingReference({ latitude: intake.latitude, longitude: intake.longitude });
      } catch (error) {
        globalReferenceError = error instanceof Error ? error.message : 'Global building reference lookup failed.';
      }
    }

    let authoritativeEvidence = null;
    let authoritativeError = '';
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

    const factCheck = factCheckProperty({
      propertyId: authoritativeEvidence?.twin?.propertyId || intake.parcelId || intake.pin || intake.sbl || intake.address || 'GEO:REFERENCE',
      facts: [...globalFacts(globalReference), ...erieFacts(authoritativeEvidence)],
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
      authoritativeEvidence,
      authoritativeError,
      factCheck,
      readiness,
      globalDataPlan: {
        ...globalRequest,
        overtureRelease: '2026-07-22.0',
        overtureBuildingsPmtiles: 'https://overturemaps-extras-us-west-2.s3.us-west-2.amazonaws.com/tiles/2026-07-22.0/buildings.pmtiles',
        note: 'GEO fetches/cache-bounds around a requested property instead of storing the entire planet in the web app. Overture is a global reference layer; jurisdiction sources remain the parcel authority where available.',
      },
      legalEffects: {
        createsOwnership: false,
        createsSecurity: false,
        verifiesTitle: false,
        transfersFunds: false,
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
