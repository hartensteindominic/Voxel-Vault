import { getBankingSummary } from '../../../../lib/banking';
import { requireBankingUser } from '../../../../lib/banking-auth';
import { bankingErrorResponse, bankingJson } from '../../../../lib/banking-http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const userId = requireBankingUser(request);
    const summary = await getBankingSummary(userId);
    return bankingJson({ ok: true, summary });
  } catch (error) {
    return bankingErrorResponse(error);
  }
}
