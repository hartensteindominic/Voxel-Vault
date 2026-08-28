const POSITION_EPSILON = 1e-12;

function clean(value) {
  return String(value || '').trim();
}

function amount(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new Error(`${label} must be a non-negative number.`);
  }
  return number;
}

export function reconcileDigitalReitPosition({ stockId, symbol, previousAmount, portfolio = [] } = {}) {
  const requestedStockId = clean(stockId);
  if (!requestedStockId) throw new Error('A Dinari stock_id is required for reconciliation.');

  const requestedSymbol = clean(symbol).toUpperCase();
  const before = amount(previousAmount ?? 0, 'Previous position amount');
  const positions = Array.isArray(portfolio) ? portfolio : [];

  const matched = positions.find((position = {}) => clean(position.stockId) === requestedStockId)
    || (requestedSymbol
      ? positions.find((position = {}) => clean(position.symbol).toUpperCase() === requestedSymbol)
      : null);

  const current = matched ? amount(matched.amount ?? 0, 'Provider position amount') : 0;
  const rawIncrease = current - before;
  const confirmed = rawIncrease > POSITION_EPSILON;

  return {
    stockId: requestedStockId,
    symbol: clean(matched?.symbol || requestedSymbol).toUpperCase(),
    previousAmount: before,
    currentAmount: current,
    increase: confirmed ? rawIncrease : 0,
    confirmed,
    source: 'provider-portfolio',
  };
}
