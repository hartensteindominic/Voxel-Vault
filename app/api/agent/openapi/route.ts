import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const paidResponses = {
    '200': { description: 'Paid response returned after x402 verify and settlement.' },
    '402': { description: 'Payment required or payment settlement failed.' },
    '503': { description: 'Payment facilitator or Base market-data source unavailable.' },
  };

  return NextResponse.json({
    openapi: '3.1.0',
    info: {
      title: 'Voxel Vault Machine Revenue API',
      version: '2.1.0',
      description: 'Read-only Base market intelligence, Flashblocks-aware quoting, bounded agent decision tickets, and x402 USDC payment gates.',
    },
    servers: [{ url: origin }],
    paths: {
      '/api/agent/manifest': {
        get: {
          summary: 'Discover service capabilities and payment configuration.',
          responses: { '200': { description: 'Machine-readable service manifest.' } },
        },
      },
      '/api/agent/health': {
        get: {
          summary: 'Read coordinator, executor, and x402 activation status.',
          responses: { '200': { description: 'Read-only service health and safety state.' } },
        },
      },
      '/api/agent/base-quote': {
        post: {
          summary: 'Paid Flashblocks-aware WETH/USDC cross-DEX quote.',
          description: 'Returns HTTP 402 with PAYMENT-REQUIRED when no x402 payment is supplied.',
          requestBody: {
            required: false,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    amountEth: { type: 'string', default: '0.01' },
                    targetBps: { type: 'integer', minimum: 1, maximum: 1000, default: 25 },
                    slippageBps: { type: 'integer', minimum: 1, maximum: 100, default: 15 },
                    preferFlashblocks: { type: 'boolean', default: true },
                  },
                },
              },
            },
          },
          responses: paidResponses,
        },
      },
      '/api/agent/optimize': {
        post: {
          summary: 'Paid multi-size Base arbitrage optimizer.',
          description: 'Compares up to four ETH input sizes and chooses the highest positive net-after-gas candidate.',
          requestBody: {
            required: false,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    amountsEth: {
                      type: 'array',
                      maxItems: 4,
                      items: { type: 'string' },
                      default: ['0.005', '0.01', '0.025', '0.05'],
                    },
                    targetBps: { type: 'integer', minimum: 1, maximum: 1000, default: 25 },
                    slippageBps: { type: 'integer', minimum: 1, maximum: 100, default: 15 },
                    preferFlashblocks: { type: 'boolean', default: true },
                  },
                },
              },
            },
          },
          responses: paidResponses,
        },
      },
      '/api/agent/decision': {
        post: {
          summary: 'Paid bounded agent decision ticket.',
          description: 'Requires Flashblocks by default, applies the coordinator quote cap, and returns a short-lived deterministic ticket only when the quote gate passes. Tickets are not signatures or spending authorizations.',
          requestBody: {
            required: false,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    amountEth: { type: 'string', default: '0.01' },
                    targetBps: { type: 'integer', minimum: 1, maximum: 1000, default: 25 },
                    slippageBps: { type: 'integer', minimum: 1, maximum: 100, default: 15 },
                    requireFlashblocks: { type: 'boolean', default: true },
                    ticketLifetimeMs: { type: 'integer', minimum: 400, maximum: 5000, default: 1200 },
                  },
                },
              },
            },
          },
          responses: paidResponses,
        },
      },
    },
    components: {
      securitySchemes: {
        x402: {
          type: 'apiKey',
          in: 'header',
          name: 'PAYMENT-SIGNATURE',
          description: 'Base64-encoded x402 v2 PaymentPayload. Obtain current requirements from the PAYMENT-REQUIRED header on a 402 response.',
        },
      },
    },
  }, { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=60' } });
}
