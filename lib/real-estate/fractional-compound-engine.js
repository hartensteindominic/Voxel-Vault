export const FRACTIONAL_ENGINE_MODE = 'simulation';
export const LIVE_FRACTIONAL_EXECUTION_ENABLED = false;

export const demoFractionalProperties = [
  { id: 'FRACTIONAL-DEMO-001', label: 'Stabilized rental A', market: 'U.S. demo market A', sharePrice: 45, netYield: 0.072, occupancy: 0.96, liquidityScore: 0.78, operatingRisk: 0.24, eligible: true },
  { id: 'FRACTIONAL-DEMO-002', label: 'Stabilized rental B', market: 'U.S. demo market B', sharePrice: 52, netYield: 0.081, occupancy: 0.94, liquidityScore: 0.72, operatingRisk: 0.29, eligible: true },
  { id: 'FRACTIONAL-DEMO-003', label: 'Small multifamily A', market: 'U.S. demo market C', sharePrice: 38, netYield: 0.067, occupancy: 0.97, liquidityScore: 0.69, operatingRisk: 0.21, eligible: true },
  { id: 'FRACTIONAL-DEMO-004', label: 'Neighborhood rental C', market: 'U.S. demo market D', sharePrice: 61, netYield: 0.075, occupancy: 0.95, liquidityScore: 0.74, operatingRisk: 0.27, eligible: true },
  { id: 'FRACTIONAL-DEMO-005', label: 'Entry rental share', market: 'U.S. demo market E', sharePrice: 29, netYield: 0.063, occupancy: 0.93, liquidityScore: 0.66, operatingRisk: 0.31, eligible: true },
  { id: 'FRACTIONAL-DEMO-006', label: 'Cash-flow rental D', market: 'U.S. demo market F', sharePrice: 41, netYield: 0.077, occupancy: 0.95, liquidityScore: 0.71, operatingRisk: 0.28, eligible: true },
];

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function scoreProperty(property) {
  const yieldScore = clamp(property.netYield / 0.1);
  const occupancyScore = clamp(property.occupancy);
  const liquidityScore = clamp(property.liquidityScore);
  const riskScore = 1 - clamp(property.operatingRisk);
  const affordabilityScore = clamp(1 - property.sharePrice / 100);
  return yieldScore * 0.35 + occupancyScore * 0.2 + liquidityScore * 0.15 + riskScore * 0.2 + affordabilityScore * 0.1;
}

function purchaseCost(property, feeRate) {
  return property.sharePrice * (1 + feeRate);
}

function portfolioValue(positions, catalog) {
  return Object.entries(positions).reduce((sum, [id, shares]) => {
    const property = catalog.find((item) => item.id === id);
    return sum + (property ? property.sharePrice * shares : 0);
  }, 0);
}

function annualNetIncome(positions, catalog) {
  return Object.entries(positions).reduce((sum, [id, shares]) => {
    const property = catalog.find((item) => item.id === id);
    return sum + (property ? property.sharePrice * shares * property.netYield : 0);
  }, 0);
}

function pickNextProperty({ catalog, positions, investableBase, cash, feeRate, maxPropertyWeight }) {
  const currentValue = portfolioValue(positions, catalog);
  return catalog
    .filter((property) => property.eligible)
    .filter((property) => purchaseCost(property, feeRate) <= cash + 1e-9)
    .map((property) => {
      const existingValue = (positions[property.id] || 0) * property.sharePrice;
      const postPurchaseValue = existingValue + property.sharePrice;
      const concentrationBase = Math.max(investableBase, currentValue + property.sharePrice, 1);
      return { property, score: scoreProperty(property), allowed: postPurchaseValue / concentrationBase <= maxPropertyWeight + 1e-9 };
    })
    .filter((item) => item.allowed)
    .sort((a, b) => b.score - a.score || a.property.sharePrice - b.property.sharePrice)[0]?.property || null;
}

export function buildFractionalPlan({
  capital = 1000,
  catalog = demoFractionalProperties,
  reserveRate = 0.1,
  feeRate = 0.025,
  maxPropertyWeight = 0.25,
} = {}) {
  const startingCapital = Math.max(0, Number(capital) || 0);
  const protectedReserve = startingCapital * clamp(reserveRate, 0, 0.5);
  const investableCapital = startingCapital - protectedReserve;
  let cash = investableCapital;
  const positions = {};
  let feesPaid = 0;

  while (cash > 0) {
    const next = pickNextProperty({ catalog, positions, investableBase: investableCapital, cash, feeRate, maxPropertyWeight });
    if (!next) break;
    const cost = purchaseCost(next, feeRate);
    positions[next.id] = (positions[next.id] || 0) + 1;
    cash -= cost;
    feesPaid += next.sharePrice * feeRate;
  }

  const investedValue = portfolioValue(positions, catalog);
  const annualIncome = annualNetIncome(positions, catalog);
  const holdings = catalog
    .filter((property) => positions[property.id])
    .map((property) => ({ ...property, shares: positions[property.id], positionValue: positions[property.id] * property.sharePrice }));

  return {
    mode: FRACTIONAL_ENGINE_MODE,
    liveExecutionEnabled: LIVE_FRACTIONAL_EXECUTION_ENABLED,
    startingCapital,
    protectedReserve,
    investableCapital,
    investedValue,
    feesPaid,
    reinvestmentWallet: Math.max(0, cash),
    annualNetIncome: annualIncome,
    monthlyNetIncome: annualIncome / 12,
    dailyNetIncome: annualIncome / 365,
    holdings,
    positions,
  };
}

export function simulateDailyAutoCompound({
  capital = 1000,
  years = 5,
  catalog = demoFractionalProperties,
  reserveRate = 0.1,
  feeRate = 0.025,
  maxPropertyWeight = 0.35,
} = {}) {
  const initial = buildFractionalPlan({ capital, catalog, reserveRate, feeRate, maxPropertyWeight: 0.25 });
  const positions = { ...initial.positions };
  let reinvestmentWallet = initial.reinvestmentWallet;
  let totalFees = initial.feesPaid;
  let autoPurchases = 0;
  const timeline = [];
  const totalDays = Math.max(1, Math.round((Number(years) || 1) * 365));

  for (let day = 1; day <= totalDays; day += 1) {
    reinvestmentWallet += annualNetIncome(positions, catalog) / 365;

    while (true) {
      const next = pickNextProperty({
        catalog,
        positions,
        investableBase: Math.max(initial.investedValue + reinvestmentWallet, 1),
        cash: reinvestmentWallet,
        feeRate,
        maxPropertyWeight,
      });
      if (!next) break;
      const cost = purchaseCost(next, feeRate);
      positions[next.id] = (positions[next.id] || 0) + 1;
      reinvestmentWallet -= cost;
      totalFees += next.sharePrice * feeRate;
      autoPurchases += 1;
    }

    if (day % 365 === 0 || day === totalDays) {
      const investedValue = portfolioValue(positions, catalog);
      const annualIncome = annualNetIncome(positions, catalog);
      timeline.push({
        year: Math.ceil(day / 365),
        investedValue,
        annualNetIncome: annualIncome,
        reinvestmentWallet,
        autoPurchases,
        totalEconomicValue: initial.protectedReserve + investedValue + reinvestmentWallet,
      });
    }
  }

  const holdings = catalog
    .filter((property) => positions[property.id])
    .map((property) => ({ ...property, shares: positions[property.id], positionValue: positions[property.id] * property.sharePrice }));

  return {
    mode: FRACTIONAL_ENGINE_MODE,
    liveExecutionEnabled: LIVE_FRACTIONAL_EXECUTION_ENABLED,
    protectedReserve: initial.protectedReserve,
    holdings,
    positions,
    reinvestmentWallet,
    autoPurchases,
    totalFees,
    timeline,
  };
}
