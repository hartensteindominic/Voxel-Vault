export const ASSET_ENGINE_MODE = 'simulation';
export const LIVE_ACQUISITION_ENABLED = false;

export const demoAssetCatalog = [
  {
    id: 'LAND-DEMO-001',
    assetClass: 'land',
    label: 'Small titled parcel',
    market: 'Demo Market A',
    country: 'Demo jurisdiction',
    acquisitionCost: 1800,
    monthlyGrossRent: 55,
    monthlyOperatingCost: 12,
    reserveRate: 0.12,
    expectedOccupancy: 0.9,
    legalStatus: 'eligible',
    titleStatus: 'verified-demo',
    liquidityScore: 0.48,
    operatingRisk: 0.46,
  },
  {
    id: 'PARKING-DEMO-001',
    assetClass: 'parking',
    label: 'Parking-space lease right',
    market: 'Demo Market B',
    country: 'Demo jurisdiction',
    acquisitionCost: 4200,
    monthlyGrossRent: 115,
    monthlyOperatingCost: 16,
    reserveRate: 0.1,
    expectedOccupancy: 0.94,
    legalStatus: 'eligible',
    titleStatus: 'verified-demo',
    liquidityScore: 0.7,
    operatingRisk: 0.27,
  },
  {
    id: 'STORAGE-DEMO-001',
    assetClass: 'storage',
    label: 'Micro-storage unit',
    market: 'Demo Market C',
    country: 'Demo jurisdiction',
    acquisitionCost: 7600,
    monthlyGrossRent: 215,
    monthlyOperatingCost: 38,
    reserveRate: 0.12,
    expectedOccupancy: 0.92,
    legalStatus: 'eligible',
    titleStatus: 'verified-demo',
    liquidityScore: 0.68,
    operatingRisk: 0.25,
  },
  {
    id: 'HOME-DEMO-001',
    assetClass: 'real-estate',
    label: 'Entry-level rental home',
    market: 'Demo Market D',
    country: 'Demo jurisdiction',
    acquisitionCost: 24000,
    monthlyGrossRent: 390,
    monthlyOperatingCost: 125,
    reserveRate: 0.15,
    expectedOccupancy: 0.93,
    legalStatus: 'review',
    titleStatus: 'review-required',
    liquidityScore: 0.58,
    operatingRisk: 0.34,
  },
  {
    id: 'SCOOTER-DEMO-001',
    assetClass: 'mobility',
    label: 'Shared scooter fleet unit',
    market: 'Future partner adapter',
    country: 'Partner jurisdiction',
    acquisitionCost: 900,
    monthlyGrossRent: 125,
    monthlyOperatingCost: 62,
    reserveRate: 0.2,
    expectedOccupancy: 0.7,
    legalStatus: 'blocked',
    titleStatus: 'partner-not-connected',
    liquidityScore: 0.35,
    operatingRisk: 0.62,
  },
];

export const futureAssetAdapters = [
  { id: 'real-estate', label: 'Homes + buildings + land', status: 'pilot' },
  { id: 'parking', label: 'Parking + garages', status: 'simulation' },
  { id: 'storage', label: 'Storage + lockers', status: 'simulation' },
  { id: 'mobility', label: 'Scooters + bikes + vehicle fleets', status: 'future-partner' },
  { id: 'equipment', label: 'Tools + machinery + equipment', status: 'future-partner' },
  { id: 'space', label: 'Desks + rooms + rentable space', status: 'future-partner' },
];

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

export function assetEconomics(asset) {
  const effectiveGrossAnnual = asset.monthlyGrossRent * 12 * clamp(asset.expectedOccupancy);
  const operatingAnnual = asset.monthlyOperatingCost * 12;
  const beforeReserve = Math.max(0, effectiveGrossAnnual - operatingAnnual);
  const reserve = beforeReserve * clamp(asset.reserveRate);
  const netAnnual = Math.max(0, beforeReserve - reserve);
  const netYield = asset.acquisitionCost > 0 ? netAnnual / asset.acquisitionCost : 0;
  const monthlyNet = netAnnual / 12;
  return { effectiveGrossAnnual, operatingAnnual, reserve, netAnnual, netYield, monthlyNet };
}

export function scoreAsset(asset) {
  const economics = assetEconomics(asset);
  const priceEfficiency = clamp(1 - asset.acquisitionCost / 50000);
  const yieldScore = clamp(economics.netYield / 0.15);
  const occupancyScore = clamp(asset.expectedOccupancy);
  const liquidityScore = clamp(asset.liquidityScore);
  const riskScore = 1 - clamp(asset.operatingRisk);
  const legalScore = asset.legalStatus === 'eligible' ? 1 : 0;

  const score = (
    yieldScore * 0.35 +
    priceEfficiency * 0.2 +
    occupancyScore * 0.15 +
    liquidityScore * 0.1 +
    riskScore * 0.1 +
    legalScore * 0.1
  ) * legalScore;

  return { ...economics, score };
}

export function rankAssets(catalog = demoAssetCatalog, capital = 0) {
  return catalog
    .map((asset) => ({ ...asset, ...scoreAsset(asset) }))
    .filter((asset) => asset.legalStatus === 'eligible' && asset.acquisitionCost <= capital)
    .sort((a, b) => b.score - a.score || a.acquisitionCost - b.acquisitionCost);
}

export function buildAcquisitionPlan({ capital, catalog = demoAssetCatalog, reserveFloor = 0.1 } = {}) {
  const startingCapital = Math.max(0, Number(capital) || 0);
  const protectedReserve = startingCapital * clamp(reserveFloor, 0, 0.5);
  let deployable = Math.max(0, startingCapital - protectedReserve);
  const purchases = [];
  const workingCatalog = [...catalog];

  while (deployable > 0) {
    const ranked = rankAssets(workingCatalog, deployable);
    const next = ranked[0];
    if (!next) break;
    purchases.push(next);
    deployable -= next.acquisitionCost;
    const index = workingCatalog.findIndex((asset) => asset.id === next.id);
    if (index >= 0) workingCatalog.splice(index, 1);
  }

  const annualNetRent = purchases.reduce((sum, asset) => sum + asset.netAnnual, 0);
  const monthlyNetRent = annualNetRent / 12;
  const spent = purchases.reduce((sum, asset) => sum + asset.acquisitionCost, 0);

  return {
    mode: ASSET_ENGINE_MODE,
    liveAcquisitionEnabled: LIVE_ACQUISITION_ENABLED,
    startingCapital,
    protectedReserve,
    deployableCapital: startingCapital - protectedReserve,
    spent,
    cashRemaining: startingCapital - protectedReserve - spent,
    purchases,
    annualNetRent,
    monthlyNetRent,
  };
}

export function simulateReinvestment({ capital, years = 10, catalog = demoAssetCatalog } = {}) {
  let cash = Math.max(0, Number(capital) || 0);
  const timeline = [];
  const owned = [];

  for (let year = 1; year <= Math.max(1, Number(years) || 1); year += 1) {
    const eligibleCatalog = catalog.filter((asset) => !owned.some((item) => item.id === asset.id));
    const plan = buildAcquisitionPlan({ capital: cash, catalog: eligibleCatalog, reserveFloor: 0.1 });
    owned.push(...plan.purchases);
    const annualNetRent = owned.reduce((sum, asset) => sum + assetEconomics(asset).netAnnual, 0);
    cash = plan.protectedReserve + plan.cashRemaining + annualNetRent;

    timeline.push({
      year,
      ownedCount: owned.length,
      acquired: plan.purchases.map((asset) => asset.id),
      annualNetRent,
      endingCash: cash,
    });
  }

  return { mode: ASSET_ENGINE_MODE, owned, timeline };
}
