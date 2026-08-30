import assert from 'node:assert/strict';
import { describeIncreaseSandboxError } from '../lib/banking/increase-api-errors.js';

const cases = [
  {
    error: { status: 403, providerType: 'environment_mismatch_error' },
    includes: 'not a sandbox key',
    nextStep: 'INCREASE_SANDBOX_API_KEY',
  },
  {
    error: { status: 401, providerType: 'invalid_api_key_error' },
    includes: 'invalid or revoked',
    nextStep: 'fresh Increase sandbox API key',
  },
  {
    error: { status: 403, providerType: 'insufficient_permissions_error' },
    includes: 'does not have permission',
    nextStep: 'permissions required',
  },
  {
    error: { status: 403, providerType: 'private_feature_error' },
    includes: 'not enabled',
    nextStep: 'Increase support',
  },
  {
    error: { status: 403 },
    includes: 'denied a sandbox API request',
    nextStep: 'sandbox key',
  },
];

for (const testCase of cases) {
  const result = describeIncreaseSandboxError(testCase.error);
  assert.match(result.error, new RegExp(testCase.includes, 'i'));
  assert.match(result.nextStep, new RegExp(testCase.nextStep, 'i'));
  assert.equal(result.providerStatus, testCase.error.status);
}

const fallback = describeIncreaseSandboxError(new Error('provider unavailable'), 'Readable fallback');
assert.equal(fallback.error, 'Readable fallback');
assert.equal(fallback.providerStatus, null);

console.log('Increase sandbox error classification checks passed.');
