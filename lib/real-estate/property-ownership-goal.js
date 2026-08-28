const clean = (value) => String(value ?? '').trim();

export const MIN_PROPERTY_GOAL_CONTRIBUTION_CENTS = 1;
export const DEFAULT_PROPERTY_GOAL_MAX_CENTS = 70_000;
export const STARTER_INVESTMENT_PRESETS_CENTS = Object.freeze([500, 1000, 2500, 5000]);

function cents(value, label, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (value === null || value === undefined || clean(value) === '') return 0;
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < min || number > max) {
    throw new Error(`${label} must be an integer number of cents between ${min} and ${max}.`);
  }
  return number;
}

export function buildPropertyOwnershipGoal(input = {}) {
  const targetPropertyPriceCents = cents(input.targetPropertyPriceCents, 'Target property price', { min: 1 });
  const savedCents = cents(input.savedCents, 'Saved amount', { min: 0, max: targetPropertyPriceCents });
  const contributionCents = cents(input.contributionCents, 'Contribution', { min: MIN_PROPERTY_GOAL_CONTRIBUTION_CENTS, max: DEFAULT_PROPERTY_GOAL_MAX_CENTS });
  const nextSavedCents = Math.min(targetPropertyPriceCents, savedCents + contributionCents);
  const remainingCents = Math.max(0, targetPropertyPriceCents - nextSavedCents);
  const progressPercent = targetPropertyPriceCents > 0 ? Math.min(100, (nextSavedCents / targetPropertyPriceCents) * 100) : 0;

  return {
    mode: 'property_acquisition_goal',
    contributionCents,
    minimumContributionCents: MIN_PROPERTY_GOAL_CONTRIBUTION_CENTS,
    starterPresetsCents: STARTER_INVESTMENT_PRESETS_CENTS,
    targetPropertyPriceCents,
    previousSavedCents: savedCents,
    nextSavedCents,
    remainingCents,
    progressPercent: Number(progressPercent.toFixed(6)),
    ownershipCreated: false,
    securityPurchased: false,
    deedInterestCreated: false,
    propertyReserved: false,
    note: 'A user may start with a small amount, but saving or earmarking money does not create equity, a security, an LLC interest, or deed ownership.',
  };
}

export function evaluateStarterPropertyInvestment(input = {}) {
  const amountCents = cents(input.amountCents, 'Starter investment amount', { min: 1, max: DEFAULT_PROPERTY_GOAL_MAX_CENTS });
  const providerMinimumCents = cents(input.providerMinimumCents, 'Provider minimum', { min: 0, max: DEFAULT_PROPERTY_GOAL_MAX_CENTS });
  const providerOfferingVerified = input.providerOfferingVerified === true;
  const providerExecutionReady = input.providerExecutionReady === true;
  const userEligible = input.userEligible === true;
  const userAuthorizedPurchase = input.userAuthorizedPurchase === true;
  const providerMinimumKnown = providerMinimumCents > 0;
  const meetsProviderMinimum = providerMinimumKnown && amountCents >= providerMinimumCents;
  const canOpenProviderCheckout = providerOfferingVerified
    && providerExecutionReady
    && userEligible
    && userAuthorizedPurchase
    && meetsProviderMinimum;

  let state = 'goal_only';
  if (providerOfferingVerified && !providerMinimumKnown) state = 'provider_minimum_unknown';
  else if (providerOfferingVerified && providerMinimumKnown && !meetsProviderMinimum) state = 'below_provider_minimum';
  else if (canOpenProviderCheckout) state = 'provider_handoff_ready';
  else if (providerOfferingVerified && meetsProviderMinimum) state = 'provider_requirements_pending';

  return {
    mode: 'starter_property_investment',
    amountCents,
    starterPresetsCents: STARTER_INVESTMENT_PRESETS_CENTS,
    providerMinimumCents: providerMinimumKnown ? providerMinimumCents : null,
    providerMinimumKnown,
    meetsProviderMinimum,
    providerOfferingVerified,
    providerExecutionReady,
    userEligible,
    userAuthorizedPurchase,
    state,
    canOpenProviderCheckout,
    ownershipCreated: false,
    verifiedPropertyPosition: false,
    securityPurchasedByThisCheck: false,
    fundsTransferredByThisCheck: false,
    nextStep: canOpenProviderCheckout
      ? 'Open the verified provider checkout for this exact offering. Ownership is still pending until the resulting position is independently verified.'
      : !providerOfferingVerified
        ? 'No verified offering is attached to this property yet. Keep this amount as a goal rather than calling it an investment position.'
        : !providerMinimumKnown
          ? 'Load the provider-reported minimum or share price before determining whether this amount can be invested.'
          : !meetsProviderMinimum
            ? `Build this amount toward the provider minimum of ${providerMinimumCents} cents or choose another verified offering with a lower minimum.`
            : 'Provider eligibility, execution readiness, or explicit purchase authorization is still required.',
    note: 'Small-dollar investing is allowed only when the actual offering permits that amount. GEO never invents fractional ownership below a provider minimum and never treats a checkout readiness check as proof of ownership.',
  };
}

export function buildDigitalAssetToPropertyPlan(input = {}) {
  const settledAssetProceedsCents = cents(input.settledAssetProceedsCents, 'Settled digital-asset proceeds', { min: 0 });
  const earmarkCents = cents(input.earmarkCents, 'Earmark amount', { min: 0, max: settledAssetProceedsCents });
  const providerOfferingVerified = input.providerOfferingVerified === true;
  const providerExecutionReady = input.providerExecutionReady === true;
  const userAuthorizedPurchase = input.userAuthorizedPurchase === true;

  return {
    settledAssetProceedsCents,
    earmarkCents,
    canMoveToPropertyGoal: earmarkCents > 0 && earmarkCents <= settledAssetProceedsCents,
    canPurchasePropertyPosition: providerOfferingVerified && providerExecutionReady && userAuthorizedPurchase && earmarkCents > 0,
    createsPropertyEquityByHoldingDigitalAsset: false,
    requiresSeparateLegalOffering: true,
    note: providerOfferingVerified
      ? 'Settled proceeds may fund a separately verified property offering, subject to provider eligibility, minimums, settlement, and explicit user authorization.'
      : 'A Voxel/NFT/digital asset may help fund a property goal after real proceeds settle, but the asset itself is not real-estate equity.',
  };
}

export function evaluatePropertyCashAction(input = {}) {
  const settledCashCents = cents(input.settledCashCents, 'Settled cash', { min: 0 });
  const pendingCashCents = cents(input.pendingCashCents, 'Pending cash', { min: 0 });
  const projectedIncomeCents = cents(input.projectedIncomeCents, 'Projected income', { min: 0 });
  const requestedCents = cents(input.requestedCents, 'Requested amount', { min: 0 });
  const action = clean(input.action).toLowerCase();
  const providerWithdrawalsReady = input.providerWithdrawalsReady === true;
  const providerReinvestmentReady = input.providerReinvestmentReady === true;
  const userOptIn = input.userOptIn === true;

  if (!['withdraw', 'reinvest'].includes(action)) throw new Error('Cash action must be withdraw or reinvest.');
  const withinSettledBalance = requestedCents > 0 && requestedCents <= settledCashCents;
  const canWithdraw = action === 'withdraw' && withinSettledBalance && providerWithdrawalsReady && userOptIn;
  const canReinvest = action === 'reinvest' && withinSettledBalance && providerReinvestmentReady && userOptIn;

  return {
    action,
    settledCashCents,
    pendingCashCents,
    projectedIncomeCents,
    requestedCents,
    availableNowCents: settledCashCents,
    excludedFromAvailableCents: pendingCashCents + projectedIncomeCents,
    canExecute: canWithdraw || canReinvest,
    canWithdraw,
    canReinvest,
    requiresExplicitUserAuthorization: true,
    projectedProfitSpendable: false,
    profitGuaranteed: false,
    blockers: [
      !withinSettledBalance ? 'requested amount is not available as settled cash' : '',
      !userOptIn ? 'explicit user authorization is required' : '',
      action === 'withdraw' && !providerWithdrawalsReady ? 'provider withdrawal rail is not verified ready' : '',
      action === 'reinvest' && !providerReinvestmentReady ? 'provider reinvestment rail is not verified ready' : '',
    ].filter(Boolean),
    note: 'Only settled, actually available proceeds may be withdrawn or reinvested. Timing, liquidity, taxes, fees, losses, and provider restrictions can apply; profit is never guaranteed.',
  };
}
