import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const aiConfigured = Boolean(String(process.env.OPENAI_API_KEY || '').trim());
  return NextResponse.json({
    ok: true,
    assistant: 'Orbit',
    mode: aiConfigured ? 'ai-enhanced' : 'local-fallback',
    aiConfigured,
    conversationalHistory: true,
    canMoveRealMoney: false,
    note: aiConfigured
      ? 'Orbit can use the server-side conversational AI path. Banking actions remain separate and production money movement remains locked.'
      : 'Orbit is using the local conversational fallback until the server-side AI credential is configured. Banking actions remain separate and production money movement remains locked.',
  }, {
    headers: { 'Cache-Control': 'private, no-store, max-age=0' },
  });
}
