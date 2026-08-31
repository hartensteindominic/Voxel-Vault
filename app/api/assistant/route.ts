import { NextResponse } from 'next/server';
import { answerGalacticQuestion } from '../../../lib/assistant';
import { requireJsonRequest, requireTrustedOrigin, safeClientIp } from '../../../lib/request-security';
import { bankingErrorResponse } from '../../../lib/banking-http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const WINDOW_MS = 60_000;
const LIMIT = 24;
const buckets = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string) {
  const now = Date.now();
  const current = buckets.get(ip);

  if (!current || current.resetAt <= now) {
    buckets.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }

  if (current.count >= LIMIT) return false;
  current.count += 1;
  return true;
}

export async function POST(request: Request) {
  try {
    requireJsonRequest(request);
    requireTrustedOrigin(request);

    const ip = safeClientIp(request);
    if (!checkRateLimit(ip)) {
      return NextResponse.json({
        ok: false,
        error: { code: 'RATE_LIMITED', message: 'Orbit is receiving too many messages. Please try again in a moment.' }
      }, {
        status: 429,
        headers: { 'Cache-Control': 'no-store', 'Retry-After': '60' }
      });
    }

    const body = await request.json();
    const message = String(body.message || '').trim();
    if (!message || message.length > 500) {
      return NextResponse.json({
        ok: false,
        error: { code: 'INVALID_MESSAGE', message: 'Please enter a support question under 500 characters.' }
      }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
    }

    const reply = answerGalacticQuestion(message);
    return NextResponse.json({ ok: true, reply }, {
      headers: {
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex, nofollow'
      }
    });
  } catch (error) {
    return bankingErrorResponse(error);
  }
}
