import { createPrivateKey, randomBytes, sign as cryptoSign } from 'node:crypto';
import { getAddress, isAddress } from 'ethers';
import { NextResponse } from 'next/server';

export const X402_VERSION = 2;
export const X402_NETWORK = 'eip155:8453';
export const BASE_USDC = getAddress('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');

export type X402RouteConfig = {
  amountAtomic: string;
  description: string;
  tags?: string[];
  serviceName?: string;
};

type PaymentRequirements = {
  scheme: 'exact';
  network: string;
  amount: string;
  asset: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra: {
    name: 'USDC';
    version: '2';
  };
};

type PaymentRequired = {
  x402Version: number;
  error?: string;
  resource: {
    url: string;
    description: string;
    mimeType: 'application/json';
    serviceName: string;
    tags: string[];
  };
  accepts: PaymentRequirements[];
  extensions: Record<string, unknown>;
};

type PaymentPayload = {
  x402Version: number;
  resource?: { url?: string };
  accepted?: Partial<PaymentRequirements>;
  payload?: unknown;
  extensions?: Record<string, unknown>;
};

type VerifyResponse = {
  isValid?: boolean;
  invalidReason?: string;
  payer?: string;
};

type SettlementResponse = {
  success?: boolean;
  errorReason?: string;
  transaction?: string;
  network?: string;
  payer?: string;
  amount?: string;
};

function configuredPayTo() {
  const raw = String(process.env.X402_PAY_TO || process.env.PAY_TO || '').trim();
  return isAddress(raw) ? getAddress(raw) : '';
}

function facilitatorBaseUrl() {
  const configured = String(process.env.X402_FACILITATOR_URL || '').trim().replace(/\/$/, '');
  if (configured) return configured;
  if (process.env.CDP_API_KEY_ID && process.env.CDP_API_KEY_SECRET) {
    return 'https://api.cdp.coinbase.com/platform/v2/x402';
  }
  return '';
}

function safeHostname(value: string) {
  if (!value) return '';
  try {
    return new URL(value).hostname;
  } catch {
    return '';
  }
}

export function x402RuntimeStatus() {
  const payTo = configuredPayTo();
  const facilitator = facilitatorBaseUrl();
  const facilitatorHost = safeHostname(facilitator);
  return {
    configured: Boolean(payTo && facilitatorHost),
    payTo,
    facilitatorHost,
    network: X402_NETWORK,
    asset: BASE_USDC,
    assetSymbol: 'USDC',
    decimals: 6,
    protocolVersion: X402_VERSION,
  };
}

function toBase64Json(value: unknown) {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64');
}

function fromBase64Json<T>(value: string): T {
  return JSON.parse(Buffer.from(value, 'base64').toString('utf8')) as T;
}

function toBase64Url(value: Buffer | string) {
  return Buffer.from(value).toString('base64url');
}

function normalizePem(value: string) {
  return value.trim().replace(/\\n/g, '\n');
}

function buildCdpJwt(method: string, requestUrl: URL) {
  const keyId = String(process.env.CDP_API_KEY_ID || process.env.CDP_API_KEY_NAME || '').trim();
  const keySecret = String(process.env.CDP_API_KEY_SECRET || process.env.CDP_API_KEY_PRIVATE_KEY || '').trim();
  if (!keyId || !keySecret) throw new Error('CDP facilitator credentials are not configured.');

  const now = Math.floor(Date.now() / 1000);
  const uri = `${method.toUpperCase()} ${requestUrl.host}${requestUrl.pathname}`;
  const header = {
    alg: 'ES256',
    typ: 'JWT',
    kid: keyId,
    nonce: randomBytes(16).toString('hex'),
  };
  const payload = {
    sub: keyId,
    iss: 'cdp',
    aud: ['cdp_service'],
    nbf: now,
    exp: now + 120,
    uri,
  };
  const encodedHeader = toBase64Url(JSON.stringify(header));
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = cryptoSign('sha256', Buffer.from(signingInput), {
    key: createPrivateKey(normalizePem(keySecret)),
    dsaEncoding: 'ieee-p1363',
  });
  return `${signingInput}.${toBase64Url(signature)}`;
}

function extraFacilitatorHeaders() {
  const headers: Record<string, string> = {};
  const raw = String(process.env.X402_FACILITATOR_HEADERS_JSON || '').trim();
  if (!raw) return headers;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === 'string' && value) headers[key] = value;
    }
  } catch {
    throw new Error('X402_FACILITATOR_HEADERS_JSON must be a valid JSON object of string headers.');
  }
  return headers;
}

async function facilitatorHeaders(url: URL) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...extraFacilitatorHeaders(),
  };

  if (url.hostname === 'api.cdp.coinbase.com') {
    headers.Authorization = `Bearer ${buildCdpJwt('POST', url)}`;
  } else {
    const bearer = String(process.env.X402_FACILITATOR_BEARER_TOKEN || '').trim();
    if (bearer) headers.Authorization = `Bearer ${bearer}`;
  }
  return headers;
}

function requirementsFor(config: X402RouteConfig): PaymentRequirements {
  const payTo = configuredPayTo();
  if (!payTo) throw new Error('X402_PAY_TO must be a valid Base EVM address before paid routes are enabled.');
  if (!/^\d+$/.test(config.amountAtomic) || BigInt(config.amountAtomic) <= 0n) {
    throw new Error('x402 price must be a positive USDC atomic-unit integer.');
  }
  return {
    scheme: 'exact',
    network: X402_NETWORK,
    amount: config.amountAtomic,
    asset: BASE_USDC,
    payTo,
    maxTimeoutSeconds: 60,
    extra: { name: 'USDC', version: '2' },
  };
}

function paymentRequiredFor(request: Request, config: X402RouteConfig, error?: string): PaymentRequired {
  const url = new URL(request.url);
  url.hash = '';
  const tags = (config.tags || ['base', 'defi', 'simulation']).map(value => String(value).slice(0, 32)).slice(0, 5);
  return {
    x402Version: X402_VERSION,
    ...(error ? { error } : {}),
    resource: {
      url: url.toString(),
      description: config.description,
      mimeType: 'application/json',
      serviceName: String(config.serviceName || 'Voxel Vault Machine API').slice(0, 32),
      tags,
    },
    accepts: [requirementsFor(config)],
    extensions: {},
  };
}

function requirementMatches(payload: PaymentPayload, required: PaymentRequirements) {
  const accepted = payload.accepted;
  if (!accepted) return false;
  try {
    return (
      accepted.scheme === required.scheme
      && accepted.network === required.network
      && String(accepted.amount) === required.amount
      && getAddress(String(accepted.asset || '')) === required.asset
      && getAddress(String(accepted.payTo || '')) === required.payTo
      && Number(accepted.maxTimeoutSeconds) === required.maxTimeoutSeconds
      && (accepted.extra as { name?: string; version?: string } | undefined)?.name === 'USDC'
      && (accepted.extra as { name?: string; version?: string } | undefined)?.version === '2'
    );
  } catch {
    return false;
  }
}

function paymentRequiredResponse(required: PaymentRequired, status = 402) {
  return NextResponse.json(
    { error: required.error || 'Payment required', x402Version: X402_VERSION, paymentRequired: required },
    {
      status,
      headers: {
        'PAYMENT-REQUIRED': toBase64Json(required),
        'Cache-Control': 'no-store',
      },
    },
  );
}

async function facilitatorCall(endpoint: 'verify' | 'settle', paymentPayload: PaymentPayload, requirement: PaymentRequirements) {
  const base = facilitatorBaseUrl();
  if (!safeHostname(base)) throw new Error('No valid Base-mainnet-capable x402 facilitator is configured.');
  const url = new URL(`${base}/${endpoint}`);
  const response = await fetch(url, {
    method: 'POST',
    headers: await facilitatorHeaders(url),
    body: JSON.stringify({
      x402Version: X402_VERSION,
      paymentPayload,
      paymentRequirements: requirement,
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof body?.errorMessage === 'string'
      ? body.errorMessage
      : typeof body?.error === 'string'
        ? body.error
        : `facilitator ${endpoint} returned HTTP ${response.status}`;
    throw new Error(message.slice(0, 300));
  }
  return body;
}

export async function withX402Json<T>(
  request: Request,
  config: X402RouteConfig,
  handler: () => Promise<T>,
): Promise<NextResponse> {
  const runtime = x402RuntimeStatus();
  if (!runtime.configured) {
    return NextResponse.json({
      error: 'Machine payments are not activated on this deployment yet.',
      requiredConfiguration: ['X402_PAY_TO', 'X402_FACILITATOR_URL or CDP_API_KEY_ID + CDP_API_KEY_SECRET'],
      network: X402_NETWORK,
    }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }

  const required = paymentRequiredFor(request, config, 'PAYMENT-SIGNATURE header is required');
  const requirement = required.accepts[0];
  const signatureHeader = request.headers.get('PAYMENT-SIGNATURE');
  if (!signatureHeader) return paymentRequiredResponse(required);

  let paymentPayload: PaymentPayload;
  try {
    paymentPayload = fromBase64Json<PaymentPayload>(signatureHeader);
  } catch {
    return NextResponse.json({ error: 'Malformed PAYMENT-SIGNATURE header.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }

  if (Number(paymentPayload.x402Version) !== X402_VERSION || !requirementMatches(paymentPayload, requirement)) {
    return NextResponse.json({ error: 'Payment payload does not match this route payment requirement.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }

  if (paymentPayload.resource?.url && paymentPayload.resource.url !== required.resource.url) {
    return NextResponse.json({ error: 'Payment payload resource URL does not match this request.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }

  let verification: VerifyResponse;
  try {
    verification = await facilitatorCall('verify', paymentPayload, requirement) as VerifyResponse;
  } catch (error) {
    console.error('x402 facilitator verification failed', error);
    return NextResponse.json({ error: 'Payment verification service is temporarily unavailable.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }

  if (!verification.isValid) {
    const rejected = paymentRequiredFor(request, config, verification.invalidReason || 'Payment verification failed');
    return paymentRequiredResponse(rejected);
  }

  let result: T;
  try {
    result = await handler();
  } catch (error) {
    console.error('Paid machine endpoint failed before settlement', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Paid endpoint failed before settlement. No settlement was requested.' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }

  let settlement: SettlementResponse;
  try {
    settlement = await facilitatorCall('settle', paymentPayload, requirement) as SettlementResponse;
  } catch (error) {
    console.error('x402 settlement request failed', error);
    return NextResponse.json({ error: 'Payment settlement could not be confirmed; paid response withheld.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }

  if (!settlement.success) {
    const rejected = paymentRequiredFor(request, config, settlement.errorReason || 'Payment settlement failed');
    const response = paymentRequiredResponse(rejected);
    response.headers.set('PAYMENT-RESPONSE', toBase64Json(settlement));
    return response;
  }

  const resultBody: Record<string, unknown> = result && typeof result === 'object'
    ? { ...(result as Record<string, unknown>) }
    : { result };

  return NextResponse.json({
    ...resultBody,
    payment: {
      protocol: 'x402',
      network: settlement.network || X402_NETWORK,
      payer: settlement.payer || verification.payer || '',
      transaction: settlement.transaction || '',
      amountAtomic: settlement.amount || requirement.amount,
      asset: requirement.asset,
    },
  }, {
    headers: {
      'PAYMENT-RESPONSE': toBase64Json(settlement),
      'Cache-Control': 'no-store',
    },
  });
}
