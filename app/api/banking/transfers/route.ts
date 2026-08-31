import { createTransfer } from '../../../../lib/banking';
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
    const transfer = await createTransfer({
      userId,
      fromAccountId: String(body.fromAccountId || ''),
      recipient: String(body.recipient || ''),
      amount: Number(body.amount),
      memo: body.memo ? String(body.memo) : undefined,
      idempotencyKey: request.headers.get('idempotency-key') || undefined
    });

    return bankingJson({ ok: true, transfer }, 201);
  } catch (error) {
    return bankingErrorResponse(error);
  }
}
