import { NextResponse } from 'next/server';
import { requireNeuralCoreAdmin } from '../../../../../lib/neural-core-auth';
import {
  controlActionsReady,
  createOrLoadControlAction,
  updateControlActionDelivery,
} from '../../../../../lib/voxelflip-control-actions';
import {
  sendApprovalWhatsApp,
  sendRevenueStartedWhatsApp,
  whatsappCloudReadiness,
} from '../../../../../lib/whatsapp-cloud';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(data: any, status = 200) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store, private' } });
}

function setupPayload(request: Request, table: any) {
  const readiness = whatsappCloudReadiness();
  return {
    ready: Boolean(table.ready && readiness.outboundReady && readiness.webhookReady && readiness.revenueTemplate && readiness.approvalTemplate),
    database: { controlActions: table },
    meta: readiness,
    webhookUrl: new URL('/api/whatsapp/webhook', request.url).toString(),
    secretsAreServerOnly: true,
    automaticSigningActive: false,
    executorActive: false,
    templates: {
      revenue: {
        env: 'WHATSAPP_REVENUE_TEMPLATE_NAME',
        body: 'VoxelFlip verified realized profit has started: {{1}} ETH. Open Neural Core for details.',
        buttons: [],
      },
      approval: {
        env: 'WHATSAPP_APPROVAL_TEMPLATE_NAME',
        body: 'VoxelFlip proposal: {{1}}\nMaximum amount: {{2}} ETH\nRisk: {{3}}\nApprove or skip?',
        buttons: ['APPROVE', 'SKIP'],
      },
    },
    requiredEnv: [
      'WHATSAPP_PHONE_NUMBER_ID',
      'WHATSAPP_ACCESS_TOKEN',
      'WHATSAPP_APP_SECRET',
      'WHATSAPP_WEBHOOK_VERIFY_TOKEN',
      'WHATSAPP_APPROVER_NUMBER',
      'WHATSAPP_REVENUE_TEMPLATE_NAME',
      'WHATSAPP_APPROVAL_TEMPLATE_NAME',
    ],
  };
}

export async function GET(request: Request) {
  const auth = await requireNeuralCoreAdmin(request);
  if ('error' in auth) return json({ error: auth.error, setupRequired: Boolean(auth.setupRequired) }, auth.status);
  const table = await controlActionsReady(auth.admin);
  return json(setupPayload(request, table));
}

export async function POST(request: Request) {
  const auth = await requireNeuralCoreAdmin(request);
  if ('error' in auth) return json({ error: auth.error, setupRequired: Boolean(auth.setupRequired) }, auth.status);
  const table = await controlActionsReady(auth.admin);
  if (!table.ready) return json({ error: 'WhatsApp control storage is not active. Apply migration 013 first.', ...setupPayload(request, table) }, 503);

  const body = await request.json().catch(() => ({}));
  const action = String(body?.action || '').trim();

  if (action === 'test-revenue') {
    try {
      const sent = await sendRevenueStartedWhatsApp(0.001);
      return json({ ok: true, messageId: sent.messageId, notice: 'Test revenue template sent. No financial action was created.' });
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : 'WhatsApp test alert failed.' }, 503);
    }
  }

  if (action === 'test-approval') {
    try {
      const created = await createOrLoadControlAction({
        idempotencyKey: `whatsapp-test:${auth.user.id}:${Date.now()}`,
        actionType: 'test',
        payload: { test: true, executionLocked: true },
        expiresInMinutes: 15,
      }, auth.admin);
      const sent = await sendApprovalWhatsApp({
        actionId: created.action.id,
        actionLabel: 'TEST CONTROL — no trade',
        limitEth: 0,
        riskLabel: 'TEST ONLY',
      });
      const stored = await updateControlActionDelivery({ id: created.action.id, status: 'pending', messageId: sent.messageId }, auth.admin);
      return json({
        ok: true,
        actionId: stored.id,
        status: stored.status,
        messageId: sent.messageId,
        notice: 'Tap APPROVE or SKIP in WhatsApp. The test can never execute a blockchain action.',
      });
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : 'WhatsApp approval test failed.' }, 503);
    }
  }

  return json({ error: 'Unsupported WhatsApp setup action.' }, 400);
}
