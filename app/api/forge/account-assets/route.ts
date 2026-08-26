import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabase-admin';
import { stripe } from '../../../../lib/stripe-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MESH_ENDPOINT = 'https://api.meshy.ai/openapi/v1/image-to-3d';
const MAX_STRIPE_PAGES = 50;
const MAX_MATCHES = 100;
const MAX_ANALYTICS_EVENTS = 2_000;
const MAX_ANALYTICS_SESSIONS = 500;
const PROVIDER_TIMEOUT_MS = 7_000;
const RECOVERY_BUDGET_MS = 44_000;
const MESH_CONCURRENCY = 6;
const STRIPE_CONCURRENCY = 8;

function bearerToken(request: Request) {
  const header = request.headers.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || '';
}

function normalizeEmail(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function addEmail(set: Set<string>, value: unknown) {
  const email = normalizeEmail(value);
  if (email && email.includes('@')) set.add(email);
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

async function mapWithConcurrency<T, R>(items: T[], limit: number, worker: (item: T, index: number) => Promise<R>) {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  async function run() {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length || 1) }, () => run()));
  return results;
}

function inlineSessionEmails(session: any) {
  const emails = new Set<string>();
  addEmail(emails, session?.customer_details?.email);
  addEmail(emails, session?.customer_email);
  addEmail(emails, session?.customer?.email);
  addEmail(emails, session?.payment_intent?.receipt_email);
  addEmail(emails, session?.payment_intent?.latest_charge?.billing_details?.email);
  return emails;
}

async function retrieveExpandedSession(sessionId: string) {
  try {
    return await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['customer', 'payment_intent.latest_charge'],
    }) as any;
  } catch {
    return null;
  }
}

async function sessionIdentityMatch(session: any, userId: string, email: string) {
  const linkedUserId = String(session?.metadata?.voxelpop_user_id || '').trim();
  if (linkedUserId && linkedUserId === userId) return { matched: true, source: 'verified-user-id', session };

  const inline = inlineSessionEmails(session);
  if (inline.has(email)) return { matched: true, source: 'checkout-email', session };

  const expanded = await retrieveExpandedSession(String(session?.id || ''));
  if (!expanded) return { matched: false, source: '', session };
  const expandedLinkedUserId = String(expanded?.metadata?.voxelpop_user_id || '').trim();
  if (expandedLinkedUserId && expandedLinkedUserId === userId) return { matched: true, source: 'verified-user-id', session: expanded };
  if (inlineSessionEmails(expanded).has(email)) return { matched: true, source: 'payment-email', session: expanded };

  return { matched: false, source: '', session: expanded };
}

async function backfillUserLink(session: any, userId: string) {
  if (!session?.id || String(session?.metadata?.voxelpop_user_id || '').trim() === userId) return;
  try {
    await stripe.checkout.sessions.update(String(session.id), {
      metadata: { ...(session.metadata || {}), voxelpop_user_id: userId },
    });
  } catch {}
}

type RecoveryDiagnostics = {
  analyticsEventsRead: number;
  analyticsSessionIds: number;
  analyticsSessionsRetrieved: number;
  analyticsMatches: number;
  pagesScanned: number;
  checkoutSessionsScanned: number;
  paidVoxelSessionsScanned: number;
  identityCandidatesChecked: number;
  matchedByUserId: number;
  matchedByEmail: number;
  stoppedByTimeBudget: boolean;
};

async function analyticsCompletedSessionIds(admin: ReturnType<typeof getSupabaseAdmin>) {
  try {
    const { data, error } = await admin
      .from('voxelpop_conversion_events')
      .select('stripe_session_id,created_at')
      .in('event_name', ['mesh_completed', 'glb_downloaded'])
      .not('stripe_session_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(MAX_ANALYTICS_EVENTS);
    if (error || !Array.isArray(data)) return { ids: [] as string[], eventsRead: 0 };
    const ids: string[] = [];
    const seen = new Set<string>();
    for (const row of data) {
      const id = String((row as any)?.stripe_session_id || '').trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
      if (ids.length >= MAX_ANALYTICS_SESSIONS) break;
    }
    return { ids, eventsRead: data.length };
  } catch {
    return { ids: [] as string[], eventsRead: 0 };
  }
}

async function matchesFromAnalytics(
  admin: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  email: string,
  startedAt: number,
  diagnostics: RecoveryDiagnostics,
) {
  const analytics = await analyticsCompletedSessionIds(admin);
  diagnostics.analyticsEventsRead = analytics.eventsRead;
  diagnostics.analyticsSessionIds = analytics.ids.length;

  const sessions = await mapWithConcurrency(analytics.ids, STRIPE_CONCURRENCY, async sessionId => {
    if (Date.now() - startedAt > RECOVERY_BUDGET_MS) return null;
    return retrieveExpandedSession(sessionId);
  });

  const matches: any[] = [];
  for (const raw of sessions) {
    if (!raw || matches.length >= MAX_MATCHES) continue;
    diagnostics.analyticsSessionsRetrieved += 1;
    if (raw.payment_status !== 'paid' || raw.metadata?.product !== 'voxelpop-3d-asset' || !raw.metadata?.mesh_task_0) continue;
    diagnostics.identityCandidatesChecked += 1;
    const identity = await sessionIdentityMatch(raw, userId, email);
    if (!identity.matched) continue;
    const matchedSession = identity.session || raw;
    matches.push(matchedSession);
    diagnostics.analyticsMatches += 1;
    if (identity.source === 'verified-user-id') diagnostics.matchedByUserId += 1;
    else diagnostics.matchedByEmail += 1;
    if (identity.source !== 'verified-user-id') await backfillUserLink(matchedSession, userId);
  }

  return matches;
}

async function matchesFromStripeHistory(
  userId: string,
  email: string,
  startedAt: number,
  diagnostics: RecoveryDiagnostics,
  alreadyMatched: Set<string>,
) {
  const matches: any[] = [];
  let startingAfter = '';

  for (let page = 0; page < MAX_STRIPE_PAGES && matches.length + alreadyMatched.size < MAX_MATCHES; page += 1) {
    if (Date.now() - startedAt > RECOVERY_BUDGET_MS) {
      diagnostics.stoppedByTimeBudget = true;
      break;
    }

    const listed = await stripe.checkout.sessions.list({
      limit: 100,
      status: 'complete',
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });

    diagnostics.pagesScanned += 1;
    diagnostics.checkoutSessionsScanned += listed.data.length;

    const candidates = listed.data.filter(session => (
      session.payment_status === 'paid'
      && session.metadata?.product === 'voxelpop-3d-asset'
      && Boolean(session.metadata?.mesh_task_0)
      && !alreadyMatched.has(String(session.id))
    ));
    diagnostics.paidVoxelSessionsScanned += candidates.length;

    for (const session of candidates) {
      if (matches.length + alreadyMatched.size >= MAX_MATCHES) break;
      if (Date.now() - startedAt > RECOVERY_BUDGET_MS) {
        diagnostics.stoppedByTimeBudget = true;
        break;
      }
      diagnostics.identityCandidatesChecked += 1;
      const identity = await sessionIdentityMatch(session, userId, email);
      if (!identity.matched) continue;
      const matchedSession = identity.session || session;
      matches.push(matchedSession);
      alreadyMatched.add(String(matchedSession.id));
      if (identity.source === 'verified-user-id') diagnostics.matchedByUserId += 1;
      else diagnostics.matchedByEmail += 1;
      if (identity.source !== 'verified-user-id') await backfillUserLink(matchedSession, userId);
    }

    if (diagnostics.stoppedByTimeBudget || !listed.has_more || !listed.data.length) break;
    startingAfter = String(listed.data[listed.data.length - 1]?.id || '');
    if (!startingAfter) break;
  }

  return matches;
}

async function matchingPaidSessions(admin: ReturnType<typeof getSupabaseAdmin>, userId: string, email: string) {
  const startedAt = Date.now();
  const diagnostics: RecoveryDiagnostics = {
    analyticsEventsRead: 0,
    analyticsSessionIds: 0,
    analyticsSessionsRetrieved: 0,
    analyticsMatches: 0,
    pagesScanned: 0,
    checkoutSessionsScanned: 0,
    paidVoxelSessionsScanned: 0,
    identityCandidatesChecked: 0,
    matchedByUserId: 0,
    matchedByEmail: 0,
    stoppedByTimeBudget: false,
  };

  const analyticsMatches = await matchesFromAnalytics(admin, userId, email, startedAt, diagnostics);
  const ids = new Set(analyticsMatches.map(session => String(session.id)));

  let historyMatches: any[] = [];
  if (ids.size < MAX_MATCHES && Date.now() - startedAt <= RECOVERY_BUDGET_MS) {
    historyMatches = await matchesFromStripeHistory(userId, email, startedAt, diagnostics, ids);
  } else if (Date.now() - startedAt > RECOVERY_BUDGET_MS) {
    diagnostics.stoppedByTimeBudget = true;
  }

  const merged = new Map<string, any>();
  for (const session of [...analyticsMatches, ...historyMatches]) merged.set(String(session.id), session);
  return { matches: Array.from(merged.values()), diagnostics };
}

async function meshRecord(session: any, apiKey: string) {
  const taskId = String(session.metadata?.mesh_task_0 || '').trim();
  if (!taskId) return null;

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
      const data: any = await response.json().catch(() => ({}));
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
  const contract = String(session.metadata?.voxelflip_contract || '').trim();

  const stableModelUrl = status === 'ready'
    ? `/api/creator-pack/mesh?${new URLSearchParams({ sessionId, taskId, preview: '1' }).toString()}`
    : '';
  const updatedAt = new Date(Number(session.created || 0) * 1000 || Date.now()).toISOString();

  return {
    sessionId,
    updatedAt,
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
          ...(contract ? { contract, contractAddress: contract } : {}),
        },
      } : {}),
      generationsLeft: 0,
      idea,
      updatedAt,
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
    const { matches: sessions, diagnostics } = await matchingPaidSessions(admin, user.id, email);
    const apiKey = String(process.env.MESHY_API_KEY || '').trim();
    const records = (await mapWithConcurrency(sessions, MESH_CONCURRENCY, session => meshRecord(session, apiKey))).filter(Boolean);
    const nonMintedReady = records.filter((record: any) => record?.payload?.mesh?.status === 'ready' && !record?.payload?.mint?.tokenId).length;
    const minted = records.filter((record: any) => Boolean(record?.payload?.mint?.tokenId)).length;

    return NextResponse.json({
      recovered: records.length,
      nonMintedReady,
      minted,
      records,
      signedIn: true,
      meshStatusRefreshed: Boolean(apiKey),
      diagnostics,
      safety: 'Read-only account recovery. This does not mint, transfer, approve, list, burn, or sign any NFT transaction.',
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('Forge account asset recovery failed', error);
    return NextResponse.json({ error: 'Could not recover your paid VoxelPop library right now.' }, { status: 500, headers: { 'Cache-Control': 'private, no-store' } });
  }
}
