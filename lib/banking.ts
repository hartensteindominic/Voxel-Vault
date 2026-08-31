export type BankingMode = 'demo' | 'partner';

export type BankingAccount = {
  id: string;
  name: string;
  type: 'checking' | 'savings';
  balance: number;
  availableBalance: number;
  last4: string;
  currency: 'USD';
};

export type BankingTransaction = {
  id: string;
  name: string;
  category: string;
  amount: number;
  date: string;
  status: 'posted' | 'pending';
};

export type BankingCard = {
  id: string;
  name: string;
  last4: string;
  network: 'visa' | 'mastercard';
  frozen: boolean;
};

export type BankingSummary = {
  mode: BankingMode;
  customerName: string;
  totalBalance: number;
  accounts: BankingAccount[];
  transactions: BankingTransaction[];
  cards: BankingCard[];
};

export class BankingError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'BankingError';
    this.status = status;
    this.code = code;
  }
}

const DEMO_SUMMARY: BankingSummary = {
  mode: 'demo',
  customerName: 'Nova Star',
  totalBalance: 24350.72,
  accounts: [
    {
      id: 'demo-checking-4532',
      name: 'Checking Account',
      type: 'checking',
      balance: 15230.45,
      availableBalance: 15230.45,
      last4: '4532',
      currency: 'USD'
    },
    {
      id: 'demo-savings-8756',
      name: 'Savings Account',
      type: 'savings',
      balance: 9120.27,
      availableBalance: 9120.27,
      last4: '8756',
      currency: 'USD'
    }
  ],
  transactions: [
    { id: 'demo-tx-1', name: 'Amazon.com', category: 'Shopping', amount: -89.32, date: 'Today', status: 'posted' },
    { id: 'demo-tx-2', name: 'Spotify Premium', category: 'Entertainment', amount: -11.99, date: 'May 18', status: 'posted' },
    { id: 'demo-tx-3', name: 'Transfer from Alex', category: 'Incoming Transfer', amount: 200, date: 'May 18', status: 'posted' },
    { id: 'demo-tx-4', name: 'Star Coffee', category: 'Food & Drinks', amount: -6.45, date: 'May 17', status: 'posted' },
    { id: 'demo-tx-5', name: 'Payroll Direct Deposit', category: 'Income', amount: 2850, date: 'May 15', status: 'posted' }
  ],
  cards: [
    { id: 'demo-card-4532', name: 'Nebula Blue', last4: '4532', network: 'visa', frozen: false },
    { id: 'demo-card-8756', name: 'Cosmic Pink', last4: '8756', network: 'mastercard', frozen: false }
  ]
};

function mode(): BankingMode {
  return process.env.BANKING_MODE === 'partner' ? 'partner' : 'demo';
}

function partnerConfig() {
  return {
    gatewayBaseUrl: process.env.BANKING_GATEWAY_BASE_URL?.replace(/\/$/, '') || '',
    apiKey: process.env.BANKING_GATEWAY_API_KEY || '',
    programId: process.env.BANKING_PROGRAM_ID || '',
    providerName: process.env.BANKING_PROVIDER_NAME || '',
    partnerBankName: process.env.BANKING_PARTNER_BANK_NAME || '',
    disclosure: process.env.BANKING_PARTNER_DISCLOSURE || '',
    liveWritesEnabled: process.env.BANKING_ENABLE_LIVE_WRITES === 'true'
  };
}

export function bankingStatus() {
  const currentMode = mode();
  const config = partnerConfig();
  const partnerConfigured = Boolean(
    config.gatewayBaseUrl &&
    config.apiKey &&
    config.programId &&
    config.providerName &&
    config.partnerBankName
  );

  return {
    mode: currentMode,
    providerName: config.providerName || null,
    partnerBankName: config.partnerBankName || null,
    partnerConfigured,
    liveWritesEnabled: currentMode === 'partner' && partnerConfigured && config.liveWritesEnabled,
    disclosure: currentMode === 'demo'
      ? 'Demo mode. No real deposits are held and no real money is moved.'
      : (config.disclosure || `Banking services are provided through ${config.partnerBankName || 'the configured regulated banking partner'}.`)
  };
}

function requirePartnerConfig(requireWrites = false) {
  const status = bankingStatus();
  const config = partnerConfig();

  if (mode() !== 'partner') {
    throw new BankingError(409, 'DEMO_MODE', 'This action is simulated while Galactic Trust is in demo mode.');
  }

  if (!status.partnerConfigured) {
    throw new BankingError(503, 'PARTNER_NOT_CONFIGURED', 'A regulated banking partner gateway has not been configured yet.');
  }

  if (requireWrites && !config.liveWritesEnabled) {
    throw new BankingError(503, 'LIVE_WRITES_DISABLED', 'Live money movement is disabled until the banking program is approved and explicitly enabled.');
  }

  return config;
}

async function partnerRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method || 'GET').toUpperCase();
  const config = requirePartnerConfig(method !== 'GET' && method !== 'HEAD');
  const headers = new Headers(init?.headers);
  headers.set('Authorization', `Bearer ${config.apiKey}`);
  headers.set('Content-Type', 'application/json');
  headers.set('X-Galactic-Program-Id', config.programId);

  const response = await fetch(`${config.gatewayBaseUrl}${path}`, {
    ...init,
    headers,
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new BankingError(502, 'PARTNER_GATEWAY_ERROR', `Banking partner gateway returned ${response.status}.`);
  }

  return response.json() as Promise<T>;
}

export async function getBankingSummary(userId: string): Promise<BankingSummary> {
  if (mode() === 'demo') return DEMO_SUMMARY;
  return partnerRequest<BankingSummary>(`/v1/users/${encodeURIComponent(userId)}/summary`, { method: 'GET' });
}

export async function createTransfer(input: {
  userId: string;
  fromAccountId: string;
  recipient: string;
  amount: number;
  memo?: string;
  idempotencyKey?: string;
}) {
  if (!input.fromAccountId.trim()) {
    throw new BankingError(400, 'SOURCE_ACCOUNT_REQUIRED', 'A source account is required.');
  }

  if (!Number.isFinite(input.amount) || input.amount <= 0 || input.amount > 10000) {
    throw new BankingError(400, 'INVALID_AMOUNT', 'Transfer amount must be greater than $0 and no more than $10,000.');
  }

  if (!input.recipient.trim()) {
    throw new BankingError(400, 'RECIPIENT_REQUIRED', 'A transfer recipient is required.');
  }

  if (mode() === 'demo') {
    return {
      id: `demo-transfer-${Date.now()}`,
      status: 'simulated',
      amount: Number(input.amount.toFixed(2)),
      recipient: input.recipient.trim(),
      message: 'Demo transfer only. No real money moved.'
    };
  }

  if (!input.idempotencyKey) {
    throw new BankingError(400, 'IDEMPOTENCY_REQUIRED', 'A unique idempotency key is required for live transfers.');
  }

  return partnerRequest('/v1/transfers', {
    method: 'POST',
    headers: { 'Idempotency-Key': input.idempotencyKey },
    body: JSON.stringify({
      userId: input.userId,
      fromAccountId: input.fromAccountId,
      recipient: input.recipient.trim(),
      amount: Number(input.amount.toFixed(2)),
      memo: input.memo
    })
  });
}

export async function setCardFrozen(input: { userId: string; cardId: string; frozen: boolean }) {
  if (!input.cardId) {
    throw new BankingError(400, 'CARD_REQUIRED', 'A card is required.');
  }

  if (mode() === 'demo') {
    return {
      id: input.cardId,
      frozen: input.frozen,
      status: 'simulated',
      message: `Demo card ${input.frozen ? 'frozen' : 'unfrozen'}. No real card was changed.`
    };
  }

  return partnerRequest(`/v1/cards/${encodeURIComponent(input.cardId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ userId: input.userId, frozen: input.frozen })
  });
}
