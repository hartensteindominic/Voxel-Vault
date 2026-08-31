import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_MESSAGE = 500;
const MAX_HISTORY = 10;
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 18;
const SECRET_CUE = /(password|passcode|pin|cvv|cvc|one.?time|otp|verification code|recovery phrase|seed phrase|private key|api key|secret key)/i;

type OrbitHistoryItem = { role: 'user' | 'assistant'; text: string };

type RateEntry = { count: number; resetAt: number };

const globalRate = globalThis as typeof globalThis & { __galacticOrbitRate?: Map<string, RateEntry> };
const rate = globalRate.__galacticOrbitRate || new Map<string, RateEntry>();
globalRate.__galacticOrbitRate = rate;

function response(data: Record<string, unknown>, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': 'private, no-store, max-age=0' },
  });
}

function text(value: unknown, max = MAX_MESSAGE) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function finite(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clientKey(request: Request) {
  const forwarded = text(request.headers.get('x-forwarded-for'), 120).split(',')[0]?.trim();
  return forwarded || 'anonymous';
}

function allowed(request: Request) {
  const key = clientKey(request);
  const now = Date.now();
  const current = rate.get(key);
  if (!current || current.resetAt <= now) {
    rate.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (current.count >= MAX_REQUESTS) return false;
  current.count += 1;
  return true;
}

function safeHistory(value: unknown): OrbitHistoryItem[] {
  if (!Array.isArray(value)) return [];
  return value.slice(-MAX_HISTORY).flatMap((item: any) => {
    const role = item?.role === 'assistant' ? 'assistant' : item?.role === 'user' ? 'user' : null;
    const content = text(item?.text, 700);
    if (!role || !content || SECRET_CUE.test(content)) return [];
    return [{ role, text: content }];
  });
}

function safeTransactions(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 5).map((item: any) => ({
    name: text(item?.name || item?.category || 'Activity', 50),
    category: text(item?.category || 'Activity', 40),
    amount: finite(item?.amount),
    date: text(item?.date || '', 30),
  }));
}

function safeContext(value: any) {
  return {
    environment: value?.sandboxConnected ? 'Increase sandbox' : 'demo',
    checking: finite(value?.checking),
    savings: finite(value?.savings),
    blueCardFrozen: value?.blueFrozen === true,
    pinkCardFrozen: value?.pinkFrozen === true,
    transactions: safeTransactions(value?.transactions),
  };
}

function transcript(history: OrbitHistoryItem[], message: string, context: ReturnType<typeof safeContext>) {
  const prior = history.map((item) => `${item.role === 'assistant' ? 'Orbit' : 'User'}: ${item.text}`).join('\n');
  return [
    'Current sanitized dashboard snapshot:',
    JSON.stringify(context),
    prior ? `Recent conversation:\n${prior}` : '',
    `User: ${message}`,
  ].filter(Boolean).join('\n\n');
}

function outputText(payload: any) {
  const direct = text(payload?.output_text, 1800);
  if (direct) return direct;
  const output = Array.isArray(payload?.output) ? payload.output : [];
  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const part of content) {
      const candidate = text(part?.text, 1800);
      if (candidate) return candidate;
    }
  }
  return '';
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > 32_000) return response({ ok: false, error: 'Orbit request is too large.' }, 413);
  if (!allowed(request)) return response({ ok: false, error: 'Orbit is receiving too many messages. Try again in a moment.', fallback: true }, 429);

  const body = await request.json().catch(() => null);
  const message = text(body?.message);
  if (!message) return response({ ok: false, error: 'Message is required.' }, 400);
  if (SECRET_CUE.test(message)) {
    return response({
      ok: true,
      mode: 'local-safety',
      text: 'Please do not share passwords, PINs, CVVs, one-time codes, recovery phrases, private keys, or API keys here. Orbit never needs those secrets.',
    });
  }

  const apiKey = text(process.env.OPENAI_API_KEY, 500);
  if (!apiKey) {
    return response({ ok: false, error: 'Conversational AI is not configured on the server.', fallback: true }, 503);
  }

  const history = safeHistory(body?.history);
  const context = safeContext(body?.context || {});
  const model = text(process.env.ORBIT_OPENAI_MODEL, 80) || 'gpt-5.4';

  const instructions = [
    'You are Orbit, the conversational assistant inside Galactic Trust.',
    'Be fluent, warm, concise, and natural. Follow the conversation and answer follow-up questions in context instead of repeating canned introductions.',
    'Galactic Trust is a financial technology product, not a bank. Current banking is demo or Increase sandbox only; sandbox balances and transfers use pretend money. Production customer deposits and real-money movement are locked.',
    'Never claim you executed, approved, reversed, froze, funded, or transferred anything. You are read-only conversational help. Direct users to the appropriate UI control when they want to take an action.',
    'Never ask for or repeat passwords, PINs, CVVs, one-time codes, recovery phrases, private keys, API keys, full card numbers, or full bank-account numbers.',
    'Use only the sanitized dashboard snapshot supplied in the prompt for account-specific statements. If a value is absent, say you cannot see it rather than guessing.',
    'Do not promise FDIC insurance, sponsor-bank coverage, legal approval, returns, or launch status that is not explicitly in the supplied context.',
    'For crypto, clearly describe it as demo/practice unless the context explicitly changes in a future approved production implementation.',
    'Prefer 1 to 4 short paragraphs. Ask at most one clarifying question when truly necessary.',
  ].join(' ');

  try {
    const upstream = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        instructions,
        input: transcript(history, message, context),
        max_output_tokens: 280,
        store: false,
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(12_000),
    });

    const payload = await upstream.json().catch(() => ({}));
    const answer = upstream.ok ? outputText(payload) : '';
    if (!answer) return response({ ok: false, error: 'Orbit AI is temporarily unavailable.', fallback: true }, 502);

    return response({
      ok: true,
      mode: 'ai',
      text: answer,
      canMoveRealMoney: false,
    });
  } catch {
    return response({ ok: false, error: 'Orbit AI is temporarily unavailable.', fallback: true }, 502);
  }
}
