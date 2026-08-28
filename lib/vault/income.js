function clean(value) {
  return String(value ?? '').trim();
}

function positive(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function safeDate(value) {
  const text = clean(value);
  if (!text) return '';
  const timestamp = Date.parse(text);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : '';
}

export function normalizeObservedIncome(dividends = [], {
  provider = 'Dinari',
  environment = 'sandbox',
  accountScope = 'user-bound',
} = {}) {
  const providerName = clean(provider || 'Provider');
  const env = clean(environment || 'sandbox').toLowerCase();
  const scope = clean(accountScope || 'user-bound').toLowerCase();

  return (Array.isArray(dividends) ? dividends : [])
    .map((item, index) => {
      const amount = positive(item?.amount);
      const symbol = clean(item?.symbol).toUpperCase();
      const currency = clean(item?.currency || 'USD').toUpperCase();
      const id = clean(item?.id || `${symbol || 'payment'}-${item?.payableDate || index}`);
      const payableDate = safeDate(item?.payableDate);
      const status = clean(item?.status).toUpperCase();
      return {
        id,
        kind: 'security-dividend',
        symbol,
        amount,
        currency,
        payableDate,
        status,
        provider: providerName,
        environment: env,
        accountScope: scope,
        truthLabel: scope === 'user-bound' ? 'USER-BOUND PROVIDER PAYMENT' : 'PROVIDER PAYMENT',
        sourceLabel: `${providerName.toUpperCase()} ${env.toUpperCase()}${scope === 'user-bound' ? ' · USER BOUND' : ''}`,
        note: 'Provider-reported dividend payment associated with a Digital REIT/security position. This is not property rent or a deed-linked distribution.',
      };
    })
    .filter((item) => item.id && item.amount > 0 && item.currency)
    .sort((a, b) => Date.parse(b.payableDate || 0) - Date.parse(a.payableDate || 0));
}

export function summarizeObservedIncome(records = []) {
  const list = Array.isArray(records) ? records : [];
  const totals = new Map();
  for (const record of list) {
    const amount = positive(record?.amount);
    const currency = clean(record?.currency).toUpperCase();
    if (!currency || !amount) continue;
    totals.set(currency, (totals.get(currency) || 0) + amount);
  }

  const currencies = Array.from(totals.entries())
    .map(([currency, amount]) => ({ currency, amount }))
    .sort((a, b) => a.currency.localeCompare(b.currency));

  return {
    count: list.length,
    usdObserved: totals.get('USD') || 0,
    currencyCount: currencies.length,
    currencies,
    latestPayableDate: list[0]?.payableDate || '',
  };
}
