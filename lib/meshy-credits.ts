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

export function isMeshyCreditFailure(status: unknown, payload: any = {}) {
  const code = Number(status || 0);
  const message = messageFrom(payload);
  return code === 402 || /insufficient\s+(?:credits|funds)|payment\s+required/i.test(message);
}

export function meshyCreditFailure(requiredCredits: number, availableCredits: number | null, stage: string) {
  const available = Number.isFinite(Number(availableCredits)) ? Math.max(0, Number(availableCredits)) : null;
  const balanceCopy = available === null ? '' : ` The connected Meshy API account currently has ${available} credit${available === 1 ? '' : 's'}.`;
  return {
    ok: false,
    code: 'MESHY_CREDITS_REQUIRED',
    creditRequired: true,
    provider: 'meshy',
    stage,
    requiredCredits,
    availableCredits: available,
    error: `VoxelPop 3D credits are currently unavailable for ${stage}. ${requiredCredits} Meshy API credits are needed before this stage starts.${balanceCopy} Nothing new was generated for this stage.`,
  };
}

export async function readMeshyCreditBalance(apiKey: string) {
  try {
    const response = await fetch(BALANCE_ENDPOINT, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: 'no-store',
    });
    const data = await response.json().catch(() => ({}));
    const balance = Number(data?.balance);
    if (!response.ok || !Number.isFinite(balance)) return null;
    return Math.max(0, balance);
  } catch {
    return null;
  }
}

export async function ensureMeshyCredits(apiKey: string, requiredCredits: number, stage: string) {
  const balance = await readMeshyCreditBalance(apiKey);
  if (balance === null || balance >= requiredCredits) {
    return { ok: true as const, availableCredits: balance, requiredCredits, stage };
  }
  return {
    ok: false as const,
    status: 402,
    ...meshyCreditFailure(requiredCredits, balance, stage),
  };
}
