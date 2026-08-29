export const DIGITAL_ESTATE_ANCHOR_PRICE_CENTS = 199;
export const DIGITAL_ESTATE_ANCHOR_SQFT = 2016;
export const DIGITAL_ESTATE_PRICING_MODEL = 'relative-digital-anchor-v1';
export const DIGITAL_ESTATE_ANCHOR_LABEL = 'Founder reference model';

export const DIGITAL_ESTATE_DISCLOSURE = 'Digital-only Voxel Vault property collectible. The price is a platform collectible price calculated from the disclosed founder-reference index. It is not a real-property price, appraisal, security, rent right, bank deposit, deed, title, or claim on a physical parcel or building.';

export const STRIPE_MAX_USD_CENTS = 99_999_999;

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function relativeDigitalEstateIndexBps(modeledSqft) {
  const sqft = Number(modeledSqft || 0);
  if (!Number.isFinite(sqft) || sqft <= 0) throw new Error('A positive modeled square-foot value is required.');
  return Math.round(clamp(Math.sqrt(sqft / DIGITAL_ESTATE_ANCHOR_SQFT), 0.75, 2.5) * 10_000);
}

export function relativeDigitalEstatePriceCents(modeledSqft) {
  return Math.max(50, Math.round(DIGITAL_ESTATE_ANCHOR_PRICE_CENTS * relativeDigitalEstateIndexBps(modeledSqft) / 10_000));
}

function estate(input) {
  const relativeIndexBps = relativeDigitalEstateIndexBps(input.sqft);
  return Object.freeze({
    ...input,
    pricingModel: DIGITAL_ESTATE_PRICING_MODEL,
    pricingAnchorLabel: DIGITAL_ESTATE_ANCHOR_LABEL,
    anchorPriceCents: DIGITAL_ESTATE_ANCHOR_PRICE_CENTS,
    anchorSqft: DIGITAL_ESTATE_ANCHOR_SQFT,
    relativeIndexBps,
    purchasePriceCents: relativeDigitalEstatePriceCents(input.sqft),
    pricingBasis: `Square-root comparison of ${Number(input.sqft).toLocaleString('en-US')} modeled sq ft against the ${DIGITAL_ESTATE_ANCHOR_SQFT.toLocaleString('en-US')} sq ft founder reference.`,
  });
}

export const DIGITAL_ESTATES = Object.freeze([
  estate({
    id: 'kensington-reference-home',
    name: 'Kensington Voxel Home',
    locationLabel: 'Buffalo reference district · stylized model',
    architecture: 'reference-home',
    beds: 4,
    baths: 2,
    sqft: DIGITAL_ESTATE_ANCHOR_SQFT,
    lotSqft: 4080,
    floors: 2,
    units: 3,
    pricingAnchor: true,
    accent: '#a8ffca',
    structure: '#d9c5a7',
    roof: '#3a302c',
    terrain: '#244332',
    summary: 'The founder pricing anchor: a stylized Buffalo-scale voxel home used to set the $1.99 digital collectible baseline. It is not represented as an exact architectural replica.',
  }),
  estate({
    id: 'cedar-bend-courtyard',
    name: 'Cedar Bend Courtyard',
    locationLabel: 'Great Lakes-inspired district',
    architecture: 'courtyard',
    beds: 3,
    baths: 2,
    sqft: 1680,
    lotSqft: 6200,
    floors: 1,
    units: 1,
    pricingAnchor: false,
    accent: '#b8f4d2',
    structure: '#b8b1a4',
    roof: '#302d2d',
    terrain: '#24372c',
    summary: 'Low-slung courtyard home with a private garden core, warm stone walls, and a calm residential scale.',
  }),
  estate({
    id: 'desert-glass-house',
    name: 'Desert Glass House',
    locationLabel: 'Southwest-inspired district',
    architecture: 'glass',
    beds: 3,
    baths: 3,
    sqft: 2240,
    lotSqft: 9800,
    floors: 1,
    units: 1,
    pricingAnchor: false,
    accent: '#ffbd77',
    structure: '#d8c8ad',
    roof: '#6d5f50',
    terrain: '#684c37',
    summary: 'A long glass pavilion with shaded overhangs, desert landscaping, and a sculptural central pool.',
  }),
  estate({
    id: 'lakeview-modern',
    name: 'Lakeview Modern',
    locationLabel: 'Waterfront-inspired district',
    architecture: 'waterfront',
    beds: 4,
    baths: 3,
    sqft: 3120,
    lotSqft: 11800,
    floors: 2,
    units: 1,
    pricingAnchor: false,
    accent: '#72d6ff',
    structure: '#d7dde2',
    roof: '#2e3945',
    terrain: '#274653',
    summary: 'Two-story waterfront-inspired modern with a glass stair tower, broad terrace, and dock-like deck.',
  }),
  estate({
    id: 'coastal-courtyard-villa',
    name: 'Coastal Courtyard Villa',
    locationLabel: 'Atlantic-inspired district',
    architecture: 'villa',
    beds: 5,
    baths: 4,
    sqft: 4380,
    lotSqft: 15400,
    floors: 2,
    units: 1,
    pricingAnchor: false,
    accent: '#f8dc9c',
    structure: '#f0e3ca',
    roof: '#6c5144',
    terrain: '#3f6047',
    summary: 'A large courtyard villa with twin wings, an elevated terrace, pool court, and layered garden walls.',
  }),
  estate({
    id: 'skyline-villa-09',
    name: 'Skyline Villa 09',
    locationLabel: 'Metropolitan-inspired district',
    architecture: 'sky-villa',
    beds: 5,
    baths: 5,
    sqft: 5960,
    lotSqft: 9200,
    floors: 3,
    units: 1,
    pricingAnchor: false,
    accent: '#c9b9ff',
    structure: '#c7c8d3',
    roof: '#272936',
    terrain: '#25293a',
    summary: 'A three-level digital showpiece with cantilevered volumes, a rooftop garden, and a dramatic night-city silhouette.',
  }),
]);

export function getDigitalEstate(id) {
  const normalized = String(id || '').trim().toLowerCase();
  return DIGITAL_ESTATES.find((item) => item.id === normalized) || null;
}

export function formatUsdCents(cents) {
  const amount = Number(cents || 0) / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatRelativeEstateIndex(indexBps) {
  return `${(Number(indexBps || 0) / 10_000).toFixed(2)}×`;
}

export function estateCheckoutSupported(item) {
  if (!item) return false;
  const amount = Number(item.purchasePriceCents || 0);
  return Number.isInteger(amount) && amount >= 50 && amount <= STRIPE_MAX_USD_CENTS;
}

export function assertDigitalEstatePricing(item) {
  if (!item) throw new Error('Unknown digital estate.');
  if (item.pricingModel !== DIGITAL_ESTATE_PRICING_MODEL) throw new Error('Digital estate pricing model is invalid.');
  if (Number(item.anchorPriceCents) !== DIGITAL_ESTATE_ANCHOR_PRICE_CENTS) throw new Error('Digital estate anchor price is invalid.');
  if (Number(item.relativeIndexBps) !== relativeDigitalEstateIndexBps(item.sqft)) throw new Error('Digital estate relative price index is invalid.');
  if (Number(item.purchasePriceCents) !== relativeDigitalEstatePriceCents(item.sqft)) throw new Error('Digital estate price does not match the disclosed relative-price formula.');
  return item;
}
