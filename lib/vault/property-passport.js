const clean = (value) => String(value ?? '').trim();
const money = (value) => {
  const number = Number(value || 0);
  return Number.isFinite(number) && number >= 0 ? number : 0;
};

export const REAL_WORLD_VOXEL_POLICY = Object.freeze({
  canonicalTwinPerProperty: 1,
  canonicalTwinIsDeed: false,
  realPropertyPurchaseRequiresClosing: true,
  collectibleConveysPropertyRights: false,
  unverifiedAddressLinkedMintingAllowed: false,
  unattendedPropertyPurchaseAllowed: false,
  liveRentDistributionReady: false,
  premiumCanonicalTwinStartingPriceUsd: 299,
  verifiedTwinRefreshPriceUsd: 99,
});

export const PROPERTY_PASSPORT_STATES = Object.freeze({
  VISUAL_ONLY: 'visual-only',
  DILIGENCE_INCOMPLETE: 'diligence-incomplete',
  VERIFIED_PROPERTY: 'verified-property',
  TESTNET_ANCHORED: 'testnet-anchored',
  LIVE_LEGAL_INTEREST_LOCKED: 'live-legal-interest-locked',
});

export function buildCanonicalPropertyPassport(input = {}) {
  const propertyKey = clean(input.propertyKey || input.parcelId || input.addressHash);
  if (!propertyKey) throw new Error('A stable property key is required for a canonical Property Passport.');

  const ownerAuthorized = Boolean(input.ownerAuthorized);
  const propertyVerified = Boolean(input.propertyVerified);
  const titleVerified = Boolean(input.titleVerified);
  const entityVerified = Boolean(input.entityVerified);
  const testnetAnchored = Boolean(input.testnetAnchored);
  const liveLegalInterestReady = Boolean(input.liveLegalInterestReady);

  let state = PROPERTY_PASSPORT_STATES.VISUAL_ONLY;
  if (ownerAuthorized && propertyVerified) state = PROPERTY_PASSPORT_STATES.DILIGENCE_INCOMPLETE;
  if (ownerAuthorized && propertyVerified && titleVerified && entityVerified) state = PROPERTY_PASSPORT_STATES.VERIFIED_PROPERTY;
  if (ownerAuthorized && propertyVerified && titleVerified && entityVerified && testnetAnchored) state = PROPERTY_PASSPORT_STATES.TESTNET_ANCHORED;
  if (liveLegalInterestReady) state = PROPERTY_PASSPORT_STATES.LIVE_LEGAL_INTEREST_LOCKED;

  const market = {
    estimatedValueUsd: money(input.estimatedValueUsd),
    valuationSource: clean(input.valuationSource || 'not verified'),
    valuationAsOf: clean(input.valuationAsOf),
  };

  return {
    id: `property:${propertyKey}`,
    propertyKey,
    title: clean(input.title || 'Real-world property'),
    locality: clean(input.locality),
    modelUrl: clean(input.modelUrl),
    modelVersion: Math.max(1, Number(input.modelVersion || 1)),
    canonicalMintSupply: 1,
    canonicalMinted: Boolean(input.canonicalMinted),
    state,
    ownerAuthorized,
    propertyVerified,
    titleVerified,
    entityVerified,
    testnetAnchored,
    liveLegalInterestReady: false,
    market,
    pricing: {
      canonicalTwinStartingPriceUsd: REAL_WORLD_VOXEL_POLICY.premiumCanonicalTwinStartingPriceUsd,
      modelRefreshPriceUsd: REAL_WORLD_VOXEL_POLICY.verifiedTwinRefreshPriceUsd,
      propertyPurchasePriceUsd: market.estimatedValueUsd,
      propertyPurchaseExecutable: false,
    },
    truth: {
      canonicalTwinIsDeed: false,
      collectibleConveysPropertyRights: false,
      realPropertyPurchaseRequiresNormalClosing: true,
      actualRentRequiresLegalEconomicRights: true,
      digitalRentalCanBeSeparateLicense: true,
    },
    notes: [
      'Exactly one canonical Property Passport identity may represent this verified real-world property inside Voxel Vault.',
      'Renovations and better scans create versioned 3D model updates; they do not create a second canonical property identity.',
      'The Property Passport is a verified digital twin and provenance record, not the recorded deed.',
      'Real-property value comes from real-world valuation evidence. Collectible or licensing value is a separate market.',
      'Actual rental income may only be attributed to a holder after legal ownership/economic rights and property accounting are verified.',
    ],
  };
}

export function buildDigitalBuildingEdition({
  canonicalPropertyKey = '',
  creatorAuthorized = false,
  addressLinked = false,
  supply = 1,
  license = 'display',
} = {}) {
  if (addressLinked && !creatorAuthorized) {
    throw new Error('An address-linked building edition requires property-owner or authorized-controller permission.');
  }

  return {
    kind: 'digital-building-edition',
    canonicalPropertyKey: clean(canonicalPropertyKey),
    verifiedLink: Boolean(canonicalPropertyKey && creatorAuthorized),
    supply: Math.max(1, Math.floor(Number(supply || 1))),
    license: clean(license || 'display'),
    conveysDeed: false,
    conveysActualRent: false,
    digitalRentalEligible: true,
    note: 'A digital building edition is a collectible/license. It does not transfer the building, land, deed, tenancy or property rent.',
  };
}

export function propertyPurchaseProgression() {
  return [
    'verified listing / negotiated property',
    'independent valuation and diligence',
    'buyer/entity approval and compliant USD funding',
    'contract + escrow/title/attorney closing',
    'recorded deed in normal land-title system',
    'verified Property Passport linked to closing evidence',
    'only then: eligible legal economic-interest layer',
    'only then: verified net property income may enter distribution accounting',
  ];
}
