export const PROPERTY_FINANCE_VERSION = '1.0.0';
export const DEFAULT_PROPERTY_UNDERWRITE_PRICE_ATOMIC = '50000'; // 0.05 USDC

export type PropertyAssetType = 'real-estate' | 'digital-property';

export type PropertyUnderwriteInput = {
  assetType?: unknown;
  purchasePriceUsd?: unknown;
  monthlyIncomeUsd?: unknown;
  monthlyOperatingExpensesUsd?: unknown;
  annualTaxesUsd?: unknown;
  annualInsuranceUsd?: unknown;
  annualOtherExpensesUsd?: unknown;
  vacancyPct?: unknown;
  loanAmountUsd?: unknown;
  annualInterestRatePct?: unknown;
  loanTermYears?: unknown;
  cashInvestedUsd?: unknown;
  closingCostsUsd?: unknown;
};

function clean(value: unknown, max = 80) {
  return String(value ?? '').trim().slice(0, max);
}

function finiteNumber(value: unknown, label: string, min: number, max: number, fallback?: number) {
  if ((value === undefined || value === null || value === '') && fallback !== undefined) return fallback;
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    throw new Error(`${label} must be between ${min} and ${max}.`);
  }
  return number;
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function roundPct(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function safeRatio(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : 0;
}

function monthlyPayment(principal: number, annualRatePct: number, years: number) {
  if (principal <= 0) return 0;
  const months = Math.max(1, Math.round(years * 12));
  const monthlyRate = annualRatePct / 100 / 12;
  if (monthlyRate === 0) return principal / months;
  const factor = Math.pow(1 + monthlyRate, months);
  return principal * ((monthlyRate * factor) / (factor - 1));
}

function maxPrincipalForMonthlyPayment(payment: number, annualRatePct: number, years: number) {
  if (payment <= 0) return 0;
  const months = Math.max(1, Math.round(years * 12));
  const monthlyRate = annualRatePct / 100 / 12;
  if (monthlyRate === 0) return payment * months;
  const factor = Math.pow(1 + monthlyRate, months);
  const paymentFactor = (monthlyRate * factor) / (factor - 1);
  return payment / paymentFactor;
}

export function propertyUnderwritePriceAtomic() {
  const raw = clean(process.env.X402_PROPERTY_UNDERWRITE_PRICE_ATOMIC || DEFAULT_PROPERTY_UNDERWRITE_PRICE_ATOMIC, 30);
  return /^\d+$/.test(raw) && BigInt(raw) > 0n ? raw : DEFAULT_PROPERTY_UNDERWRITE_PRICE_ATOMIC;
}

export function underwriteProperty(input: PropertyUnderwriteInput) {
  const assetType: PropertyAssetType = clean(input.assetType, 32) === 'digital-property' ? 'digital-property' : 'real-estate';
  const purchasePriceUsd = finiteNumber(input.purchasePriceUsd, 'purchasePriceUsd', 100, 1_000_000_000);
  const monthlyIncomeUsd = finiteNumber(input.monthlyIncomeUsd, 'monthlyIncomeUsd', 0, 100_000_000);
  const monthlyOperatingExpensesUsd = finiteNumber(input.monthlyOperatingExpensesUsd, 'monthlyOperatingExpensesUsd', 0, 100_000_000, 0);
  const annualTaxesUsd = finiteNumber(input.annualTaxesUsd, 'annualTaxesUsd', 0, 100_000_000, 0);
  const annualInsuranceUsd = finiteNumber(input.annualInsuranceUsd, 'annualInsuranceUsd', 0, 100_000_000, 0);
  const annualOtherExpensesUsd = finiteNumber(input.annualOtherExpensesUsd, 'annualOtherExpensesUsd', 0, 100_000_000, 0);
  const vacancyPct = finiteNumber(input.vacancyPct, 'vacancyPct', 0, 100, assetType === 'digital-property' ? 10 : 5);
  const loanAmountUsd = finiteNumber(input.loanAmountUsd, 'loanAmountUsd', 0, 1_000_000_000, 0);
  const annualInterestRatePct = finiteNumber(input.annualInterestRatePct, 'annualInterestRatePct', 0, 50, 7);
  const loanTermYears = finiteNumber(input.loanTermYears, 'loanTermYears', 1, 50, 30);
  const closingCostsUsd = finiteNumber(input.closingCostsUsd, 'closingCostsUsd', 0, 100_000_000, 0);
  const inferredCash = Math.max(0, purchasePriceUsd - loanAmountUsd + closingCostsUsd);
  const cashInvestedUsd = finiteNumber(input.cashInvestedUsd, 'cashInvestedUsd', 0, 1_000_000_000, inferredCash);

  const annualGrossIncome = monthlyIncomeUsd * 12;
  const effectiveAnnualIncome = annualGrossIncome * (1 - vacancyPct / 100);
  const annualOperatingExpenses = monthlyOperatingExpensesUsd * 12 + annualTaxesUsd + annualInsuranceUsd + annualOtherExpensesUsd;
  const noiUsd = effectiveAnnualIncome - annualOperatingExpenses;
  const monthlyDebtServiceUsd = monthlyPayment(loanAmountUsd, annualInterestRatePct, loanTermYears);
  const annualDebtServiceUsd = monthlyDebtServiceUsd * 12;
  const annualCashFlowUsd = noiUsd - annualDebtServiceUsd;
  const ltvPct = safeRatio(loanAmountUsd, purchasePriceUsd) * 100;
  const capRatePct = safeRatio(noiUsd, purchasePriceUsd) * 100;
  const dscr = annualDebtServiceUsd > 0 ? noiUsd / annualDebtServiceUsd : null;
  const cashOnCashPct = cashInvestedUsd > 0 ? annualCashFlowUsd / cashInvestedUsd * 100 : null;
  const breakEvenOccupancyPct = annualGrossIncome > 0
    ? Math.min(100, Math.max(0, (annualOperatingExpenses + annualDebtServiceUsd) / annualGrossIncome * 100))
    : 100;

  const policy = assetType === 'real-estate'
    ? { maxLtvPct: 70, minDscr: 1.25, label: 'conservative real-estate screen' }
    : { maxLtvPct: 40, minDscr: 1.5, label: 'high-volatility digital-property screen' };

  const maxLoanByLtv = purchasePriceUsd * (policy.maxLtvPct / 100);
  const monthlyDebtCapacity = Math.max(0, noiUsd / policy.minDscr / 12);
  const maxLoanByDscr = maxPrincipalForMonthlyPayment(monthlyDebtCapacity, annualInterestRatePct, loanTermYears);
  const suggestedMaxLoanUsd = Math.max(0, Math.min(maxLoanByLtv, maxLoanByDscr));

  const stressVacancyPct = Math.min(70, vacancyPct + 10);
  const stressAnnualIncome = annualGrossIncome * 0.85 * (1 - stressVacancyPct / 100);
  const stressOperatingExpenses = annualOperatingExpenses * 1.15;
  const stressNoi = stressAnnualIncome - stressOperatingExpenses;
  const stressMonthlyDebt = monthlyPayment(loanAmountUsd, Math.min(50, annualInterestRatePct + 2), loanTermYears);
  const stressAnnualDebt = stressMonthlyDebt * 12;
  const stressDscr = stressAnnualDebt > 0 ? stressNoi / stressAnnualDebt : null;
  const stressCashFlow = stressNoi - stressAnnualDebt;

  const dscrPass = dscr === null || dscr >= policy.minDscr;
  const ltvPass = ltvPct <= policy.maxLtvPct;
  const cashFlowPass = annualCashFlowUsd >= 0;
  const stressPass = stressDscr === null || stressDscr >= 1;
  const passed = [dscrPass, ltvPass, cashFlowPass, stressPass].filter(Boolean).length;
  const riskBand = passed === 4 ? 'LOWER' : passed >= 2 ? 'MODERATE' : 'HIGH';

  return {
    version: PROPERTY_FINANCE_VERSION,
    assetType,
    input: {
      purchasePriceUsd: roundMoney(purchasePriceUsd),
      monthlyIncomeUsd: roundMoney(monthlyIncomeUsd),
      monthlyOperatingExpensesUsd: roundMoney(monthlyOperatingExpensesUsd),
      annualTaxesUsd: roundMoney(annualTaxesUsd),
      annualInsuranceUsd: roundMoney(annualInsuranceUsd),
      annualOtherExpensesUsd: roundMoney(annualOtherExpensesUsd),
      vacancyPct: roundPct(vacancyPct),
      loanAmountUsd: roundMoney(loanAmountUsd),
      annualInterestRatePct: roundPct(annualInterestRatePct),
      loanTermYears,
      cashInvestedUsd: roundMoney(cashInvestedUsd),
      closingCostsUsd: roundMoney(closingCostsUsd),
    },
    metrics: {
      effectiveAnnualIncomeUsd: roundMoney(effectiveAnnualIncome),
      annualOperatingExpensesUsd: roundMoney(annualOperatingExpenses),
      noiUsd: roundMoney(noiUsd),
      monthlyDebtServiceUsd: roundMoney(monthlyDebtServiceUsd),
      annualDebtServiceUsd: roundMoney(annualDebtServiceUsd),
      annualCashFlowUsd: roundMoney(annualCashFlowUsd),
      ltvPct: roundPct(ltvPct),
      capRatePct: roundPct(capRatePct),
      dscr: dscr === null ? null : Math.round(dscr * 100) / 100,
      cashOnCashPct: cashOnCashPct === null ? null : roundPct(cashOnCashPct),
      breakEvenOccupancyPct: roundPct(breakEvenOccupancyPct),
    },
    conservativeScreen: {
      ...policy,
      suggestedMaxLoanUsd: roundMoney(suggestedMaxLoanUsd),
      maxLoanByLtvUsd: roundMoney(maxLoanByLtv),
      maxLoanByDscrUsd: roundMoney(maxLoanByDscr),
      checks: {
        ltvPass,
        dscrPass,
        cashFlowPass,
        stressPass,
      },
      riskBand,
    },
    stressCase: {
      assumptions: {
        incomeHaircutPct: 15,
        additionalVacancyPoints: 10,
        operatingExpenseIncreasePct: 15,
        interestRateIncreasePoints: 2,
      },
      noiUsd: roundMoney(stressNoi),
      annualCashFlowUsd: roundMoney(stressCashFlow),
      dscr: stressDscr === null ? null : Math.round(stressDscr * 100) / 100,
    },
    notices: [
      'This is a deterministic screening report based only on user-supplied figures; it is not an appraisal, loan approval, investment recommendation, or promise of profit.',
      'Property title, liens, zoning, taxes, insurance, legal rights, token rights, liquidity, counterparties, and regulatory eligibility are not verified by this calculation.',
      'Digital-property income and resale values can be especially volatile; the digital-property policy therefore uses a lower LTV ceiling and higher DSCR floor.',
      'No customer deposits, borrowing, pooled investment funds, or property purchases occur through this endpoint.',
    ],
  };
}
