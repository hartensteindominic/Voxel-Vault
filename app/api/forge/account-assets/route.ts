import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabase-admin';
import { stripe } from '../../../../lib/stripe-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MESH_ENDPOINT = 'https://api.meshy.ai/openapi/v1/image-to-3d';
const MAX_STRIPE_PAGES = 5;
const MAX_MATCHES = 30;
const PROVIDER_TIMEOUT_MS = 7_000;

function bearerToken(request: Request) {
  const header = request.headers.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || '';
}

function normalizeEmail(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error('Timed out while recovering 3D asset status.')), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function sessionEmail(session: any) {
  const inline = normalizeEmail(session?.customer_details?.email || session?.customer_email || '');
  if (inline) return inline;
  try {
    const full = await stripe.checkout.sessions.retrieve(String(session.id));
    return normalizeEmail(full.customer_details?.email || full.customer_email || '');
  } catch {
    return '';
  }
}

async function matchingPaidSessions(email: string) {
  const matches: any[] = [];
  let startingAfter = '';

  for (let page = 0; page < MAX_STRIPE_PAGES && matches.length < MAX_MATCHES; page += 1) {
    const listed = await stripe.checkout.sessions.list({
      limit: 100,
      status: 'complete',
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });

    const candidates = listed.data.filter(session => (
      session.payment_status === 'paid'
      && session.metadata?.product === 'voxelpop-3d-asset'
      && Boolean(session.metadata?.mesh_task_0)
    ));

    for (const session of candidates) {
      if (matches.length >= MAX_MATCHES) break;
      const paidEmail = await sessionEmail(session);
      if (paidEmail && paidEmail === email) matches.push(session);
    }

    if (!listed.has_more || !listed.data.length) break;
    startingAfter = String(listed.data[listed.data.length - 1]?.id || '');
    if (!startingAfter) break;
  }

  return matches;
}

async function meshRecord(session: any, apiKey: string) {
  const taskId = String(session.metadata?.mesh_task_0 || '').trim();
  if (!taskId) return null;

  let data: any = null;
  let status = 'unknown';
  let modelUrl = '';
  let thumbnailUrl = '';
  let progress = 0;
  let error = '';

  if (apiKey) {
    try {
      const response = await withTimeout(fetch(`${MESH_ENDPOINT}/${encodeURIComponent(taskId)}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        cache: 'no-store',
      }), PROVIDER_TIMEOUT_MS);
      data = await response.json().catch(() => ({}));
      if (response.ok) {
        const providerStatus = String(data?.status || '').toUpperCase();
        modelUrl = typeof data?.model_urls?.glb === 'string' ? data.model_urls.glb : '';
        thumbnailUrl = typeof data?.alpha_thumbnail_url === 'string'
          ? data.alpha_thumbnail_url
          : (typeof data?.thumbnail_url === 'string' ? data.thumbnail_url : '');
        progress = modelUrl ? 100 : Number(data?.progress || 0);
        status = providerStatus === 'SUCCEEDED' && modelUrl
          ? 'ready'
          : providerStatus.toLowerCase() || 'unknown';
        error = String(data?.task_error?.message || '');
      } else {
        error = String(data?.message || data?.error || `Mesh provider HTTP ${response.status}`);
      }
    } catch (providerError) {
      error = providerError instanceof Error ? providerError.message : 'Could not refresh mesh status.';
    }
  }

  const sessionId = String(session.id);
  const name = String(session.metadata?.mesh_name_0 || 'Your voxel').slice(0, 80);
  const idea = String(session.metadata?.mesh_idea_0 || '').slice(0, 120);
  const tokenId = String(session.metadata?.voxelflip_token_id || '').trim();
  const owner = String(session.metadata?.voxelflip_wallet || '').trim();
  const txHash = String(session.metadata?.voxelflip_tx_hash || '').trim();
  const metadataUrl = String(session.metadata?.voxelflip_metadata_url || '').trim();

  // Use the same authenticated paid-session mesh proxy for the GLB so a recovered
  // library record does not depend on a temporary third-party model URL.
  const stableModelUrl = status === 'ready'
    ? `/api/creator-pack/mesh?${new URLSearchParams({ sessionId, taskId, preview: '1' }).toString()}`
    : '';

  return {
    sessionId,
    updatedAt: new Date(Number(session.created || 0) * 1000 || Date.now()).toISOString(),
    payload: {
      asset: {
        name,
        dataUrl: thumbnailUrl || '/voxelpop/voxelpop-logo.png',
      },
      mesh: {
        status,
        progress,
        taskId,
        modelUrl: stableModelUrl,
        error,
      },
      ...(tokenId ? {
        mint: {
          tokenId,
          owner,
          hash: txHash,
          txHash,
          metadataUrl,
        },
      } : {}),
      generationsLeft: 0,
      idea,
      updatedAt: new Date(Number(session.created || 0) * 1000 || Date.now()).toISOString(),
    },
  };
}

export async function GET(request: Request) {
  const token = bearerToken(request);
  if (!token) return NextResponse.json({ error: 'Google sign-in is required to recover paid VoxelPop assets.' }, { status: 401 });

  let admin: ReturnType<typeof getSupabaseAdmin>;
  try {
    admin = getSupabaseAdmin();
  } catch {
    return NextResponse.json({ error: 'Account recovery is not configured on this deployment.' }, { status: 503 });
  }

  const { data, error: authError } = await admin.auth.getUser(token);
  const user = data?.user;
  const email = normalizeEmail(user?.email);
  if (authError || !user || !email) {
    return NextResponse.json({ error: 'Your Google session could not be verified. Sign in again.' }, { status: 401 });
  }

  try {
    const sessions = await matchingPaidSessions(email);
    const apiKey = String(process.env.MESHY_API_KEY || '').trim();
    const records = (await Promise.all(sessions.map(session => meshRecord(session, apiKey)))).filter(Boolean);
    return NextResponse.json({
      recovered: records.length,
      records,
      signedIn: true,
      meshStatusRefreshed: Boolean(apiKey),
      safety: 'Read-only account recovery. This does not mint, transfer, approve, list, burn, or sign any NFT transaction.',
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('Forge account asset recovery failed', error);
    return NextResponse.json({ error: 'Could not recover your paid VoxelPop library right now.' }, { status: 500, headers: { 'Cache-Control': 'private, no-store' } });
  }
}
