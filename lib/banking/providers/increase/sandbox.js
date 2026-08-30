import {
  getIncreaseSandboxConfig,
  getIncreaseSandboxDashboard,
  inspectIncreaseSandbox,
  simulateIncreaseSandboxDeposit,
  simulateIncreaseSandboxSend,
} from '../../increase-sandbox.js';

export function createIncreaseSandboxProvider(env = process.env) {
  const config = getIncreaseSandboxConfig(env);

  return Object.freeze({
    id: 'increase-sandbox',
    provider: config.provider,
    environment: 'sandbox',
    connected: Boolean(config.enabled && config.credentialsConfigured),
    canMoveRealMoney: false,
    productionSupported: false,

    inspect() {
      return inspectIncreaseSandbox(env);
    },

    getDashboard() {
      return getIncreaseSandboxDashboard(env);
    },

    simulateDeposit({ amountCents }) {
      return simulateIncreaseSandboxDeposit(amountCents, env);
    },

    initiateTransfer({ amountCents, recipient }) {
      return simulateIncreaseSandboxSend(amountCents, recipient, env);
    },
  });
}
