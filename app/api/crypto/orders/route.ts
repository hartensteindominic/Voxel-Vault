import { createCryptoOrder, type CryptoSide, type CryptoSymbol } from '../../../../lib/crypto';
import { requireBankingUser } from '../../../../lib/banking-auth';
import { bankingErrorResponse, bankingJson } from '../../../../lib/banking-http';
import { requireJsonRequest, requireTrustedOrigin } from '../../../../lib/request-security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    requireJsonRequest(request);
    requireTrustedOrigin(request);
    const userId = requireBankingUser(request);
    const body = await request.json();

    const symbol = String(body.symbol || '').toUpperCase() as CryptoSymbol;
    const side = String(body.side || '').toLowerCase() as CryptoSide;
    const idempotencyKey = String(request.headers.get('idempotency-key') || body.idempotencyKey || '');

    const order = await createCryptoOrder({
      userId,
      symbol,
      side,
      usdAmount: Number(body.usdAmount),
      idempotencyKey
    });

    return bankingJson({ ok: true, order }, 201);
  } catch (error) {
    return bankingErrorResponse(error);
  }
}
