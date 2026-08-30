import {
  bankingLaunchSnapshot,
  LIVE_BANKING_IMPLEMENTATION_READY,
} from '../../regulated-launch.js';

// Production has its own adapter and origin. Never import or reuse the sandbox
// request helper here. This module intentionally contains no live request code
// until sponsor-bank/provider production acceptance is complete.
export const INCREASE_PRODUCTION_BASE_URL = 'https://api.increase.com';

function productionConfig(env = process.env) {
  const snapshot = bankingLaunchSnapshot(env);
  const apiKey = String(env.INCREASE_PRODUCTION_API_KEY || '').trim();
  const configuredPlatform = String(env.GALACTIC_BANKING_PLATFORM || '').trim().toLowerCase();

  return {
    provider: 'Increase',
    environment: 'production',
    baseUrl: INCREASE_PRODUCTION_BASE_URL,
    platformSelected: configuredPlatform === 'increase',
    credentialsConfigured: Boolean(apiKey),
    implementationReady: LIVE_BANKING_IMPLEMENTATION_READY,
    launchApproved: snapshot.liveBankingEnabled,
    apiKey,
  };
}

function assertProductionUnlocked(env = process.env) {
  const config = productionConfig(env);

  if (!config.implementationReady) {
    throw new Error('Production banking is locked. LIVE_BANKING_IMPLEMENTATION_READY is false.');
  }
  if (!config.launchApproved) {
    throw new Error('Production banking is locked. Required launch evidence or the live switch is incomplete.');
  }
  if (!config.platformSelected) {
    throw new Error('Production banking is locked. Increase is not the selected approved banking platform.');
  }
  if (!config.credentialsConfigured) {
    throw new Error('Production banking is locked. Dedicated Increase production credentials are not configured.');
  }

  return config;
}

function notImplemented(action, env) {
  assertProductionUnlocked(env);
  throw new Error(`${action} is not implemented in the Galactic Trust production adapter. Production remains fail-closed.`);
}

export function inspectIncreaseProduction(env = process.env) {
  const config = productionConfig(env);
  return {
    provider: config.provider,
    environment: config.environment,
    baseUrl: config.baseUrl,
    platformSelected: config.platformSelected,
    credentialsConfigured: config.credentialsConfigured,
    implementationReady: config.implementationReady,
    launchApproved: config.launchApproved,
    connected: false,
    canMoveRealMoney: false,
    productionSupported: false,
  };
}

export function createIncreaseProductionProvider(env = process.env) {
  return Object.freeze({
    id: 'increase-production-locked',
    provider: 'Increase',
    environment: 'production',
    connected: false,
    canMoveRealMoney: false,
    productionSupported: false,

    async inspect() {
      return inspectIncreaseProduction(env);
    },

    async getDashboard() {
      return notImplemented('Production dashboard access', env);
    },

    async createApplicant() {
      return notImplemented('Production applicant onboarding', env);
    },

    async createAccount() {
      return notImplemented('Production account creation', env);
    },

    async initiateTransfer() {
      return notImplemented('Production money movement', env);
    },
  });
}
