import { createHash } from 'node:crypto';
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

function ownerRecoveryKey(userId) {
  const digest = createHash('sha256').update(String(userId || '')).digest('hex').slice(0, 32);
  return `galactic-sandbox-owner-${digest}`;
}

async function findOrCreateRecoveryAccount(userId, env = process.env) {
  const idempotencyKey = ownerRecoveryKey(userId);
  const existingPayload = await increaseSandboxRequest(`/accounts?idempotency_key=${encodeURIComponent(idempotencyKey)}&limit=10`, {}, env);
  let account = listData(existingPayload).find((item) => item?.status === 'open' && item?.currency === 'USD');
  let created = false;

  if (!account) {
    account = await increaseSandboxRequest('/accounts', {
      method: 'POST',
      idempotencyKey,
      body: {
        name: 'Galactic Trust Sandbox Checking',
      },
    }, env);
    created = true;
  }

  const accountId = providerId(account?.id, 'account_', 'Increase sandbox Account ID');
  const entityId = providerId(account?.entity_id, 'entity_', 'Increase sandbox Account Entity ID');
  if (account?.status !== 'open' || account?.currency !== 'USD') {
    throw new Error('Increase returned a sandbox Account that is not an open USD account.');
  }

  return { account, accountId, entityId, created };
}

async function ensureRecoveryAccountNumber(accountId, env = process.env) {
  const payload = await increaseSandboxRequest(`/account_numbers?account_id=${encodeURIComponent(accountId)}&limit=100`, {}, env);
  let accountNumber = listData(payload).find((item) => item?.status === 'active') || listData(payload)[0] || null;
  let created = false;

  if (!accountNumber) {
    accountNumber = await increaseSandboxRequest('/account_numbers', {
      method: 'POST',
      idempotencyKey: `galactic-sandbox-number-${accountId}`,
      body: {
        account_id: accountId,
        name: 'Galactic Trust Sandbox ACH',
      },
    }, env);
    created = true;
  }

  return {
    ready: Boolean(accountNumber?.id),
    created,
    status: String(accountNumber?.status || 'unknown'),
  };
}

export async function recoverIncreaseSandboxOwnerAccount(userId, env = process.env) {
  const config = getIncreaseSandboxConfig(env);
  if (!config.enabled || !config.credentialsConfigured || config.environment !== 'sandbox' || config.canMoveRealMoney) {
    throw new Error('Increase sandbox recovery is unavailable until the server-only sandbox configuration is active.');
  }

  const { account, accountId, entityId, created } = await findOrCreateRecoveryAccount(userId, env);

  let accountNumber = { ready: false, created: false, status: 'unavailable' };
  let accountNumberIssue = '';
  try {
    accountNumber = await ensureRecoveryAccountNumber(accountId, env);
  } catch (error) {
    accountNumberIssue = error instanceof Error ? error.message : 'Increase sandbox account-number setup needs attention.';
  }

  const dashboard = await getIncreaseSandboxDashboardForAccount(accountId, env);
  return {
    provider: 'Increase',
    environment: 'sandbox',
    canMoveRealMoney: false,
    bindingKind: 'SANDBOX_ACCOUNT_ONLY',
    entityId,
    accountId,
    accountCreated: created,
    accountName: String(account?.name || 'Galactic Trust Sandbox Checking').slice(0, 120),
    accountNumber,
    accountNumberIssue,
    dashboard,
    note: 'Account-only Increase sandbox recovery. Hosted Entity onboarding and KYC simulation were not used. This is pretend money only and cannot enable production banking.',
  };
}
