import { createHash } from 'node:crypto';

const clean = (value) => String(value ?? '').trim();
const compact = (value) => clean(value).replace(/\s+/g, ' ');
const upper = (value) => compact(value).toUpperCase();

export const OWNER_REAL_PROPERTY_PILOT_MAX_USD = 700;
export const FRACTIONAL_POSITION_VERIFIER_IMPLEMENTATION_READY = false;
export const LIVE_FRACTIONAL_PROPERTY_EXECUTION_READY = false;

export const FRACTIONAL_PROPERTY_PROVIDERS = Object.freeze({
  lofty: Object.freeze({
    id: 'lofty',
    displayName: 'Lofty',
    officialMarketplaceUrl: 'https://www.lofty.ai/marketplace',
    officialTermsUrl: 'https://www.lofty.ai/terms',
    ownershipDescription: 'Provider-described direct fractional ownership in a property-specific LLC.',
    settlementDescription: 'Provider-described blockchain/USDC marketplace settlement.',
    providerKycRequired: true,
    publicExecutionApiVerified: false,
    scrapingPermitted: false,
    automaticTradingPermittedByVoxelVault: false,
    executionMode: 'external-provider-interface-only',
    evidenceMode: 'user-supplied-reference-plus-future-approved-verifier',
  }),
});

function positiveNumber(value, label, { max = Infinity } = {}) {
  if (value === null || value === undefined || clean(value) === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new Error(`${label} must be greater than zero.`);
  if (number > max) throw new Error(`${label} cannot exceed ${max}.`);
  return number;
}

function safeReference(value, label, maxLength = 180) {
  const normalized = compact(value);
  if (!normalized) return '';
  if (normalized.length > maxLength) throw new Error(`${label} is too long.`);
  if (/\b(seed phrase|private key|password|secret key)\b/i.test(normalized)) {
    throw new Error(`${label} must never contain wallet credentials, passwords, seed phrases or private keys.`);
  }
  return normalized;
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function normalizeParcelBinding(input = {}) {
  const countryCode = upper(input.countryCode || 'US');
  const subdivisionCode = upper(input.subdivisionCode);
  const countyCode = upper(input.countyCode);
  const parcelId = upper(input.parcelId).replace(/\s+/g, '');
  const supplied = [subdivisionCode, countyCode, parcelId].filter(Boolean).length;

  if (countryCode && countryCode.length !== 2) throw new Error('Country code must be two letters.');
  if (supplied > 0 && supplied < 3) {
    throw new Error('Parcel binding requires state/subdivision, county/assessor jurisdiction and parcel ID together.');
  }

  return {
    countryCode: countryCode || 'US',
    subdivisionCode,
    countyCode,
    parcelId,
    bound: supplied === 3,
    canonicalKey: supplied === 3 ? [countryCode || 'US', subdivisionCode, countyCode, parcelId].join(':') : '',
  };
}

export function getFractionalPropertyProvider(providerId = 'lofty') {
  const id = clean(providerId).toLowerCase();
  const provider = FRACTIONAL_PROPERTY_PROVIDERS[id];
  if (!provider) throw new Error(`Unsupported fractional-property provider: ${id || 'missing'}.`);
  return provider;
}

export function buildFractionalPropertyHandoff({ providerId = 'lofty', budgetUsd = 25 } = {}) {
  const provider = getFractionalPropertyProvider(providerId);
  const amount = positiveNumber(budgetUsd, 'Pilot budget', { max: OWNER_REAL_PROPERTY_PILOT_MAX_USD }) || 25;

  return {
    provider,
    budgetUsd: amount,
    maxPilotBudgetUsd: OWNER_REAL_PROPERTY_PILOT_MAX_USD,
    liveExecutionReady: LIVE_FRACTIONAL_PROPERTY_EXECUTION_READY,
    automatedTradingEnabled: false,
    scrapingEnabled: false,
    requiresExternalProviderCheckout: true,
    requiresProviderKyc: provider.providerKycRequired,
    userAuthorizationRequiredForEveryPurchase: true,
    note: 'Voxel Vault may prepare the ownership workflow, but the user must complete any current purchase through the provider-approved interface unless an approved production integration is added later.',
  };
}

export function normalizeFractionalPositionClaim(input = {}) {
  const provider = getFractionalPropertyProvider(input.providerId || 'lofty');
  const purchaseAmountUsd = positiveNumber(input.purchaseAmountUsd, 'Purchase amount', { max: OWNER_REAL_PROPERTY_PILOT_MAX_USD });
  const quantity = positiveNumber(input.quantity, 'Owned quantity');
  const propertyAddress = safeReference(input.propertyAddress, 'Property address');
  const legalEntity = safeReference(input.legalEntity, 'Property legal entity');
  const providerPositionId = safeReference(input.providerPositionId, 'Provider position ID');
  const blockchainAssetId = safeReference(input.blockchainAssetId, 'Blockchain asset ID');
  const transactionId = safeReference(input.transactionId, 'Transaction ID');
  const providerReceiptRef = safeReference(input.providerReceiptRef, 'Provider receipt reference');
  const evidenceDocumentSha256 = clean(input.evidenceDocumentSha256).toLowerCase();
  const walletAddress = safeReference(input.walletAddress, 'Wallet address', 256);
  const parcel = normalizeParcelBinding(input.parcel);

  if (!propertyAddress) throw new Error('Property address is required for a property-specific position claim.');
  if (!legalEntity) throw new Error('The property-specific legal entity/LLC name is required.');
  if (!quantity) throw new Error('Owned quantity is required.');
  if (!purchaseAmountUsd) throw new Error('Purchase amount is required.');
  if (!providerPositionId && !blockchainAssetId && !transactionId && !providerReceiptRef) {
    throw new Error('At least one provider/on-chain purchase reference is required.');
  }
  if (evidenceDocumentSha256 && !/^[a-f0-9]{64}$/.test(evidenceDocumentSha256)) {
    throw new Error('Evidence document SHA-256 must be a 64-character hexadecimal digest.');
  }

  const purchaseCompleted = input.purchaseCompleted === true;
  const providerKycCompleted = input.providerKycCompleted === true;
  const userConfirmedNoSecrets = input.userConfirmedNoSecrets === true;
  if (!userConfirmedNoSecrets) throw new Error('Confirm that no passwords, seed phrases, private keys or other wallet credentials are included.');

  const fingerprintMaterial = JSON.stringify({
    provider: provider.id,
    propertyAddress: upper(propertyAddress),
    legalEntity: upper(legalEntity),
    providerPositionId,
    blockchainAssetId,
    transactionId,
    providerReceiptRef,
    walletAddress,
    parcel: parcel.canonicalKey,
    quantity,
    purchaseAmountUsd,
  });

  return {
    providerId: provider.id,
    providerName: provider.displayName,
    propertyAddress,
    legalEntity,
    parcel,
    purchaseAmountUsd,
    quantity,
    providerPositionId,
    blockchainAssetId,
    transactionId,
    providerReceiptRef,
    evidenceDocumentSha256,
    walletAddress,
    purchaseCompleted,
    providerKycCompleted,
    positionFingerprint: sha256(`voxel-vault-fractional-position-v1:${fingerprintMaterial}`),
  };
}

export function evaluateFractionalPositionClaim(input = {}) {
  const claim = normalizeFractionalPositionClaim(input);
  const provider = getFractionalPropertyProvider(claim.providerId);
  const blockers = [];

  if (!claim.purchaseCompleted) blockers.push('provider purchase not confirmed by user');
  if (!claim.providerKycCompleted) blockers.push('provider KYC/eligibility not confirmed by user');
  if (!claim.parcel.bound) blockers.push('exact parcel identity not bound');
  if (!FRACTIONAL_POSITION_VERIFIER_IMPLEMENTATION_READY) blockers.push('approved provider/on-chain verifier not implemented');
  if (!provider.publicExecutionApiVerified) blockers.push('public production provider API/partnership not verified');

  // User-entered references are evidence leads, not authority. This must stay false until
  // a provider-approved verifier independently confirms the position and its legal-property mapping.
  const verifiedProviderPosition = false;
  const verifiedPropertyRights = false;

  return {
    claim,
    provider,
    status: verifiedProviderPosition && verifiedPropertyRights ? 'verified' : 'needs-provider-verification',
    rightsType: verifiedPropertyRights ? 'provider_fractional_security' : 'reference_only',
    targetRightsType: 'provider_fractional_security',
    verifiedProviderPosition,
    verifiedPropertyRights,
    canDisplayAsOwnedProperty: verifiedPropertyRights,
    canDisplayAsPendingPosition: claim.purchaseCompleted,
    canAutoReinvest: false,
    canExecuteTrade: false,
    blockers,
    legalEffects: {
      createsDeedOwnership: false,
      createsLlcMembership: false,
      createsSecurityInterest: false,
      transfersFunds: false,
      authorizesTrading: false,
      verifiesTitle: false,
    },
    nextStep: claim.purchaseCompleted
      ? 'Connect an approved provider/on-chain verifier and exact parcel identity before Voxel Vault may label this position as FRACTIONAL POSITION VERIFIED.'
      : 'Complete any investment through the provider-approved interface first; Voxel Vault does not execute this provider trade.',
  };
}

export function publicFractionalBridgeStatus() {
  return {
    implementation: 'external-provider-handoff-plus-pending-proof-intake',
    maxOwnerPilotBudgetUsd: OWNER_REAL_PROPERTY_PILOT_MAX_USD,
    positionVerifierImplementationReady: FRACTIONAL_POSITION_VERIFIER_IMPLEMENTATION_READY,
    liveExecutionReady: LIVE_FRACTIONAL_PROPERTY_EXECUTION_READY,
    automatedTradingEnabled: false,
    scrapingEnabled: false,
    providers: Object.values(FRACTIONAL_PROPERTY_PROVIDERS).map((provider) => ({ ...provider })),
  };
}
