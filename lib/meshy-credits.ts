const BALANCE_ENDPOINT = 'https://api.meshy.ai/openapi/v1/balance';

export const MESHY_PROPERTY_CREDITS = Object.freeze({
  source3d: 15,
  voxelImage: 3,
  final3d: 15,
  afterSource: 18,
  fullPipeline: 33,
});

function messageFrom(payload: any) {
  return String(payload?.task_error?.message || payload?.message || payload?.error || '').trim();
}

function numericBalance(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const balance = Number(value);
  return Number.isFinite(balance) ? Math.max(0, balance) : null;
}

export function isMeshyCreditFailure(status: unknown, payload: any = {}) {
  const code = Number(status || 0);
  const message = messageFrom(payload);
  return code === 402 || /insufficient\s+(?:credits|funds)|payment\s+required/i.test(message);
}

export function meshyCreditFailure(requiredCredits: number, availableCredits: number | null, stage: string) {
  const available = numericBalance(availableCredits);
  const balanceCopy = available === null ? '' : ` The connected Meshy API account currently has ${available} credit${available === 1 ? '' : 's'}.`;
  return {
    ok: false as const,
    code: 'MESHY_CREDITS_REQUIRED' as const,
    creditRequired: true as const,
    provider: 'meshy' as const,
    stage,
    requiredCredits,
    availableCredits: available,
    error: `VoxelPop 3D credits are currently unavailable for ${stage}. ${requiredCredits} Meshy API credits are needed before this stage starts.${balanceCopy} This is the Meshy credit balance, not your Voxel Vault USD, crypto, or property balance. Nothing new was generated for this stage.`,
  };
}

export async function readMeshyCreditBalance(apiKey: string) {
  try {
    const response = await fetch(BALANCE_ENDPOINT, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: 'no-store',
    });
    const data = await response.json().catch(() => ({}));
    const balance = numericBalance(data?.balance);
    if (!response.ok || balance === null) return null;
    return balance;
  } catch {
    return null;
  }
}

export async function ensureMeshyCredits(apiKey: string, requiredCredits: number, stage: string) {
  const balance = await readMeshyCreditBalance(apiKey);
  if (balance === null || balance >= requiredCredits) {
    return { ok: true as const, status: 200 as const, availableCredits: balance, requiredCredits, stage };
  }
  return {
    ...meshyCreditFailure(requiredCredits, balance, stage),
    ok: false as const,
    status: 402 as const,
  };
}
