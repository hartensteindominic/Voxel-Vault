import { NextResponse } from 'next/server';
import { requireJsonRequest, requireTrustedOrigin, safeClientIp } from '../../../lib/request-security';
import { bankingErrorResponse } from '../../../lib/banking-http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const WINDOW_MS = 60_000;
const LIMIT = 20;
const buckets = new Map<string, { count: number; resetAt: number }>();

type Category = { name: string; amount: number; percent: number };
type RecentTransaction = { merchant: string; category: string; direction: 'in' | 'out'; amount: number; confidence?: number };
type Snapshot = {
  cash: number;
  income: number;
  expenses: number;
  net: number;
  recurring: number;
  forecast: number;
  runwayDays: number;
  categories: Category[];
  recent: RecentTransaction[];
};

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

function finite(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(-1_000_000_000, Math.min(1_000_000_000, number)) : fallback;
}

function cleanText(value: unknown, max = 80) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
}

function cleanSnapshot(value: unknown): Snapshot {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const categoriesRaw = Array.isArray(source.categories) ? source.categories : [];
  const recentRaw = Array.isArray(source.recent) ? source.recent : [];
  return {
    cash: finite(source.cash),
    income: Math.max(0, finite(source.income)),
    expenses: Math.max(0, finite(source.expenses)),
    net: finite(source.net),
    recurring: Math.max(0, finite(source.recurring)),
    forecast: Math.max(0, finite(source.forecast)),
    runwayDays: Math.max(0, Math.min(3650, Math.round(finite(source.runwayDays)))),
    categories: categoriesRaw.slice(0, 8).map((item) => {
      const row = item && typeof item === 'object' ? item as Record<string, unknown> : {};
      return {
        name: cleanText(row.name, 50) || 'Other',
        amount: Math.max(0, finite(row.amount)),
        percent: Math.max(0, Math.min(100, Math.round(finite(row.percent)))),
      };
    }),
    recent: recentRaw.slice(0, 12).map((item) => {
      const row = item && typeof item === 'object' ? item as Record<string, unknown> : {};
      return {
        merchant: cleanText(row.merchant, 70) || 'Unknown',
        category: cleanText(row.category, 50) || 'Other',
        direction: row.direction === 'in' ? 'in' : 'out',
        amount: Math.max(0, finite(row.amount)),
        confidence: Math.max(0, Math.min(100, Math.round(finite(row.confidence, 0)))),
      };
    }),
  };
}

function dollars(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

function fallbackAnswer(question: string, snapshot: Snapshot) {
  const q = question.toLowerCase();
  const biggest = snapshot.categories[0];
  if (/spend|expense|where|cost/.test(q)) {
    return biggest
      ? `${biggest.name} is the largest tracked spending category at ${dollars(biggest.amount)} (${biggest.percent}% of expenses). Total tracked spending is ${dollars(snapshot.expenses)}.`
      : `Tracked spending is ${dollars(snapshot.expenses)}. Add or import more transactions for a category-level breakdown.`;
  }
  if (/revenue|income|received|sales/.test(q)) {
    return `Tracked money received is ${dollars(snapshot.income)}. After ${dollars(snapshot.expenses)} of spending, net cash flow is ${snapshot.net >= 0 ? '+' : ''}${dollars(snapshot.net)}.`;
  }
  if (/runway|cash/.test(q)) {
    return `Available operating cash is ${dollars(snapshot.cash)}. The simple tracked-spend runway estimate is about ${snapshot.runwayDays} days, with ${dollars(snapshot.forecast)} projected ending cash over the next 30 days.`;
  }
  if (/hire|employee|afford/.test(q)) {
    return `Tracked net cash flow is ${snapshot.net >= 0 ? '+' : ''}${dollars(snapshot.net)}, with ${dollars(snapshot.forecast)} projected ending cash. Before hiring, model full compensation, payroll taxes, benefits, and several months of runway.`;
  }
  if (/recurring|subscription|software/.test(q)) {
    return `${dollars(snapshot.recurring)} of tracked expenses are marked recurring. Review owner, usage, renewal date, and price changes for each recurring vendor.`;
  }
  return `The business has ${dollars(snapshot.cash)} of tracked cash, ${dollars(snapshot.income)} received, ${dollars(snapshot.expenses)} spent, and ${snapshot.net >= 0 ? '+' : ''}${dollars(snapshot.net)} net cash flow. Ask about spending, revenue, runway, recurring costs, or a planned hire.`;
}

function extractText(payload: unknown) {
  if (!payload || typeof payload !== 'object') return '';
  const data = payload as { output_text?: unknown; output?: unknown };
  if (typeof data.output_text === 'string' && data.output_text.trim()) return data.output_text.trim();
  if (!Array.isArray(data.output)) return '';
  const parts: string[] = [];
  for (const item of data.output) {
    if (!item || typeof item !== 'object') continue;
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (!part || typeof part !== 'object') continue;
      const text = (part as { text?: unknown }).text;
      if (typeof text === 'string' && text.trim()) parts.push(text.trim());
    }
  }
  return parts.join('\n').trim();
}

export async function POST(request: Request) {
  try {
    requireJsonRequest(request);
    requireTrustedOrigin(request);

    const ip = safeClientIp(request);
    if (!checkRateLimit(ip)) {
      return NextResponse.json({ reply: 'AI analysis is receiving too many requests. Try again in about a minute.' }, {
        status: 429,
        headers: { 'Cache-Control': 'no-store', 'Retry-After': '60' },
      });
    }

    const body = await request.json() as { question?: unknown; snapshot?: unknown };
    const question = cleanText(body.question, 500);
    if (!question) {
      return NextResponse.json({ reply: 'Ask a question about the tracked business finances.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
    }

    const snapshot = cleanSnapshot(body.snapshot);
    const fallback = fallbackAnswer(question, snapshot);
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json({ reply: fallback, mode: 'local' }, { headers: { 'Cache-Control': 'no-store' } });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: process.env.BUSINESS_AI_MODEL || 'gpt-5.6-luna',
          instructions: [
            'You are Galactic AI, a concise business financial monitoring assistant.',
            'Analyze only the numerical snapshot supplied by the application. Never claim access to bank accounts, accounting systems, or data not present in the snapshot.',
            'You may explain cash flow, categorize trends, flag unusual spending, compare categories, and discuss simple planning scenarios.',
            'Do not initiate, authorize, or imply that you can move money, make payments, trade, borrow, or change financial accounts.',
            'Do not present estimates as guaranteed outcomes. Clearly distinguish tracked data from projections.',
            'For tax, legal, accounting, lending, investment, or regulated decisions, state the relevant limitation briefly when it matters.',
            'Prefer a direct answer in 2-4 short sentences. Include concrete numbers from the snapshot when useful.',
          ].join(' '),
          input: `Business finance snapshot:\n${JSON.stringify(snapshot)}\n\nUser question: ${question}`,
          max_output_tokens: 260,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        return NextResponse.json({ reply: fallback, mode: 'fallback' }, { headers: { 'Cache-Control': 'no-store' } });
      }

      const payload = await response.json();
      const reply = extractText(payload) || fallback;
      return NextResponse.json({ reply, mode: 'ai' }, { headers: { 'Cache-Control': 'no-store' } });
    } catch {
      return NextResponse.json({ reply: fallback, mode: 'fallback' }, { headers: { 'Cache-Control': 'no-store' } });
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    return bankingErrorResponse(error);
  }
}
