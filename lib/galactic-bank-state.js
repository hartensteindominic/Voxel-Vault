const STORAGE_PREFIX = 'galactic-trust:demo-bank:';

export const DEFAULT_GALACTIC_BANK_STATE = Object.freeze({
  checking: 15230.45,
  savings: 9120.27,
  stars: 2450,
  blueFrozen: false,
  pinkFrozen: false,
  transactions: [
    { id: 1, icon: 'a', name: 'Amazon.com', category: 'Shopping', amount: -89.32, date: 'Today', tone: 'dark' },
    { id: 2, icon: '●', name: 'Spotify Premium', category: 'Entertainment', amount: -11.99, date: 'May 18', tone: 'green' },
    { id: 3, icon: '↓', name: 'Transfer from Alex', category: 'Incoming Transfer', amount: 200, date: 'May 18', tone: 'purple' },
    { id: 4, icon: '☕', name: 'Star Coffee', category: 'Food & Drinks', amount: -6.45, date: 'May 17', tone: 'sage' },
    { id: 5, icon: '▰', name: 'Payroll Direct Deposit', category: 'Income', amount: 2850, date: 'May 15', tone: 'blue' },
  ],
  cryptoAssets: [
    { symbol: 'BTC', name: 'Bitcoin', price: 68240.18, holding: 0.0142 },
    { symbol: 'ETH', name: 'Ethereum', price: 3648.72, holding: 0.63 },
    { symbol: 'USDC', name: 'USD Coin', price: 1, holding: 425.5 },
  ],
});

function finite(value, fallback, min = -1_000_000_000, max = 1_000_000_000) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function safeText(value, fallback = '', max = 120) {
  return String(value ?? fallback).slice(0, max);
}

function sanitizeTransactions(input) {
  if (!Array.isArray(input)) return DEFAULT_GALACTIC_BANK_STATE.transactions.map((item) => ({ ...item }));
  return input.slice(0, 100).map((item, index) => ({
    id: safeText(item?.id ?? `${Date.now()}-${index}`, `${Date.now()}-${index}`, 80),
    icon: safeText(item?.icon, '•', 4),
    name: safeText(item?.name, 'Galactic activity', 80),
    category: safeText(item?.category, 'Demo Activity', 60),
    amount: finite(item?.amount, 0, -100000, 100000),
    date: safeText(item?.date, 'Recently', 40),
    tone: safeText(item?.tone, 'blue', 20),
  }));
}

function sanitizeCrypto(input) {
  const fallback = DEFAULT_GALACTIC_BANK_STATE.cryptoAssets;
  const source = Array.isArray(input) ? input : fallback;
  const allowed = new Map(fallback.map((asset) => [asset.symbol, asset]));
  return source
    .filter((asset) => allowed.has(String(asset?.symbol || '').toUpperCase()))
    .slice(0, 3)
    .map((asset) => {
      const symbol = String(asset.symbol).toUpperCase();
      const base = allowed.get(symbol);
      return {
        symbol,
        name: base.name,
        price: finite(asset.price, base.price, 0.000001, 10_000_000),
        holding: finite(asset.holding, base.holding, 0, 10_000_000),
      };
    });
}

export function sanitizeGalacticBankState(input = {}) {
  return {
    checking: finite(input.checking, DEFAULT_GALACTIC_BANK_STATE.checking, 0, 10_000_000),
    savings: finite(input.savings, DEFAULT_GALACTIC_BANK_STATE.savings, 0, 10_000_000),
    stars: Math.round(finite(input.stars, DEFAULT_GALACTIC_BANK_STATE.stars, 0, 10_000_000)),
    blueFrozen: Boolean(input.blueFrozen),
    pinkFrozen: Boolean(input.pinkFrozen),
    transactions: sanitizeTransactions(input.transactions),
    cryptoAssets: sanitizeCrypto(input.cryptoAssets),
  };
}

function localKey(userId) {
  return `${STORAGE_PREFIX}${safeText(userId, 'guest', 80)}`;
}

function readLocal(userId) {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(localKey(userId));
    return raw ? sanitizeGalacticBankState(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function writeLocal(userId, state) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(localKey(userId), JSON.stringify(sanitizeGalacticBankState(state)));
  } catch {
    // Local persistence is best-effort; cloud sync can still succeed.
  }
}

function tableUnavailable(error) {
  const code = String(error?.code || '');
  const message = String(error?.message || '').toLowerCase();
  return code === '42P01' || code === 'PGRST205' || message.includes('galactic_bank_demo_state') || message.includes('schema cache');
}

export async function loadGalacticBankState(client, user) {
  const userId = user?.id;
  const local = readLocal(userId);
  if (!client || !userId) return { state: local || sanitizeGalacticBankState(), source: local ? 'device' : 'default', cloudReady: false };

  try {
    const { data, error } = await client
      .from('galactic_bank_demo_state')
      .select('state, updated_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      if (tableUnavailable(error)) return { state: local || sanitizeGalacticBankState(), source: local ? 'device' : 'default', cloudReady: false };
      throw error;
    }

    if (data?.state) {
      const state = sanitizeGalacticBankState(data.state);
      writeLocal(userId, state);
      return { state, source: 'cloud', cloudReady: true, updatedAt: data.updated_at || null };
    }

    const state = local || sanitizeGalacticBankState();
    return { state, source: local ? 'device' : 'default', cloudReady: true };
  } catch (error) {
    return { state: local || sanitizeGalacticBankState(), source: local ? 'device' : 'default', cloudReady: false, error };
  }
}

export async function saveGalacticBankState(client, user, state) {
  const userId = user?.id;
  const safeState = sanitizeGalacticBankState(state);
  writeLocal(userId, safeState);
  if (!client || !userId) return { cloud: false };

  try {
    const { error } = await client
      .from('galactic_bank_demo_state')
      .upsert({ user_id: userId, state: safeState, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    if (error) {
      if (tableUnavailable(error)) return { cloud: false, error };
      throw error;
    }
    return { cloud: true };
  } catch (error) {
    return { cloud: false, error };
  }
}
