const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const money = (value) => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
const rate = (value) => clamp(Number(value) || 0, 0, 1);

export const LIVE_ACQUISITION_EXECUTION_READY = false;
export const LIVE_TOKENIZED_SECURITY_TRADING_READY = false;

export const acquisitionPolicy = Object.freeze({
  version: '2026-08-acquisition-v1',
  rankingGoal: 'cheapest-profitable-verified-property',
  livePropertyExecutionReady: LIVE_ACQUISITION_EXECUTION_READY,
  liveTokenizedSecurityTradingReady: LIVE_TOKENIZED_SECURITY_TRADING_READY,
  allowedModes: ['research', 'simulation', 'diligence'],
});

export function calculatePropertyEconomics(candidate = {}) {
  const purchasePrice = money(candidate.purchasePrice);
  const closingCosts = money(candidate.closingCosts);
  const immediateRepairs = money(candidate.immediateRepairs);
  const backTaxes = money(candidate.backTaxes);
  const initialReserve = money(candidate.initialReserve);
  const monthlyRent = money(candidate.monthlyRent);
  const annualPropertyTax = money(candidate.annualPropertyTax);
  const annualInsurance = money(candidate.annualInsurance);
  const monthlyHoa = money(candidate.monthlyHoa);
  const monthlyUtilities = money(candidate.monthlyUtilities);
  const managementRate = rate(candidate.managementRate);
  const vacancyRate = rate(candidate.vacancyRate);
  const maintenanceRate = rate(candidate.maintenanceRate);

  const totalBasis = purchasePrice + closingCosts + immediateRepairs + backTaxes + initialReserve;
  const monthlyPropertyTax = annualPropertyTax / 12;
  const monthlyInsurance = annualInsurance / 12;
  const management = monthlyRent * managementRate;
  const vacancyReserve = monthlyRent * vacancyRate;
  const maintenanceReserve = monthlyRent * maintenanceRate;
  const monthlyOperatingExpenses = monthlyPropertyTax + monthlyInsurance + monthlyHoa + monthlyUtilities + management + vacancyReserve + maintenanceReserve;
  const monthlyNet = monthlyRent - monthlyOperatingExpenses;
  const annualNet = monthlyNet * 12;
  const grossYield = totalBasis > 0 ? (monthlyRent * 12) / totalBasis : 0;
  const modeledNetYield = totalBasis > 0 ? annualNet / totalBasis : 0;
  const breakEvenOccupancy = monthlyRent > 0 ? clamp(monthlyOperatingExpenses / monthlyRent, 0, 2) : 2;

  return {
    purchasePrice,
    totalBasis,
    monthlyRent,
    monthlyOperatingExpenses,
    monthlyNet,
    annualNet,
    grossYield,
    modeledNetYield,
    breakEvenOccupancy,
  };
}

const hardDiligenceGates = [
  ['titleVerified', 'Title not verified'],
  ['liensCleared', 'Liens/restrictions not cleared'],
  ['taxesCurrent', 'Property taxes not confirmed current'],
  ['habitable', 'Habitability not confirmed'],
  ['rentalLegal', 'Rental legality not confirmed'],
  ['insuranceAvailable', 'Insurance availability not confirmed'],
];

export function evaluatePropertyCandidate(candidate = {}) {
  const economics = calculatePropertyEconomics(candidate);
  const failedHardGates = hardDiligenceGates
    .filter(([key]) => candidate[key] !== true)
    .map(([, label]) => label);

  const warnings = [];
  if (!candidate.inspectionComplete) warnings.push('Independent inspection incomplete');
  if (!candidate.marketRentVerified) warnings.push('Market rent not independently verified');
  if (!candidate.propertyManagerConfirmed) warnings.push('Property-management path not confirmed');
  if (!candidate.floodRiskReviewed) warnings.push('Flood/environmental risk not reviewed');
  if (!candidate.utilityArrearsReviewed) warnings.push('Utility arrears not reviewed');
  if (economics.monthlyNet <= 0) warnings.push('Modeled monthly net income is not positive');

  const affordability = clamp(1 - economics.totalBasis / 100000, 0, 1);
  const yieldScore = clamp(economics.modeledNetYield / 0.12, 0, 1);
  const diligencePassed = hardDiligenceGates.length - failedHardGates.length;
  const diligenceScore = diligencePassed / hardDiligenceGates.length;
  const documentationChecks = [
    candidate.inspectionComplete,
    candidate.marketRentVerified,
    candidate.propertyManagerConfirmed,
    candidate.floodRiskReviewed,
    candidate.utilityArrearsReviewed,
  ].filter(Boolean).length / 5;

  let score = Math.round(
    affordability * 25 +
    yieldScore * 35 +
    diligenceScore * 25 +
    documentationChecks * 15
  );

  if (economics.monthlyNet <= 0) score = Math.min(score, 35);
  if (failedHardGates.length) score = Math.min(score, 49);

  const eligibleForHumanReview = failedHardGates.length === 0 && economics.monthlyNet > 0;
  const status = eligibleForHumanReview ? (warnings.length ? 'diligence' : 'review-ready') : 'reject';

  return {
    id: String(candidate.id || ''),
    label: String(candidate.label || 'Property candidate'),
    location: String(candidate.location || 'Unknown'),
    economics,
    score,
    status,
    failedHardGates,
    warnings,
    eligibleForHumanReview,
    executable: false,
    executionReason: 'Property purchases require a real title/closing workflow and explicit human authorization; V1 is analysis-only.',
  };
}

export function rankPropertyCandidates(candidates = []) {
  return candidates
    .map(evaluatePropertyCandidate)
    .sort((a, b) => {
      if (a.eligibleForHumanReview !== b.eligibleForHumanReview) return a.eligibleForHumanReview ? -1 : 1;
      if (b.score !== a.score) return b.score - a.score;
      return a.economics.totalBasis - b.economics.totalBasis;
    });
}

export function evaluateTokenizedRealEstateAccess(env = {}) {
  const providerContracted = env.REAL_ESTATE_SECURITIES_PROVIDER_CONTRACTED === 'true';
  const providerApiVerified = env.REAL_ESTATE_SECURITIES_PROVIDER_API_VERIFIED === 'true';
  const investorEligibilityFlowVerified = env.REAL_ESTATE_SECURITIES_KYC_ELIGIBILITY_VERIFIED === 'true';
  const custodySettlementVerified = env.REAL_ESTATE_SECURITIES_CUSTODY_SETTLEMENT_VERIFIED === 'true';
  const explicitLiveFlag = env.REAL_ESTATE_TOKENIZED_TRADING_ENABLED === 'true';
  const missing = [];

  if (!providerContracted) missing.push('regulated provider agreement');
  if (!providerApiVerified) missing.push('official provider integration');
  if (!investorEligibilityFlowVerified) missing.push('KYC/investor eligibility flow');
  if (!custodySettlementVerified) missing.push('custody/settlement flow');

  const liveTradingEnabled = Boolean(
    explicitLiveFlag &&
    missing.length === 0 &&
    LIVE_TOKENIZED_SECURITY_TRADING_READY
  );

  return {
    providerContracted,
    providerApiVerified,
    investorEligibilityFlowVerified,
    custodySettlementVerified,
    explicitLiveFlag,
    liveTradingEnabled,
    missing,
    mode: liveTradingEnabled ? 'regulated-provider-execution' : 'research-only',
  };
}

export function buildCapitalLadder({ tokenizedValue = 0, cash = 0, propertyEquity = 0 } = {}) {
  const safeTokenizedValue = money(tokenizedValue);
  const safeCash = money(cash);
  const safePropertyEquity = money(propertyEquity);
  const total = safeTokenizedValue + safeCash + safePropertyEquity;

  return {
    tokenizedValue: safeTokenizedValue,
    cash: safeCash,
    propertyEquity: safePropertyEquity,
    total,
    stages: [
      { key: 'tokenized', label: 'Regulated tokenized real estate', amount: safeTokenizedValue },
      { key: 'cash', label: 'Acquisition cash reserve', amount: safeCash },
      { key: 'direct', label: 'Direct property equity', amount: safePropertyEquity },
    ],
  };
}
