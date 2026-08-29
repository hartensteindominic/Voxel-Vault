const BALANCE_ENDPOINT = 'https://api.meshy.ai/openapi/v1/balance';

export const MESHY_PROPERTY_CREDITS = Object.freeze({
  source3d: 15,
  voxelImage: 3,
  final3d: 15,
  fullPipeline: 33,
  afterSource: 18,
});

function clean(value: unknown, max = 600) {
  return String(value || '').trim().slice(0, max);
}

function providerMessage(data: any) {
  return clean(data?.task_error?.message || data?.message || data?.error, 600);
}

export async function readMeshyCreditBalance(apiKey: string) {
  try {
    const response = await fetch(BALANCE_ENDPOINT, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: 'no-store',
    });
    if (!response.ok) return null;
    const data = await response.json().catch(() => ({}));
    const balance = Number(data?.balance);
    return Number.isFinite(balance) && balance >= 0 ? balance : null;
  } catch {
    return null;
  }
}

export function meshyCreditsSufficient(balance: number | null, required: number) {
  // Fail open if Meshy's non-billable balance endpoint is temporarily unavailable.
  // The paid endpoint still has explicit 402 mapping below, so users never see a
  // provider billing message as if it came from their own wallet or card.
  return balance === null || balance >= required;
}

export function meshyCreditError(stage: string, requiredProviderCredits: number) {
  return {
    ok: false,
    code: 'VOXELPOP_PROVIDER_CREDITS_LOW',
    providerCreditIssue: true,
    retryable: true,
    stage,
    requiredProviderCredits,
    error: "There are not enough credits in Voxel Vault's Meshy provider account to continue VoxelPop's 3D generation service. This is not your wallet, bank account, card, or crypto balance. No payment was attempted from your account. Please retry after the service credits are replenished.",
  };
}

export function meshyProviderFailure(status: number, data: any, fallback: string, stage: string, requiredProviderCredits = 0) {
  const message = providerMessage(data);
  const insufficient = status === 402 || /insufficient\s+(funds|credits)|payment\s+required/i.test(message);
  if (insufficient) return meshyCreditError(stage, requiredProviderCredits);
  return { ok: false, error: message || fallback, providerStatus: status };
}

export function meshyClientStatus(status: number) {
  // A Meshy 402 is a backend-provider availability problem for Voxel Vault,
  // not a payment request to the signed-in user.
  return status === 402 ? 503 : status;
}
