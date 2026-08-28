export const DIGITAL_ESTATE_DISCLOSURE = 'Digital-only blockchain collectible. The displayed real-world reference value is a creative pricing reference for the modeled property, not an appraisal, deed, security, rent right, or claim on physical real estate.';

export const STRIPE_MAX_USD_CENTS = 99_999_999;

export const DIGITAL_ESTATES = Object.freeze([
  {
    id: 'cedar-bend-courtyard',
    name: 'Cedar Bend Courtyard',
    locationLabel: 'Great Lakes-inspired district',
    architecture: 'courtyard',
    beds: 3,
    baths: 2,
    sqft: 1680,
    lotSqft: 6200,
    floors: 1,
    referenceValueCents: 18_500_000,
    purchasePriceCents: 18_500_000,
    accent: '#a8ffca',
    structure: '#b8b1a4',
    roof: '#302d2d',
    terrain: '#24372c',
    summary: 'Low-slung courtyard home with a private garden core, warm stone walls, and a calm residential scale.',
  },
  {
    id: 'desert-glass-house',
    name: 'Desert Glass House',
    locationLabel: 'Southwest-inspired district',
    architecture: 'glass',
    beds: 3,
    baths: 3,
    sqft: 2240,
    lotSqft: 9800,
    floors: 1,
    referenceValueCents: 32_500_000,
    purchasePriceCents: 32_500_000,
    accent: '#ffbd77',
    structure: '#d8c8ad',
    roof: '#6d5f50',
    terrain: '#684c37',
    summary: 'A long glass pavilion with shaded overhangs, desert landscaping, and a sculptural central pool.',
  },
  {
    id: 'lakeview-modern',
    name: 'Lakeview Modern',
    locationLabel: 'Waterfront-inspired district',
    architecture: 'waterfront',
    beds: 4,
    baths: 3,
    sqft: 3120,
    lotSqft: 11800,
    floors: 2,
    referenceValueCents: 47_500_000,
    purchasePriceCents: 47_500_000,
    accent: '#72d6ff',
    structure: '#d7dde2',
    roof: '#2e3945',
    terrain: '#274653',
    summary: 'Two-story waterfront-inspired modern with a glass stair tower, broad terrace, and dock-like deck.',
  },
  {
    id: 'coastal-courtyard-villa',
    name: 'Coastal Courtyard Villa',
    locationLabel: 'Atlantic-inspired district',
    architecture: 'villa',
    beds: 5,
    baths: 4,
    sqft: 4380,
    lotSqft: 15400,
    floors: 2,
    referenceValueCents: 68_500_000,
    purchasePriceCents: 68_500_000,
    accent: '#f8dc9c',
    structure: '#f0e3ca',
    roof: '#6c5144',
    terrain: '#3f6047',
    summary: 'A large courtyard villa with twin wings, an elevated terrace, pool court, and layered garden walls.',
  },
  {
    id: 'skyline-villa-09',
    name: 'Skyline Villa 09',
    locationLabel: 'Metropolitan-inspired district',
    architecture: 'sky-villa',
    beds: 5,
    baths: 5,
    sqft: 5960,
    lotSqft: 9200,
    floors: 3,
    referenceValueCents: 92_500_000,
    purchasePriceCents: 92_500_000,
    accent: '#c9b9ff',
    structure: '#c7c8d3',
    roof: '#272936',
    terrain: '#25293a',
    summary: 'A three-level digital showpiece with cantilevered volumes, a rooftop garden, and a dramatic night-city silhouette.',
  },
]);

export function getDigitalEstate(id) {
  const normalized = String(id || '').trim().toLowerCase();
  return DIGITAL_ESTATES.find((estate) => estate.id === normalized) || null;
}

export function formatUsdCents(cents) {
  const amount = Number(cents || 0) / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function estateCheckoutSupported(estate) {
  if (!estate) return false;
  const amount = Number(estate.purchasePriceCents || 0);
  return Number.isInteger(amount) && amount >= 50 && amount <= STRIPE_MAX_USD_CENTS;
}

export function assertDigitalEstatePricing(estate) {
  if (!estate) throw new Error('Unknown digital estate.');
  if (Number(estate.referenceValueCents) !== Number(estate.purchasePriceCents)) {
    throw new Error('Digital estate list price must match its displayed real-world reference value in this phase.');
  }
  return estate;
}
