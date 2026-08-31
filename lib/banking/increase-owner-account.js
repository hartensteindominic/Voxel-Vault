import {
  getIncreaseSandboxOwnerRecoveryAccount,
  publicIncreaseRecoveryBindingSummary,
} from './increase-sandbox-recovery.js';
import {
  getProviderAccountBinding,
  publicBindingSummary,
} from './provider-account-binding.js';

export async function resolveIncreaseSandboxOwnerAccount(admin, userId, env = process.env) {
  let stored = {
    binding: null,
    setupRequired: false,
    error: '',
  };

  try {
    stored = await getProviderAccountBinding(admin, userId, {
      provider: 'increase',
      environment: 'sandbox',
    });
  } catch {
    stored = {
      binding: null,
      setupRequired: true,
      error: 'Trusted provider-binding storage could not be read. Galactic Trust is using the owner-scoped Increase sandbox recovery path instead.',
    };
  }

  if (stored.binding) {
    return {
      accountId: stored.binding.accountId,
      binding: publicBindingSummary(stored.binding),
      bindingStorageReady: true,
      bindingStorageIssue: '',
      persistence: 'database',
    };
  }

  const recovery = await getIncreaseSandboxOwnerRecoveryAccount(userId, env);
  if (recovery) {
    return {
      accountId: recovery.accountId,
      binding: publicIncreaseRecoveryBindingSummary(recovery),
      bindingStorageReady: !stored.setupRequired,
      bindingStorageIssue: stored.setupRequired ? (stored.error || 'Trusted provider-binding storage is not installed yet.') : '',
      persistence: 'increase-idempotency-key',
    };
  }

  return {
    accountId: '',
    binding: null,
    bindingStorageReady: !stored.setupRequired,
    bindingStorageIssue: stored.setupRequired ? (stored.error || 'Trusted provider-binding storage is not installed yet.') : '',
    persistence: 'none',
  };
}

export function ownerAccountLifecycleBinding(resolution) {
  if (!resolution?.binding || !resolution?.accountId) return null;
  return {
    provider: 'increase',
    environment: 'sandbox',
    status: 'verified',
    kycStatus: String(resolution.binding.kycStatus || 'SANDBOX_ACCOUNT_ONLY'),
  };
}
