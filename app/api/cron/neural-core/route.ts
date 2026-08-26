import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabase-admin';
import { readNeuralCoreWallet, refreshNeuralCore } from '../../../../lib/voxelflip-neural-core';
import {
  controlActionsReady,
  createOrLoadControlAction,
  updateControlActionDelivery,
} from '../../../../lib/voxelflip-control-actions';
import {
  sendApprovalWhatsApp,
  sendRevenueStartedWhatsApp,
  whatsappCloudReadiness,
} from '../../../../lib/whatsapp-cloud';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function authorized(request: Request) {
  const secret = String(process.env.CRON_SECRET || '').trim();
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

function positive(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function maybeSendWhatsAppControl(admin: any, wallet: string, core: any) {
  const table = await controlActionsReady(admin);
  const meta = whatsappCloudReadiness();
  const verifiedRevenue = Number(core?.ledger?.verifiedIncomeEth);
  const profit = Number(core?.ledger?.realizedProfitEth);
  if (!table.ready || !meta.outboundReady || !Number.isFinite(verifiedRevenue) || verifiedRevenue <= 0) {
    return { ready: false, sent: false, reason: !table.ready ? 'control-storage' : !meta.outboundReady ? 'whatsapp-config' : 'no-verified-revenue' };
  }

  const minimumProfit = positive(process.env.VOXELFLIP_FACTORY_MIN_REALIZED_PROFIT_ETH, 0.003);
  const reinvestPercent = Math.min(40, positive(process.env.VOXELFLIP_FACTORY_REINVEST_PERCENT, 25));
  const maxReinvest = positive(process.env.VOXELFLIP_FACTORY_MAX_REINVEST_ETH, 0.01);
  const costCoverageComplete = Boolean(core?.ledger?.costCoverageComplete);

  if (costCoverageComplete && Number.isFinite(profit) && profit >= minimumProfit && meta.approvalTemplate) {
    const proposed = Math.min(maxReinvest, profit * reinvestPercent / 100);
    const profitBucket = Math.floor(profit * 1_000_000);
    const created = await createOrLoadControlAction({
      idempotencyKey: `reinvest:${wallet.toLowerCase()}:${profitBucket}`,
      wallet,
      actionType: 'reinvest',
      payload: {
        verifiedRevenueEth: verifiedRevenue,
        realizedProfitEth: profit,
        proposedReinvestEth: proposed,
        reinvestPercent,
        reservePercent: 100 - reinvestPercent,
        costCoverageComplete: true,
        executionLocked: true,
        source: 'neural-core-cron',
      },
      expiresInMinutes: 60,
    }, admin);

    const current = created.action;
    if (['approved', 'skipped', 'expired', 'executed', 'notified'].includes(current.status)) {
      return { ready: true, sent: false, kind: 'approval', status: current.status, actionId: current.id };
    }
    if (current.status === 'pending' && current.whatsapp_message_id) {
      return { ready: true, sent: false, kind: 'approval', status: 'pending', actionId: current.id };
    }
    try {
      const sent = await sendApprovalWhatsApp({
        actionId: current.id,
        actionLabel: `Reinvest verified VoxelFlip profit (${reinvestPercent}% max)`,
        limitEth: proposed,
        riskLabel: 'BOUNDED · EXECUTOR STILL LOCKED',
      });
      await updateControlActionDelivery({ id: current.id, status: 'pending', messageId: sent.messageId }, admin);
      return { ready: true, sent: true, kind: 'approval', status: 'pending', actionId: current.id };
    } catch (error) {
      await updateControlActionDelivery({ id: current.id, status: 'failed', error: error instanceof Error ? error.message : 'WhatsApp delivery failed' }, admin).catch(() => null);
      return { ready: true, sent: false, kind: 'approval', status: 'failed', error: error instanceof Error ? error.message : 'WhatsApp delivery failed' };
    }
  }

  if (!meta.revenueTemplate) return { ready: false, sent: false, reason: 'revenue-template' };
  const created = await createOrLoadControlAction({
    idempotencyKey: `revenue-started:${wallet.toLowerCase()}`,
    wallet,
    actionType: 'revenue_notice',
    payload: { verifiedRevenueEth: verifiedRevenue, realizedProfitEth: Number.isFinite(profit) ? profit : null, costCoverageComplete, source: 'neural-core-cron' },
    expiresInMinutes: null,
  }, admin);
  if (created.action.status === 'notified') return { ready: true, sent: false, kind: 'revenue', status: 'notified' };
  try {
    const sent = await sendRevenueStartedWhatsApp(verifiedRevenue);
    await updateControlActionDelivery({ id: created.action.id, status: 'notified', messageId: sent.messageId }, admin);
    return { ready: true, sent: true, kind: 'revenue', status: 'notified' };
  } catch (error) {
    await updateControlActionDelivery({ id: created.action.id, status: 'failed', error: error instanceof Error ? error.message : 'WhatsApp delivery failed' }, admin).catch(() => null);
    return { ready: true, sent: false, kind: 'revenue', status: 'failed', error: error instanceof Error ? error.message : 'WhatsApp delivery failed' };
  }
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Neural Core cron is not authorized.' }, { status: 401 });
  try {
    const admin = getSupabaseAdmin();
    const wallet = await readNeuralCoreWallet(admin);
    if (!wallet) return NextResponse.json({ ok: true, skipped: true, reason: 'No Neural Core wallet has been configured yet.' }, { headers: { 'Cache-Control': 'no-store' } });
    const core = await refreshNeuralCore({ wallet, persist: true });
    let whatsapp: any = { ready: false, sent: false, reason: 'not-checked' };
    try { whatsapp = await maybeSendWhatsAppControl(admin, wallet, core); }
    catch (error) { whatsapp = { ready: false, sent: false, reason: 'safe-failure', error: error instanceof Error ? error.message : 'WhatsApp control failed' }; }
    return NextResponse.json({
      ok: true,
      checkedAt: core.checkedAt,
      wallet: core.wallet,
      memoryAvailable: core.memory.available,
      snapshotStored: core.memory.snapshotStored,
      recommendationStored: core.memory.recommendationStored,
      recommendation: core.recommendation,
      whatsapp,
      automaticSigningActive: false,
      executorActive: false,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Neural Core cron failed', error);
    return NextResponse.json({ error: 'Neural Core monitoring refresh failed.' }, { status: 503 });
  }
}
