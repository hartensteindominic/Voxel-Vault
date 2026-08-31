import { BankingError } from './banking';

export type CryptoMode = 'demo' | 'partner';
export type CryptoSymbol = 'BTC' | 'ETH' | 'USDC';
export type CryptoSide = 'buy' | 'sell';

export type CryptoAsset = {
  symbol: CryptoSymbol;
  name: string;
  demoPriceUsd: number;
  demoHolding: number;
};

export const CRYPTO_ASSETS: CryptoAsset[] = [
  { symbol: 'BTC', name: 'Bitcoin', demoPriceUsd: 68240.18, demoHolding: 0.0142 },
  { symbol: 'ETH', name: 'Ethereum', demoPriceUsd: 3648.72, demoHolding: 0.63 },
  { symbol: 'USDC', name: 'USD Coin', demoPriceUsd: 1, demoHolding: 425.5 }
];

function mode(): CryptoMode {
  return process.env.CRYPTO_MODE === 'partner' ? 'partner' : 'demo';
}

function config() {
  return {
    gatewayBaseUrl: process.env.CRYPTO_GATEWAY_BASE_URL?.replace(/\/$/, '') || '',
    apiKey: process.env.CRYPTO_GATEWAY_API_KEY || '',
    programId: process.env.CRYPTO_PROGRAM_ID || '',
    providerName: process.env.CRYPTO_PROVIDER_NAME || '',
    disclosure: process.env.CRYPTO_PARTNER_DISCLOSURE || '',
    liveTradingEnabled: process.env.CRYPTO_ENABLE_LIVE_TRADING === 'true'
  };
}

export function cryptoStatus() {
  const currentMode = mode();
  const current = config();
  const partnerConfigured = Boolean(
    current.gatewayBaseUrl &&
    current.apiKey &&
    current.programId &&
    current.providerName
  );

  return {
    mode: currentMode,
    providerName: current.providerName || null,
    partnerConfigured,
    liveTradingEnabled: currentMode === 'partner' && partnerConfigured && current.liveTradingEnabled,
    disclosure: currentMode === 'demo'
      ? 'Crypto trading is in demo mode. Quotes, holdings, buys, and sells are simulated and no real assets are purchased or sold.'
      : (current.disclosure || `Crypto services are provided through ${current.providerName || 'the configured regulated crypto provider'}, subject to eligibility and approved disclosures.`)
  };
}

function requirePartnerConfig() {
  const status = cryptoStatus();
  const current = config();

  if (mode() !== 'partner') {
    throw new BankingError(409, 'CRYPTO_DEMO_MODE', 'Crypto trading is simulated while Galactic Trust is in demo mode.');
  }

  if (!status.partnerConfigured) {
    throw new BankingError(503, 'CRYPTO_PARTNER_NOT_CONFIGURED', 'A crypto trading partner has not been configured yet.');
  }

  if (!current.liveTradingEnabled) {
    throw new BankingError(503, 'CRYPTO_LIVE_TRADING_DISABLED', 'Live crypto trading is disabled until the provider program is approved and explicitly enabled.');
  }

  return current;
}

async function partnerRequest<T>(path: string, init: RequestInit): Promise<T> {
  const current = requirePartnerConfig();
  const response = await fetch(`${current.gatewayBaseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${current.apiKey}`,
      'Content-Type': 'application/json',
      'X-Galactic-Program-Id': current.programId,
      ...(init.headers || {})
    },
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new BankingError(502, 'CRYPTO_PARTNER_ERROR', `Crypto partner gateway returned ${response.status}.`);
  }

  return response.json() as Promise<T>;
}

export function getDemoCryptoPortfolio() {
  return CRYPTO_ASSETS.map((asset) => ({
    ...asset,
    demoValueUsd: Number((asset.demoHolding * asset.demoPriceUsd).toFixed(2))
  }));
}

export async function createCryptoOrder(input: {
  userId: string;
  symbol: CryptoSymbol;
  side: CryptoSide;
  usdAmount: number;
  idempotencyKey: string;
}) {
  const asset = CRYPTO_ASSETS.find((item) => item.symbol === input.symbol);
  if (!asset) {
    throw new BankingError(400, 'UNSUPPORTED_ASSET', 'This crypto asset is not available.');
  }

  if (input.side !== 'buy' && input.side !== 'sell') {
    throw new BankingError(400, 'INVALID_SIDE', 'Crypto order side must be buy or sell.');
  }

  if (!Number.isFinite(input.usdAmount) || input.usdAmount < 1 || input.usdAmount > 10000) {
    throw new BankingError(400, 'INVALID_CRYPTO_AMOUNT', 'Crypto orders must be between $1 and $10,000.');
  }

  if (!/^[a-zA-Z0-9_-]{12,120}$/.test(input.idempotencyKey)) {
    throw new BankingError(400, 'INVALID_IDEMPOTENCY_KEY', 'A valid crypto order idempotency key is required.');
  }

  if (mode() === 'demo') {
    const availableValueUsd = asset.demoHolding * asset.demoPriceUsd;
    if (input.side === 'sell' && input.usdAmount > availableValueUsd + 0.005) {
      throw new BankingError(
        400,
        'INSUFFICIENT_DEMO_CRYPTO',
        `The demo ${asset.symbol} holding is only worth about $${availableValueUsd.toFixed(2)}.`
      );
    }

    const units = input.usdAmount / asset.demoPriceUsd;
    return {
      id: `demo-crypto-${Date.now()}`,
      status: 'simulated',
      side: input.side,
      symbol: input.symbol,
      usdAmount: Number(input.usdAmount.toFixed(2)),
      estimatedUnits: Number(units.toFixed(input.symbol === 'BTC' ? 8 : 6)),
      demoPriceUsd: asset.demoPriceUsd,
      message: `Demo ${input.side} only. No real ${input.symbol} was ${input.side === 'buy' ? 'purchased' : 'sold'}.`
    };
  }

  return partnerRequest('/v1/crypto/orders', {
    method: 'POST',
    headers: { 'Idempotency-Key': input.idempotencyKey },
    body: JSON.stringify({
      userId: input.userId,
      symbol: input.symbol,
      side: input.side,
      usdAmount: Number(input.usdAmount.toFixed(2))
    })
  });
}
