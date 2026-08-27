import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  return NextResponse.json({
    openapi: '3.1.0',
    info: {
      title: 'Voxel Vault Machine Revenue API',
      version: '2.0.0',
      description: 'Read-only Base market intelligence with Flashblocks-aware quoting and x402 USDC payment gates.',
    },
    servers: [{ url: origin }],
    paths: {
      '/api/agent/manifest': {
        get: {
          summary: 'Discover service capabilities and payment configuration.',
          responses: { '200': { description: 'Machine-readable service manifest.' } },
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
          responses: {
            '200': { description: 'Paid quote returned after x402 verify and settlement.' },
            '402': { description: 'Payment required or payment settlement failed.' },
            '503': { description: 'Payment facilitator or Base market-data source unavailable.' },
          },
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
          responses: {
            '200': { description: 'Paid optimization response returned after x402 settlement.' },
            '402': { description: 'Payment required or payment settlement failed.' },
            '503': { description: 'Payment facilitator or Base market-data source unavailable.' },
          },
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
