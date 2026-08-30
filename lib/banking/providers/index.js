import { getIncreaseSandboxConfig } from '../increase-sandbox.js';
import { bankingLaunchSnapshot } from '../regulated-launch.js';
import { createDemoNullProvider } from './demo-null.js';
import { createIncreaseSandboxProvider } from './increase/sandbox.js';
import { createIncreaseProductionProvider } from './increase/production.js';

export function resolveBankingProvider(env = process.env) {
  const launch = bankingLaunchSnapshot(env);
  const platform = String(env.GALACTIC_BANKING_PLATFORM || '').trim().toLowerCase();

  // A live provider is selected only after the regulated launch snapshot says
  // live banking is actually enabled. The production adapter remains a locked
  // stub until its real implementation is reviewed and accepted.
  if (launch.liveBankingEnabled && platform === 'increase') {
    return createIncreaseProductionProvider(env);
  }

  const sandbox = getIncreaseSandboxConfig(env);
  if (sandbox.enabled && sandbox.credentialsConfigured) {
    return createIncreaseSandboxProvider(env);
  }

  return createDemoNullProvider();
}
