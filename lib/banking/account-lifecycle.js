import { bankingLaunchSnapshot } from './regulated-launch.js';

export const GALACTIC_ACCOUNT_LIFECYCLE_VERSION = '2026-08-account-lifecycle-v2';

function clean(value) {
  return String(value ?? '').trim();
}

function increaseSandboxBindingKind(binding) {
  if (!binding
    || clean(binding.provider).toLowerCase() !== 'increase'
    || clean(binding.environment).toLowerCase() !== 'sandbox'
    || clean(binding.status).toLowerCase() !== 'verified') return 'none';

  const status = clean(binding.kycStatus).toUpperCase();
  if (status === 'SANDBOX_VALID_SIMULATION') return 'sandbox-simulation';
  if (status === 'SANDBOX_ACCOUNT_ONLY') return 'sandbox-account-only';
  return 'none';
}

export function buildGalacticAccountLifecycle({
  signedIn = false,
  bindingState = null,
  env = process.env,
} = {}) {
  const launch = bankingLaunchSnapshot(env);
  const binding = bindingState?.binding || null;
  const bindingStorageReady = !bindingState?.setupRequired;
  const validationKind = increaseSandboxBindingKind(binding);
  const sandboxOwnerBound = validationKind !== 'none';

  let stage = 'signed-out';
  let nextAction = 'Sign in to use Galactic Trust demo features.';

  if (signedIn && !bindingStorageReady) {
    stage = 'infrastructure-setup-required';
    nextAction = 'Apply the trusted provider-binding database migrations before treating any provider account as user-owned.';
  } else if (signedIn && sandboxOwnerBound) {
    stage = 'sandbox-owner-bound';
    nextAction = validationKind === 'sandbox-account-only'
      ? 'Continue testing with the owner-scoped Increase sandbox Account. Hosted identity onboarding was not used, and production banking remains unavailable.'
      : 'Continue testing with the owner-scoped Increase sandbox. Production banking remains unavailable.';
  } else if (signedIn) {
    stage = 'demo-only';
    nextAction = 'Use Galactic Trust in demo mode. Provider-backed customer banking is not activated.';
  }

  return {
    lifecycleVersion: GALACTIC_ACCOUNT_LIFECYCLE_VERSION,
    stage,
    signedIn: Boolean(signedIn),
    demoAvailable: true,
    sandbox: {
      provider: 'Increase',
      environment: 'sandbox',
      ownerBindingReady: sandboxOwnerBound,
      bindingStorageReady,
      validationKind,
      canMoveRealMoney: false,
    },
    production: {
      status: launch.status,
      implementationReady: launch.implementationReady,
      evidenceAssertionsPresent: launch.allRequiredAssertionsPresent,
      liveSwitchRequested: launch.liveSwitchRequested,
      providerConfigured: launch.providerConfigured,
      sponsorBankNamed: launch.sponsorBankNamed,
      customerAccountOpeningSupported: false,
      customerMoneyMovementSupported: false,
      canMoveRealMoney: false,
    },
    canOpenProductionAccount: false,
    canMoveRealMoney: false,
    nextAction,
  };
}
