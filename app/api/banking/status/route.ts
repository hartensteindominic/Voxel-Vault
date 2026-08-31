import { bankingStatus } from '../../../../lib/banking';
import { bankingJson } from '../../../../lib/banking-http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const status = bankingStatus();

  return bankingJson({
    ok: true,
    ...status,
    productName: 'Galactic Trust',
    moneyMovement: status.liveWritesEnabled ? 'enabled' : 'disabled',
    warning: status.mode === 'demo'
      ? 'Demo banking only. Balances and transfers shown in the interface are simulated.'
      : undefined
  });
}
