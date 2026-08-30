export const INCREASE_SANDBOX_BASE_URL = 'https://sandbox.increase.com';
export const INCREASE_SANDBOX_PROVIDER = 'Increase';

function truthy(value) {
  return String(value || '').trim().toLowerCase() === 'true';
}

function cleanText(value, max = 80) {
  return String(value || '').replace(/[^a-zA-Z0-9 .,'&()/_-]/g, '').trim().slice(0, max);
}

function centsToDollars(value) {
  const cents = Number(value);
  return Number.isFinite(cents) ? cents / 100 : 0;
}

function safeResourceId(value, label) {
  const id = String(value || '').trim();
  if (!id || id.length > 160 || !/^[a-zA-Z0-9_-]+$/.test(id)) {
    throw new Error(`${label} is invalid.`);
  }
  return id;
}

export function getIncreaseSandboxConfig(env = process.env) {
  const apiKey = String(env.INCREASE_SANDBOX_API_KEY || '').trim();
  return {
    provider: INCREASE_SANDBOX_PROVIDER,
    environment: 'sandbox',
    baseUrl: INCREASE_SANDBOX_BASE_URL,
    enabled: truthy(env.GALACTIC_INCREASE_SANDBOX_ENABLED),
    credentialsConfigured: Boolean(apiKey),
    apiKey,
    preferredAccountId: String(env.INCREASE_SANDBOX_ACCOUNT_ID || '').trim(),
    canMoveRealMoney: false,
    productionSupported: false,
  };
}

function safePath(path) {
  const value = String(path || '').trim();
  if (!value.startsWith('/') || value.includes('..')) {
    throw new Error('Increase sandbox request path is invalid.');
  }
  const url = new URL(value, `${INCREASE_SANDBOX_BASE_URL}/`);
  if (url.origin !== new URL(INCREASE_SANDBOX_BASE_URL).origin) {
    throw new Error('Increase sandbox requests must stay on the sandbox origin.');
  }
  return url;
}

function increaseErrorMessage(status, type) {
  if (type === 'environment_mismatch_error') {
    return 'Increase rejected the configured key because it does not belong to the sandbox environment.';
  }
  if (type === 'insufficient_permissions_error') {
    return 'Increase accepted the sandbox key, but that key does not have permission for this action.';
  }
  if (type === 'private_feature_error') {
    return 'Increase accepted the sandbox key, but this feature is not enabled for the connected Increase account.';
  }
  if (type === 'invalid_api_key_error' || status === 401) {
    return 'Increase rejected the configured sandbox API key because it is missing, invalid, or revoked.';
  }
  if (status === 403) {
    return 'Increase denied this sandbox request. Verify the key environment and API permissions.';
  }
  return `Increase sandbox request failed with status ${status}.`;
}

export async function increaseSandboxRequest(path, options = {}, env = process.env) {
  const config = getIncreaseSandboxConfig(env);
  if (!config.enabled) throw new Error('Increase sandbox is disabled. Set GALACTIC_INCREASE_SANDBOX_ENABLED=true only after a sandbox key is configured.');
  if (!config.credentialsConfigured) throw new Error('Increase sandbox credentials are not configured. Add INCREASE_SANDBOX_API_KEY to the server environment.');

  const method = String(options.method || 'GET').toUpperCase();
  if (!['GET', 'POST', 'PATCH'].includes(method)) throw new Error('Increase sandbox request method is not allowed.');

  const headers = {
    Authorization: `Bearer ${config.apiKey}`,
    Accept: 'application/json',
  };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.idempotencyKey) headers['Idempotency-Key'] = String(options.idempotencyKey);

  const response = await fetch(safePath(path), {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: 'no-store',
    signal: options.signal,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const providerType = typeof payload?.type === 'string' ? payload.type : '';
    const error = new Error(increaseErrorMessage(response.status, providerType));
    error.status = response.status;
    error.providerType = providerType;
    error.providerDetail = typeof payload?.detail === 'string' ? payload.detail : '';
    throw error;
  }
  return payload;
}

function countPage(payload) {
  return Array.isArray(payload?.data) ? payload.data.length : 0;
}

function listData(payload) {
  return Array.isArray(payload?.data) ? payload.data : [];
}

function chooseAccounts(accounts, preferredAccountId = '') {
  const usable = accounts.filter((account) => account?.status === 'open' && account?.currency === 'USD');
  if (!preferredAccountId) return usable;
  const preferred = usable.find((account) => account.id === preferredAccountId);
  return preferred ? [preferred, ...usable.filter((account) => account.id !== preferredAccountId)] : usable;
}

async function resolvePrimaryAccount(env = process.env) {
  const config = getIncreaseSandboxConfig(env);
  const payload = await increaseSandboxRequest('/accounts?limit=100', {}, env);
  const accounts = chooseAccounts(listData(payload), config.preferredAccountId);
  if (!accounts.length) {
    throw new Error('Increase sandbox has no open USD account. Create a sandbox entity/account in Increase first.');
  }
  return accounts[0];
}

async function resolveBoundAccount(accountId, env = process.env) {
  const id = safeResourceId(accountId, 'Bound Increase sandbox Account ID');
  const account = await increaseSandboxRequest(`/accounts/${encodeURIComponent(id)}`, {}, env);
  if (String(account?.id || '') !== id || account?.status !== 'open' || account?.currency !== 'USD') {
    throw new Error('The bound Increase sandbox Account is unavailable or no longer an open USD account.');
  }
  return account;
}

function transactionTone(amount, routeType) {
  if (amount > 0) return 'blue';
  if (/card/i.test(routeType)) return 'dark';
  if (/ach/i.test(routeType)) return 'purple';
  return 'sage';
}

function transactionLabel(transaction) {
  return cleanText(
    transaction?.description ||
    transaction?.source?.category ||
    transaction?.route_type ||
    'Increase sandbox transaction',
    64
  ) || 'Increase sandbox transaction';
}

function transactionCategory(transaction) {
  const routeType = cleanText(transaction?.route_type || transaction?.source?.category || '', 40);
  if (/ach/i.test(routeType)) return 'Sandbox ACH';
  if (/card/i.test(routeType)) return 'Sandbox Card';
  if (/wire/i.test(routeType)) return 'Sandbox Wire';
  return 'Increase Sandbox';
}

async function buildDashboard(accounts, env = process.env, { boundAccount = false } = {}) {
  const config = getIncreaseSandboxConfig(env);
  const balances = await Promise.all(accounts.map((account) => increaseSandboxRequest(`/accounts/${encodeURIComponent(account.id)}/balance`, {}, env)));
  const primaryAccount = accounts[0];
  const transactionsPayload = await increaseSandboxRequest(`/transactions?account_id=${encodeURIComponent(primaryAccount.id)}&limit=20`, {}, env);

  const sanitizedAccounts = accounts.map((account, index) => {
    const balance = balances[index] || {};
    return {
      key: `sandbox-${index + 1}`,
      name: cleanText(account?.name || (index === 0 ? 'Increase Sandbox Checking' : 'Increase Sandbox Reserve'), 60),
      currentBalance: centsToDollars(balance.current_balance),
      availableBalance: centsToDollars(balance.available_balance),
      status: account?.status === 'open' ? 'open' : 'other',
      bank: cleanText(account?.bank || 'Increase sandbox', 40),
    };
  });

  const sanitizedTransactions = listData(transactionsPayload).map((transaction) => {
    const amount = centsToDollars(transaction?.amount);
    return {
      id: String(transaction?.id || `sandbox-${transaction?.created_at || Math.random()}`),
      icon: amount >= 0 ? '↓' : '↑',
      name: transactionLabel(transaction),
      category: transactionCategory(transaction),
      amount,
      date: transaction?.created_at ? new Date(transaction.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Sandbox',
      tone: transactionTone(amount, transaction?.route_type || transaction?.source?.category || ''),
    };
  });

  return {
    provider: config.provider,
    environment: config.environment,
    connected: true,
    canMoveRealMoney: false,
    accounts: sanitizedAccounts,
    transactions: sanitizedTransactions,
    setupRequired: false,
    boundAccount,
    syncedAt: new Date().toISOString(),
  };
}

export async function getIncreaseSandboxDashboard(env = process.env) {
  const config = getIncreaseSandboxConfig(env);
  if (!config.enabled || !config.credentialsConfigured) {
    return {
      provider: config.provider,
      environment: config.environment,
      connected: false,
      canMoveRealMoney: false,
      accounts: [],
      transactions: [],
      setupRequired: true,
    };
  }

  const accountPayload = await increaseSandboxRequest('/accounts?limit=100', {}, env);
  const accounts = chooseAccounts(listData(accountPayload), config.preferredAccountId).slice(0, 2);
  if (!accounts.length) {
    return {
      provider: config.provider,
      environment: config.environment,
      connected: true,
      canMoveRealMoney: false,
      accounts: [],
      transactions: [],
      setupRequired: true,
      nextStep: 'Create an open USD account in the Increase sandbox.',
    };
  }

  return buildDashboard(accounts, env);
}

export async function getIncreaseSandboxDashboardForAccount(accountId, env = process.env) {
  const account = await resolveBoundAccount(accountId, env);
  return buildDashboard([account], env, { boundAccount: true });
}

async function primaryAccountNumberId(accountId, env = process.env) {
  const payload = await increaseSandboxRequest(`/account_numbers?account_id=${encodeURIComponent(accountId)}&limit=20`, {}, env);
  const accountNumber = listData(payload).find((item) => item?.status === 'active') || listData(payload)[0];
  if (!accountNumber?.id) {
    throw new Error('Increase sandbox account has no account number. Create a sandbox account number first.');
  }
  return accountNumber.id;
}

async function simulateDepositForAccount(amount, account, env = process.env) {
  const accountNumberId = await primaryAccountNumberId(account.id, env);
  await increaseSandboxRequest('/simulations/inbound_ach_transfers', {
    method: 'POST',
    idempotencyKey: `galactic-sandbox-deposit-${crypto.randomUUID()}`,
    body: {
      account_number_id: accountNumberId,
      amount,
      company_name: 'GALACTIC TEST',
      company_entry_description: 'TESTDEP',
      receiver_name: 'Sandbox User',
    },
  }, env);
}

export async function simulateIncreaseSandboxDeposit(amountCents, env = process.env) {
  const amount = Number(amountCents);
  if (!Number.isInteger(amount) || amount < 100 || amount > 500000) {
    throw new Error('Sandbox deposit must be between $1 and $5,000.');
  }
  const account = await resolvePrimaryAccount(env);
  await simulateDepositForAccount(amount, account, env);
  return getIncreaseSandboxDashboard(env);
}

export async function simulateIncreaseSandboxDepositForAccount(amountCents, accountId, env = process.env) {
  const amount = Number(amountCents);
  if (!Number.isInteger(amount) || amount < 100 || amount > 500000) {
    throw new Error('Sandbox deposit must be between $1 and $5,000.');
  }
  const account = await resolveBoundAccount(accountId, env);
  await simulateDepositForAccount(amount, account, env);
  return getIncreaseSandboxDashboardForAccount(account.id, env);
}

async function simulateSendForAccount(amount, recipient, account, env = process.env) {
  const safeRecipient = cleanText(recipient, 22) || 'Sandbox Recipient';
  const transfer = await increaseSandboxRequest('/ach_transfers', {
    method: 'POST',
    idempotencyKey: `galactic-sandbox-send-${crypto.randomUUID()}`,
    body: {
      account_id: account.id,
      account_number: '987654321',
      amount,
      routing_number: '101050001',
      statement_descriptor: 'Galactic sandbox transfer',
      individual_name: safeRecipient,
      require_approval: false,
    },
  }, env);

  if (transfer?.id) {
    await increaseSandboxRequest(`/simulations/ach_transfers/${encodeURIComponent(transfer.id)}/settle`, { method: 'POST', body: {} }, env);
  }
}

export async function simulateIncreaseSandboxSend(amountCents, recipient, env = process.env) {
  const amount = Number(amountCents);
  if (!Number.isInteger(amount) || amount < 100 || amount > 100000) {
    throw new Error('Sandbox transfer must be between $1 and $1,000.');
  }
  const account = await resolvePrimaryAccount(env);
  await simulateSendForAccount(amount, recipient, account, env);
  return getIncreaseSandboxDashboard(env);
}

export async function simulateIncreaseSandboxSendForAccount(amountCents, recipient, accountId, env = process.env) {
  const amount = Number(amountCents);
  if (!Number.isInteger(amount) || amount < 100 || amount > 100000) {
    throw new Error('Sandbox transfer must be between $1 and $1,000.');
  }
  const account = await resolveBoundAccount(accountId, env);
  await simulateSendForAccount(amount, recipient, account, env);
  return getIncreaseSandboxDashboardForAccount(account.id, env);
}

async function optionalInspection(path, env = process.env) {
  try {
    const payload = await increaseSandboxRequest(path, {}, env);
    return { payload, available: true, issue: null };
  } catch (error) {
    return {
      payload: { data: [] },
      available: false,
      issue: {
        status: Number.isFinite(error?.status) ? error.status : null,
        type: typeof error?.providerType === 'string' ? error.providerType : '',
      },
    };
  }
}

export async function inspectIncreaseSandbox(env = process.env) {
  const config = getIncreaseSandboxConfig(env);
  if (!config.enabled || !config.credentialsConfigured) {
    return {
      provider: config.provider,
      environment: config.environment,
      enabled: config.enabled,
      credentialsConfigured: config.credentialsConfigured,
      connected: false,
      canMoveRealMoney: false,
      productionSupported: false,
      counts: { programs: 0, accounts: 0, entities: 0 },
    };
  }

  // Accounts are the minimum read capability required by the Galactic Trust sandbox dashboard.
  // Programs and Entities support owner onboarding, but a restricted key should not make the
  // entire provider connection appear broken when account access itself works.
  const accounts = await increaseSandboxRequest('/accounts?limit=20', {}, env);
  const [programsCheck, entitiesCheck] = await Promise.all([
    optionalInspection('/programs?limit=20', env),
    optionalInspection('/entities?limit=20', env),
  ]);

  return {
    provider: config.provider,
    environment: config.environment,
    enabled: true,
    credentialsConfigured: true,
    connected: true,
    canMoveRealMoney: false,
    productionSupported: false,
    counts: {
      programs: countPage(programsCheck.payload),
      accounts: countPage(accounts),
      entities: countPage(entitiesCheck.payload),
    },
    capabilities: {
      accounts: { available: true, issue: null },
      programs: { available: programsCheck.available, issue: programsCheck.issue },
      entities: { available: entitiesCheck.available, issue: entitiesCheck.issue },
    },
    moreAvailable: {
      programs: Boolean(programsCheck.payload?.next_cursor),
      accounts: Boolean(accounts?.next_cursor),
      entities: Boolean(entitiesCheck.payload?.next_cursor),
    },
  };
}
