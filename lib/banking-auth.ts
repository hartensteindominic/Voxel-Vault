import { createHmac, timingSafeEqual } from 'node:crypto';
import { BankingError } from './banking';

const DEMO_USER_ID = 'demo-nova';

function bankingMode() {
  return process.env.BANKING_MODE === 'partner' ? 'partner' : 'demo';
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function requireBankingUser(request: Request) {
  if (bankingMode() === 'demo') return DEMO_USER_ID;

  const secret = process.env.BANKING_AUTH_GATEWAY_SECRET || '';
  if (!secret) {
    throw new BankingError(
      503,
      'AUTH_NOT_CONFIGURED',
      'Live banking authentication is not configured yet.'
    );
  }

  const userId = request.headers.get('x-galactic-auth-user')?.trim() || '';
  const timestamp = request.headers.get('x-galactic-auth-timestamp')?.trim() || '';
  const signature = request.headers.get('x-galactic-auth-signature')?.trim() || '';

  if (!userId || !timestamp || !signature) {
    throw new BankingError(401, 'AUTH_REQUIRED', 'A verified Galactic Trust session is required.');
  }

  const timestampNumber = Number(timestamp);
  if (!Number.isFinite(timestampNumber)) {
    throw new BankingError(401, 'INVALID_AUTH', 'The banking session signature is invalid.');
  }

  const maxAgeMs = 5 * 60 * 1000;
  if (Math.abs(Date.now() - timestampNumber) > maxAgeMs) {
    throw new BankingError(401, 'EXPIRED_AUTH', 'The banking session signature has expired.');
  }

  const payload = `${userId}.${timestamp}`;
  const expected = createHmac('sha256', secret).update(payload).digest('hex');

  if (!safeEqual(expected, signature)) {
    throw new BankingError(401, 'INVALID_AUTH', 'The banking session signature is invalid.');
  }

  return userId;
}
