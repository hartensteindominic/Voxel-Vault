export const BUFFALO_CURRENT_PARCEL_LAYER = 'https://services8.arcgis.com/BMPgiPHUrkqJdtki/ArcGIS/rest/services/Parcels_20262027/FeatureServer/0';

const SAFE_FIELDS = [
  'OBJECTID',
  'SBL',
  'Print_Key',
  'Front',
  'Depth',
  'House_Number',
  'Street',
  'Address',
  'Zipcode',
  'Year_Built',
  'First_Story_Area',
  'Second_Story_Area',
  'Total_Living_Area',
  'Building_Style_Code',
  'Building_Style_Description',
  'Number_of_Units',
  'F__of_Stories',
  'Exterior_Wall_Code',
  'Exterior_Wall_Description',
  'Overall_Condition',
  'Overall_Condition_Description',
  'Story_Height',
  'Latitude',
  'Longitude',
  'LandUse',
];

function clean(value) {
  return String(value ?? '').trim();
}

function numberOrNull(value) {
  if (value === null || value === undefined || clean(value) === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function safeParcelKey(value, label) {
  const normalized = clean(value).toUpperCase();
  if (!normalized) return '';
  if (normalized.length > 40 || !/^[A-Z0-9.-]+$/.test(normalized)) {
    throw Object.assign(new Error(`${label} may contain only letters, numbers, periods and hyphens.`), { code: 'INVALID_BUFFALO_PARCEL_KEY' });
  }
  return normalized;
}

export function normalizeBuffaloReferenceLookup(input = {}) {
  const printKey = safeParcelKey(input.printKey || input.sbl, 'Buffalo print key');
  const rawSbl = safeParcelKey(input.rawSbl, 'Buffalo raw SBL');
  const pin = safeParcelKey(input.pin, 'Erie PIN');
  const pinDerivedRawSbl = pin.startsWith('140200') && pin.length > 6 ? pin.slice(6) : '';
  const resolvedRawSbl = rawSbl || pinDerivedRawSbl;
  if (!printKey && !resolvedRawSbl) {
    throw Object.assign(new Error('A Buffalo print key / county SBL or Erie PIN is required.'), { code: 'INVALID_BUFFALO_PARCEL_KEY' });
  }
  return { printKey, rawSbl: resolvedRawSbl };
}

function queryUrl(field, value) {
  const url = new URL(`${BUFFALO_CURRENT_PARCEL_LAYER}/query`);
  url.searchParams.set('f', 'json');
  url.searchParams.set('where', `${field}='${value}'`);
  url.searchParams.set('outFields', SAFE_FIELDS.join(','));
  url.searchParams.set('returnGeometry', 'false');
  url.searchParams.set('resultRecordCount', '2');
  return url.toString();
}

async function fetchJson(url, fetchImpl) {
  let response;
  try {
    response = await fetchImpl(url, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    });
  } catch (error) {
    throw Object.assign(new Error(`Buffalo parcel reference request failed: ${error instanceof Error ? error.message : 'network error'}`), { code: 'BUFFALO_REFERENCE_UNAVAILABLE' });
  }
  if (!response?.ok) {
    throw Object.assign(new Error(`Buffalo parcel reference returned HTTP ${response?.status || 'error'}.`), { code: 'BUFFALO_REFERENCE_UNAVAILABLE' });
  }
  const data = await response.json().catch(() => null);
  if (!data || typeof data !== 'object' || data.error) {
    throw Object.assign(new Error(`Buffalo parcel reference returned an unreadable response${data?.error?.message ? `: ${data.error.message}` : ''}.`), { code: 'BUFFALO_REFERENCE_UNAVAILABLE' });
  }
  return data;
}

function featuresFrom(data) {
  return Array.isArray(data?.features) ? data.features : [];
}

function visualMaterialClass(description) {
  const value = clean(description).toLowerCase();
  if (!value) return 'unknown';
  if (value.includes('brick')) return 'brick';
  if (value.includes('vinyl') || value.includes('aluminum') || value.includes('siding') || value.includes('composite')) return 'siding';
  if (value.includes('stucco')) return 'stucco';
  if (value.includes('wood')) return 'wood';
  if (value.includes('stone')) return 'stone';
  return 'other';
}

function deriveVisualHeightMeters(stories, storyHeightFt) {
  const storyCount = numberOrNull(stories);
  if (!(storyCount > 0)) return { meters: null, method: 'none' };
  const perStoryFeet = numberOrNull(storyHeightFt);
  if (perStoryFeet >= 6 && perStoryFeet <= 20) {
    return { meters: storyCount * perStoryFeet * 0.3048, method: 'city_story_count_x_story_height_reference' };
  }
  return { meters: storyCount * 3.05, method: 'city_story_count_x_visual_default_3_05m' };
}

function buildReference(feature, observedAt, query, matchField) {
  const attributes = feature?.attributes || {};
  const stories = numberOrNull(attributes.F__of_Stories);
  const storyHeightFt = numberOrNull(attributes.Story_Height);
  const visualHeight = deriveVisualHeightMeters(stories, storyHeightFt);
  const exteriorWallDescription = clean(attributes.Exterior_Wall_Description);
  return {
    found: true,
    printKey: clean(attributes.Print_Key),
    rawSbl: clean(attributes.SBL),
    address: clean(attributes.Address) || [clean(attributes.House_Number), clean(attributes.Street)].filter(Boolean).join(' '),
    zip: clean(attributes.Zipcode),
    frontageFt: numberOrNull(attributes.Front),
    depthFt: numberOrNull(attributes.Depth),
    yearBuilt: numberOrNull(attributes.Year_Built),
    firstStoryAreaSqFt: numberOrNull(attributes.First_Story_Area),
    secondStoryAreaSqFt: numberOrNull(attributes.Second_Story_Area),
    totalLivingAreaSqFt: numberOrNull(attributes.Total_Living_Area),
    buildingStyleCode: clean(attributes.Building_Style_Code),
    buildingStyleDescription: clean(attributes.Building_Style_Description),
    numberOfUnits: numberOrNull(attributes.Number_of_Units),
    stories,
    exteriorWallCode: clean(attributes.Exterior_Wall_Code),
    exteriorWallDescription,
    overallCondition: clean(attributes.Overall_Condition),
    overallConditionDescription: clean(attributes.Overall_Condition_Description),
    storyHeightFt,
    latitude: numberOrNull(attributes.Latitude),
    longitude: numberOrNull(attributes.Longitude),
    landUse: clean(attributes.LandUse),
    visualHeightReferenceMeters: visualHeight.meters,
    visualHeightMethod: visualHeight.method,
    visualMaterialClass: visualMaterialClass(exteriorWallDescription),
    source: {
      authority: 'City of Buffalo Open Data — Parcels 2026–2027',
      recordId: clean(attributes.OBJECTID) ? `parcel:${clean(attributes.OBJECTID)}` : clean(attributes.Print_Key) || clean(attributes.SBL),
      observedAt,
      sourceUrl: BUFFALO_CURRENT_PARCEL_LAYER,
      matchField,
      query,
    },
    legalEffects: {
      isSurvey: false,
      measuresRoofHeight: false,
      verifiesFacadeArrangement: false,
      verifiesCurrentExteriorColor: false,
      establishesOwnership: false,
      establishesTitle: false,
    },
    sourceLimitations: [
      'Buffalo assessment characteristics are reference attributes for rendering calibration, not a current-condition architectural survey.',
      'Story count and Story Height may calibrate visual massing but do not become a measured roof height.',
      'Exterior wall description may select a broad rendering material class; exact color, window placement, doors, porch geometry and roof form remain unverified unless another licensed/open visual source establishes them.',
      'Owner and mailing fields are intentionally not requested or returned.',
    ],
  };
}

export async function fetchBuffaloPropertyReference(input = {}, options = {}) {
  const lookup = normalizeBuffaloReferenceLookup(input);
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') {
    throw Object.assign(new Error('No fetch implementation is available for the Buffalo parcel reference.'), { code: 'BUFFALO_REFERENCE_UNAVAILABLE' });
  }
  const observedAt = options.observedAt || new Date().toISOString();
  const attempts = [
    lookup.printKey ? { field: 'Print_Key', value: lookup.printKey } : null,
    lookup.rawSbl ? { field: 'SBL', value: lookup.rawSbl } : null,
  ].filter(Boolean);

  for (const attempt of attempts) {
    const query = queryUrl(attempt.field, attempt.value);
    const data = await fetchJson(query, fetchImpl);
    const features = featuresFrom(data);
    if (features.length > 1) {
      throw Object.assign(new Error(`Buffalo parcel reference returned ${features.length} matches for ${attempt.field}; exact identity is ambiguous.`), { code: 'AMBIGUOUS_BUFFALO_REFERENCE' });
    }
    if (features.length === 1) return buildReference(features[0], observedAt, query, attempt.field);
  }

  return {
    found: false,
    printKey: lookup.printKey,
    rawSbl: lookup.rawSbl,
    source: {
      authority: 'City of Buffalo Open Data — Parcels 2026–2027',
      observedAt,
      sourceUrl: BUFFALO_CURRENT_PARCEL_LAYER,
    },
    legalEffects: {
      isSurvey: false,
      measuresRoofHeight: false,
      verifiesFacadeArrangement: false,
      verifiesCurrentExteriorColor: false,
      establishesOwnership: false,
      establishesTitle: false,
    },
    sourceLimitations: ['No exact Buffalo assessment record matched the supplied controlled parcel keys.'],
  };
}
