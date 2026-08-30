import {
  getIncreaseSandboxConfig,
  getIncreaseSandboxDashboardForAccount,
  increaseSandboxRequest,
} from './increase-sandbox.js';

function listData(payload) {
  return Array.isArray(payload?.data) ? payload.data : [];
}

function providerId(value, prefix, label) {
  const id = String(value || '').trim();
  const allowedPrefix = prefix ? id.startsWith(prefix) || id.startsWith(`sandbox_${prefix}`) : true;
  if (!id || id.length > 160 || !/^[a-zA-Z0-9_-]+$/.test(id) || !allowedPrefix) {
    throw new Error(`${label} is invalid.`);
  }
  return id;
}

function safeText(value, fallback, max = 100) {
  const text = String(value || '').replace(/[^a-zA-Z0-9 .,'&()/_-]/g, '').trim().slice(0, max);
  return text || fallback;
}

function safeRedirectUrl(value) {
  const url = new URL(String(value || ''));
  const localHttp = url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname);
  if (url.username || url.password || (url.protocol !== 'https:' && !localHttp)) {
    throw new Error('Increase sandbox onboarding redirect URL must use HTTPS, except for localhost development.');
  }
  return url.toString();
}

function safeSessionUrl(value) {
  const url = new URL(String(value || ''));
  if (url.protocol !== 'https:' || !(url.hostname === 'increase.com' || url.hostname.endsWith('.increase.com'))) {
    throw new Error('Increase returned an unexpected onboarding session URL.');
  }
  return url.toString();
}

function sanitizeProgram(program) {
  return {
    id: String(program?.id || ''),
    name: safeText(program?.name, 'Increase sandbox program', 100),
    bank: safeText(program?.bank, 'Increase sandbox', 60),
  };
}

async function listPrograms(env = process.env) {
  const payload = await increaseSandboxRequest('/programs?limit=100', {}, env);
  return listData(payload).filter((program) => program?.id).map(sanitizeProgram);
}

async function resolveProgram(requestedProgramId = '', env = process.env) {
  const programs = await listPrograms(env);
  if (!programs.length) throw new Error('Increase sandbox has no Program available for onboarding.');

  if (requestedProgramId) {
    const programId = providerId(requestedProgramId, 'program_', 'Increase sandbox Program ID');
    const selected = programs.find((program) => program.id === programId);
    if (!selected) throw new Error('Requested Increase sandbox Program was not found.');
    return selected;
  }

  if (programs.length > 1) {
    throw new Error('Multiple Increase sandbox Programs are available. Select a Program explicitly before onboarding.');
  }
  return programs[0];
}

function sanitizeSession(session) {
  return {
    id: providerId(session?.id, 'entity_onboarding_session_', 'Increase sandbox onboarding session ID'),
    status: String(session?.status || 'unknown'),
    programId: String(session?.program_id || ''),
    entityId: session?.entity_id ? providerId(session.entity_id, 'entity_', 'Increase sandbox Entity ID') : null,
    sessionUrl: session?.session_url ? safeSessionUrl(session.session_url) : null,
    expiresAt: session?.expires_at ? String(session.expires_at) : null,
  };
}

function sanitizeEntityReadiness(entity) {
  const issues = Array.isArray(entity?.validation?.issues) ? entity.validation.issues : [];
  return {
    entityId: providerId(entity?.id, 'entity_', 'Increase sandbox Entity ID'),
    entityStatus: String(entity?.status || 'unknown'),
    structure: String(entity?.structure || 'unknown'),
    validationStatus: String(entity?.validation?.status || 'not_simulated'),
    issueCategories: issues.map((issue) => safeText(issue?.category, 'unknown', 80)).slice(0, 20),
    readyForSandboxAccount: entity?.status === 'active' && entity?.validation?.status === 'valid',
    canMoveRealMoney: false,
  };
}

export async function inspectIncreaseSandboxOnboarding(env = process.env) {
  const config = getIncreaseSandboxConfig(env);
  if (!config.enabled || !config.credentialsConfigured) {
    return {
      provider: config.provider,
      environment: 'sandbox',
      connected: false,
      programs: [],
      canMoveRealMoney: false,
      setupRequired: true,
    };
  }
  const programs = await listPrograms(env);
  return {
    provider: config.provider,
    environment: 'sandbox',
    connected: true,
    programs,
    canMoveRealMoney: false,
    setupRequired: programs.length === 0,
  };
}

export async function createIncreaseSandboxOnboardingSession({ programId = '', redirectUrl = '', entityId = '' } = {}, env = process.env) {
  const program = await resolveProgram(programId, env);
  const body = {
    program_id: program.id,
    redirect_url: safeRedirectUrl(redirectUrl),
  };
  if (entityId) body.entity_id = providerId(entityId, 'entity_', 'Increase sandbox Entity ID');

  const session = await increaseSandboxRequest('/entity_onboarding_sessions', {
    method: 'POST',
    idempotencyKey: `galactic-sandbox-onboarding-${crypto.randomUUID()}`,
    body,
  }, env);

  return {
    provider: 'Increase',
    environment: 'sandbox',
    program,
    session: sanitizeSession(session),
    canMoveRealMoney: false,
    note: 'Hosted Increase sandbox onboarding only. Galactic Trust does not collect the identity form data.',
  };
}

export async function submitIncreaseSandboxOnboardingSession(sessionId, env = process.env) {
  const id = providerId(sessionId, 'entity_onboarding_session_', 'Increase sandbox onboarding session ID');
  const session = await increaseSandboxRequest(`/simulations/entity_onboarding_sessions/${encodeURIComponent(id)}/submit`, {
    method: 'POST',
  }, env);
  return {
    provider: 'Increase',
    environment: 'sandbox',
    session: sanitizeSession(session),
    canMoveRealMoney: false,
    simulated: true,
  };
}

export async function getIncreaseSandboxEntityReadiness(entityId, env = process.env) {
  const id = providerId(entityId, 'entity_', 'Increase sandbox Entity ID');
  const entity = await increaseSandboxRequest(`/entities/${encodeURIComponent(id)}`, {}, env);
  return sanitizeEntityReadiness(entity);
}

export async function simulateIncreaseSandboxEntityValid(entityId, env = process.env) {
  const id = providerId(entityId, 'entity_', 'Increase sandbox Entity ID');
  const entity = await increaseSandboxRequest(`/simulations/entities/${encodeURIComponent(id)}/update_validation`, {
    method: 'POST',
    idempotencyKey: `galactic-sandbox-validation-${crypto.randomUUID()}`,
    body: { issues: [] },
  }, env);
  return {
    ...sanitizeEntityReadiness(entity),
    validationSimulation: true,
  };
}

async function findOrCreateAccount(entityId, program, accountName, env = process.env) {
  const accountPayload = await increaseSandboxRequest(`/accounts?entity_id=${encodeURIComponent(entityId)}&limit=100`, {}, env);
  const existing = listData(accountPayload).find((account) => (
    account?.status === 'open'
    && account?.currency === 'USD'
    && account?.program_id === program.id
  ));
  if (existing?.id) return { account: existing, created: false };

  const account = await increaseSandboxRequest('/accounts', {
    method: 'POST',
    idempotencyKey: `galactic-sandbox-account-${crypto.randomUUID()}`,
    body: {
      entity_id: entityId,
      name: safeText(accountName, 'Galactic Trust Sandbox Checking', 120),
      program_id: program.id,
    },
  }, env);
  return { account, created: true };
}

async function findOrCreateAccountNumber(accountId, env = process.env) {
  const payload = await increaseSandboxRequest(`/account_numbers?account_id=${encodeURIComponent(accountId)}&limit=100`, {}, env);
  const existing = listData(payload).find((item) => item?.status === 'active') || listData(payload)[0];
  if (existing?.id) return { accountNumber: existing, created: false };

  const accountNumber = await increaseSandboxRequest('/account_numbers', {
    method: 'POST',
    idempotencyKey: `galactic-sandbox-account-number-${crypto.randomUUID()}`,
    body: {
      account_id: accountId,
      name: 'Galactic Trust Sandbox ACH',
    },
  }, env);
  return { accountNumber, created: true };
}

export async function bootstrapIncreaseSandboxAccount({ entityId = '', programId = '', accountName = '' } = {}, env = process.env) {
  const readiness = await getIncreaseSandboxEntityReadiness(entityId, env);
  if (!readiness.readyForSandboxAccount) {
    throw new Error(`Increase sandbox Entity is not ready for account creation. Validation status: ${readiness.validationStatus}.`);
  }

  const program = await resolveProgram(programId, env);
  const { account, created: accountCreated } = await findOrCreateAccount(readiness.entityId, program, accountName, env);
  const accountId = providerId(account?.id, 'account_', 'Increase sandbox Account ID');
  const { accountNumber, created: accountNumberCreated } = await findOrCreateAccountNumber(accountId, env);
  const accountNumberId = providerId(accountNumber?.id, 'account_number_', 'Increase sandbox Account Number ID');

  return {
    provider: 'Increase',
    environment: 'sandbox',
    canMoveRealMoney: false,
    entity: readiness,
    program,
    account: {
      id: accountId,
      name: safeText(account?.name, 'Galactic Trust Sandbox Checking', 120),
      status: String(account?.status || 'unknown'),
      created: accountCreated,
    },
    accountNumber: {
      id: accountNumberId,
      status: String(accountNumber?.status || 'unknown'),
      created: accountNumberCreated,
      detailsWithheld: true,
    },
    note: 'Sandbox account number details are intentionally withheld from this setup response.',
  };
}

export async function completeIncreaseSandboxSetup({ entityId = '', programId = '', accountName = '' } = {}, env = process.env) {
  const validation = await simulateIncreaseSandboxEntityValid(entityId, env);
  const bootstrap = await bootstrapIncreaseSandboxAccount({ entityId: validation.entityId, programId, accountName }, env);
  const dashboard = await getIncreaseSandboxDashboardForAccount(bootstrap.account.id, env);
  return {
    ...bootstrap,
    validationSimulation: true,
    dashboard,
  };
}
