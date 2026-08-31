import { setCardFrozen } from '../../../../../lib/banking';
import { requireBankingUser } from '../../../../../lib/banking-auth';
import { bankingErrorResponse, bankingJson } from '../../../../../lib/banking-http';
import { requireJsonRequest, requireTrustedOrigin } from '../../../../../lib/request-security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    requireJsonRequest(request);
    requireTrustedOrigin(request);
    const userId = requireBankingUser(request);
    const body = await request.json();
    const result = await setCardFrozen({
      userId,
      cardId: String(body.cardId || ''),
      frozen: Boolean(body.frozen)
    });

    return bankingJson({ ok: true, card: result });
  } catch (error) {
    return bankingErrorResponse(error);
  }
}
