import { BankingError } from './banking';

export function requireJsonRequest(request: Request) {
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new BankingError(415, 'JSON_REQUIRED', 'This endpoint only accepts JSON requests.');
  }
}

export function requireTrustedOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin) return;

  let requestOrigin = '';
  try {
    requestOrigin = new URL(request.url).origin;
  } catch {
    throw new BankingError(400, 'INVALID_REQUEST_URL', 'The request URL is invalid.');
  }

  if (origin !== requestOrigin) {
    throw new BankingError(403, 'UNTRUSTED_ORIGIN', 'Cross-site requests are not allowed.');
  }
}

export function safeClientIp(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for') || '';
  const first = forwarded.split(',')[0]?.trim();
  return (first || 'unknown').slice(0, 80);
}
