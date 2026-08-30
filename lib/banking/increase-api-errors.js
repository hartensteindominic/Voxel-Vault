function providerType(error) {
  return typeof error?.providerType === 'string' ? error.providerType.trim() : '';
}

function providerStatus(error) {
  const status = Number(error?.status);
  return Number.isFinite(status) ? status : null;
}

export function describeIncreaseSandboxError(error, fallback = 'Increase sandbox request failed.') {
  const type = providerType(error);
  const status = providerStatus(error);

  if (type === 'environment_mismatch_error') {
    return {
      error: 'The Increase key configured for Galactic Trust is not a sandbox key.',
      nextStep: 'Replace INCREASE_SANDBOX_API_KEY in Vercel with an Increase sandbox key, keep GALACTIC_INCREASE_SANDBOX_ENABLED=true, and redeploy.',
      providerStatus: status,
      providerType: type,
    };
  }

  if (type === 'invalid_api_key_error' || status === 401) {
    return {
      error: 'Increase rejected the configured sandbox API key because it is invalid or revoked.',
      nextStep: 'Create a fresh Increase sandbox API key, update INCREASE_SANDBOX_API_KEY in Vercel, and redeploy.',
      providerStatus: status,
      providerType: type || 'invalid_api_key_error',
    };
  }

  if (type === 'insufficient_permissions_error') {
    return {
      error: 'The Increase sandbox key is valid, but it does not have permission for this sandbox action.',
      nextStep: 'Use an Increase sandbox API key with the permissions required by this integration, update INCREASE_SANDBOX_API_KEY in Vercel, and redeploy.',
      providerStatus: status,
      providerType: type,
    };
  }

  if (type === 'private_feature_error') {
    return {
      error: 'This Increase sandbox feature is not enabled for the connected Increase account.',
      nextStep: 'Enable the feature in Increase or ask Increase support to grant sandbox access. Galactic Trust will keep production money movement locked.',
      providerStatus: status,
      providerType: type,
    };
  }

  if (status === 403) {
    return {
      error: 'Increase denied a sandbox API request.',
      nextStep: 'Verify that INCREASE_SANDBOX_API_KEY is a sandbox key and that it has permission for the requested Increase feature, then redeploy.',
      providerStatus: status,
      providerType: type || null,
    };
  }

  return {
    error: fallback,
    nextStep: '',
    providerStatus: status,
    providerType: type || null,
  };
}
