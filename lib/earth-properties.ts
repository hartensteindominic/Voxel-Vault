const BRIDGE_BASE_URL = 'https://api.bridgedataoutput.com/api/v2/OData';
const MAX_RESULTS = 20;

export type EarthPropertyCategory =
  | 'house'
  | 'condo'
  | 'mobile-home'
  | 'multifamily'
  | 'storefront'
  | 'commercial'
  | 'warehouse'
  | 'barn-farm'
  | 'land'
  | 'other';

export type EarthProperty = {
  id: string;
  provider: string;
  providerDataset: string;
  listingId: string;
  address: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  category: EarthPropertyCategory;
  propertyType: string;
  propertySubType: string;
  transactionType: 'sale' | 'rent';
  listPriceCents: number | null;
  rentCentsMonthly: number | null;
  marketValueCents: number | null;
  marketValueLabel: string;
  beds: number | null;
  baths: number | null;
  livingAreaSqft: number | null;
  lotAreaSqft: number | null;
  stories: number | null;
  status: string;
  imageUrl: string | null;
  sourceUrl: string | null;
  virtualTourUrl: string | null;
  modifiedAt: string | null;
  sourceDisclosure: string;
};

function finiteNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function centsFromDollars(value: unknown): number | null {
  const dollars = finiteNumber(value);
  if (dollars === null || dollars < 0) return null;
  return Math.round(dollars * 100);
}

function safeText(value: unknown, max = 240) {
  return String(value ?? '').trim().slice(0, max);
}

function categoryFrom(typeRaw: unknown, subTypeRaw: unknown): EarthPropertyCategory {
  const value = `${safeText(typeRaw)} ${safeText(subTypeRaw)}`.toLowerCase();
  if (/manufactured|mobile|trailer/.test(value)) return 'mobile-home';
  if (/condo|condominium/.test(value)) return 'condo';
  if (/multi.?family|duplex|triplex|quadruplex|apartment building/.test(value)) return 'multifamily';
  if (/warehouse|industrial/.test(value)) return 'warehouse';
  if (/retail|storefront|shopping|restaurant/.test(value)) return 'storefront';
  if (/farm|ranch|agricultural|agriculture|barn/.test(value)) return 'barn-farm';
  if (/land|vacant|lot/.test(value)) return 'land';
  if (/commercial|office|business/.test(value)) return 'commercial';
  if (/residential|single.?family|house|townhouse|townhome/.test(value)) return 'house';
  return 'other';
}

function firstMediaUrl(row: any): string | null {
  const media = Array.isArray(row?.Media) ? row.Media : [];
  const candidate = media.find((item: any) => item?.MediaURL || item?.MediaURLLarge || item?.MediaURLThumb);
  const value = candidate?.MediaURL || candidate?.MediaURLLarge || candidate?.MediaURLThumb || row?.PhotoURL || row?.ImageURL;
  if (!value) return null;
  try {
    const url = new URL(String(value));
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

function safeSourceUrl(value: unknown): string | null {
  if (!value) return null;
  try {
    const url = new URL(String(value));
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

function normalizeBridgeProperty(row: any, dataset: string): EarthProperty {
  const type = safeText(row?.PropertyType, 120);
  const subType = safeText(row?.PropertySubType, 120);
  const listPriceCents = centsFromDollars(row?.ListPrice);
  const rentCentsMonthly = centsFromDollars(row?.LeaseAmount ?? row?.RentPrice ?? row?.ListPriceLow);
  const transactionType: 'sale' | 'rent' = rentCentsMonthly && !listPriceCents ? 'rent' : 'sale';
  const listingId = safeText(row?.ListingId || row?.ListingKey || row?.ListingKeyNumeric, 160);
  const listingKey = safeText(row?.ListingKey || listingId, 180);
  const address = safeText(
    row?.UnparsedAddress
      || [row?.StreetNumber, row?.StreetDirPrefix, row?.StreetName, row?.StreetSuffix].filter(Boolean).join(' '),
    260,
  );
  const city = safeText(row?.City, 100);
  const region = safeText(row?.StateOrProvince, 80);
  const postalCode = safeText(row?.PostalCode, 32);
  const country = safeText(row?.Country || 'US', 40);
  const sourceUrl = safeSourceUrl(row?.ListingURL || row?.SourceURL || row?.BuyerAgencyCompensationRemarksURL);
  const virtualTourUrl = safeSourceUrl(row?.VirtualTourURLUnbranded || row?.VirtualTourURLBranded);

  return {
    id: `bridge:${dataset}:${listingKey}`,
    provider: 'Bridge / authorized MLS',
    providerDataset: dataset,
    listingId,
    address,
    city,
    region,
    postalCode,
    country,
    latitude: finiteNumber(row?.Latitude),
    longitude: finiteNumber(row?.Longitude),
    category: categoryFrom(type, subType),
    propertyType: type,
    propertySubType: subType,
    transactionType,
    listPriceCents,
    rentCentsMonthly,
    marketValueCents: transactionType === 'sale' ? listPriceCents : rentCentsMonthly,
    marketValueLabel: transactionType === 'sale' ? 'MLS list price' : 'Monthly asking rent',
    beds: finiteNumber(row?.BedroomsTotal),
    baths: finiteNumber(row?.BathroomsTotalInteger ?? row?.BathroomsFull ?? row?.BathroomsTotalDecimal),
    livingAreaSqft: finiteNumber(row?.LivingArea ?? row?.BuildingAreaTotal),
    lotAreaSqft: finiteNumber(row?.LotSizeSquareFeet),
    stories: finiteNumber(row?.Stories),
    status: safeText(row?.StandardStatus || row?.MlsStatus || 'Active', 80),
    imageUrl: firstMediaUrl(row),
    sourceUrl,
    virtualTourUrl,
    modifiedAt: row?.ModificationTimestamp ? safeText(row.ModificationTimestamp, 80) : null,
    sourceDisclosure: 'Live listing data supplied by an authorized MLS/Bridge dataset. Availability, price and property facts can change at the source.',
  };
}

function escapeODataString(value: string) {
  return value.replace(/'/g, "''");
}

function bridgeFilter({ query, latitude, longitude }: { query?: string; latitude?: number; longitude?: number }) {
  const clauses = ["StandardStatus eq 'Active'"];
  const q = safeText(query, 80);
  if (q) {
    const escaped = escapeODataString(q);
    if (/^\d{5}(?:-\d{4})?$/.test(q)) clauses.push(`PostalCode eq '${escaped}'`);
    else clauses.push(`(contains(UnparsedAddress,'${escaped}') or contains(City,'${escaped}') or contains(StateOrProvince,'${escaped}'))`);
  } else if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    const lat = Number(latitude);
    const lon = Number(longitude);
    const latSpan = 0.22;
    const lonSpan = 0.28;
    clauses.push(`Latitude ge ${lat - latSpan} and Latitude le ${lat + latSpan} and Longitude ge ${lon - lonSpan} and Longitude le ${lon + lonSpan}`);
  }
  return clauses.join(' and ');
}

function bridgeConfigured() {
  return Boolean(process.env.BRIDGE_DATASET_ID?.trim() && process.env.BRIDGE_ACCESS_TOKEN?.trim());
}

async function searchBridge({ query, latitude, longitude, category, transactionType }: {
  query?: string;
  latitude?: number;
  longitude?: number;
  category?: string;
  transactionType?: string;
}) {
  const dataset = process.env.BRIDGE_DATASET_ID?.trim();
  const token = process.env.BRIDGE_ACCESS_TOKEN?.trim();
  if (!dataset || !token) return [] as EarthProperty[];

  const endpoint = new URL(`${BRIDGE_BASE_URL}/${encodeURIComponent(dataset)}/Property`);
  endpoint.searchParams.set('$top', '40');
  endpoint.searchParams.set('$orderby', 'ModificationTimestamp desc');
  endpoint.searchParams.set('$filter', bridgeFilter({ query, latitude, longitude }));
  endpoint.searchParams.set('$select', [
    'ListingKey','ListingId','ListPrice','LeaseAmount','UnparsedAddress','StreetNumber','StreetName','StreetSuffix','City','StateOrProvince','PostalCode','Country','Latitude','Longitude','BedroomsTotal','BathroomsTotalInteger','BathroomsTotalDecimal','LivingArea','BuildingAreaTotal','LotSizeSquareFeet','Stories','PropertyType','PropertySubType','StandardStatus','MlsStatus','ModificationTimestamp','ListingURL','VirtualTourURLUnbranded','VirtualTourURLBranded'
  ].join(','));
  endpoint.searchParams.set('$expand', 'Media($top=1)');

  const response = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    throw new Error(`Bridge property search failed (${response.status}): ${detail}`);
  }

  const payload = await response.json();
  const rows = Array.isArray(payload?.value) ? payload.value : Array.isArray(payload?.bundle) ? payload.bundle : [];
  return rows
    .map((row: any) => normalizeBridgeProperty(row, dataset))
    .filter((property: EarthProperty) => !category || category === 'all' || property.category === category)
    .filter((property: EarthProperty) => !transactionType || transactionType === 'all' || property.transactionType === transactionType)
    .slice(0, MAX_RESULTS);
}

export async function searchEarthProperties(input: {
  query?: string;
  latitude?: number;
  longitude?: number;
  category?: string;
  transactionType?: string;
}) {
  if (!bridgeConfigured()) {
    return {
      configured: false,
      provider: 'Bridge / authorized MLS',
      listings: [] as EarthProperty[],
      message: 'Real-property feed is not connected yet. Add an authorized Bridge/MLS dataset token; Voxel Vault will not fabricate listings.',
    };
  }

  const listings = await searchBridge(input);
  return {
    configured: true,
    provider: 'Bridge / authorized MLS',
    listings,
    message: listings.length
      ? `Showing ${listings.length} live authorized listing${listings.length === 1 ? '' : 's'}.`
      : 'No active authorized listings matched this search.',
  };
}

export const EARTH_PROPERTY_CATEGORIES: { id: EarthPropertyCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'house', label: 'Houses' },
  { id: 'condo', label: 'Condos' },
  { id: 'mobile-home', label: 'Mobile / Trailer' },
  { id: 'multifamily', label: 'Multifamily' },
  { id: 'storefront', label: 'Storefronts' },
  { id: 'commercial', label: 'Commercial' },
  { id: 'warehouse', label: 'Warehouses' },
  { id: 'barn-farm', label: 'Barns / Farms' },
  { id: 'land', label: 'Land' },
];
