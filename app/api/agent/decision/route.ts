import { coordinateBaseAgentDecision } from '../../../../lib/agent-coordinator';
import { withX402Json } from '../../../../lib/x402-resource';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function priceAtomic() {
  const configured = String(process.env.X402_DECISION_PRICE_ATOMIC || '10000').trim();
  return /^\d+$/.test(configured) && BigInt(configured) > BigInt(0) ? configured : '10000';
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  return withX402Json(request, {
    amountAtomic: priceAtomic(),
    description: 'Convert a live Base Flashblocks arbitrage scan into a bounded short-lived execution candidate ticket.',
    tags: ['base', 'defi', 'agent', 'decision', 'simulation'],
  }, async () => {
    const result = await coordinateBaseAgentDecision({
      amountEth: body?.amountEth || '0.01',
      targetBps: body?.targetBps,
      slippageBps: body?.slippageBps,
      requireFlashblocks: body?.requireFlashblocks !== false,
      ticketLifetimeMs: body?.ticketLifetimeMs,
    });
    return {
      service: 'voxel-vault-agent-decision',
      version: 1,
      ...result,
      safety: 'Tickets are deterministic quote envelopes, not signatures or spending authorizations. The endpoint never submits a transaction.',
    };
  });
}
