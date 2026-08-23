import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase';
import { generateMarketingPack } from '@/lib/openai';

export async function POST(req: Request) {
  try {
    const supabase = await getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json();
    const required = ['businessName', 'businessType', 'goal', 'offer'];
    if (required.some((key) => typeof body[key] !== 'string' || !body[key].trim())) return NextResponse.json({ error: 'Missing business information' }, { status: 400 });
    if (body.website && (typeof body.website !== 'string' || body.website.length > 500)) return NextResponse.json({ error: 'Invalid website' }, { status: 400 });

    const { data: profile, error: profileError } = await supabase.from('profiles').select('plan').eq('id', user.id).single();
    if (profileError) throw profileError;
    const plan = profile?.plan ?? 'free';
    const monthlyLimit = plan === 'free' ? 3 : plan === 'pro' ? 100 : 500;
    const monthStart = new Date();
    monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
    const { count, error: countError } = await supabase.from('generations').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('created_at', monthStart.toISOString());
    if (countError) throw countError;
    if ((count ?? 0) >= monthlyLimit) return NextResponse.json({ error: `You've reached the ${monthlyLimit}-generation ${plan} plan limit for this month.` }, { status: 429 });

    const name = body.businessName.trim().slice(0, 200);
    const normalized = { user_id: user.id, name, business_type: body.businessType.trim().slice(0, 120), goal: body.goal.trim().slice(0, 300), offer: body.offer.trim().slice(0, 1000), website: body.website?.trim().slice(0, 500) || null, updated_at: new Date().toISOString() };
    const { data: existing } = await supabase.from('businesses').select('id').eq('user_id', user.id).eq('name', name).maybeSingle();
    const { data: business, error: businessError } = existing ? await supabase.from('businesses').update(normalized).eq('id', existing.id).select().single() : await supabase.from('businesses').insert(normalized).select().single();
    if (businessError || !business) throw businessError ?? new Error('Could not save business');

    const output = await generateMarketingPack({ businessName: name, businessType: normalized.business_type, goal: normalized.goal, offer: normalized.offer });
    const { error } = await supabase.from('generations').insert({ user_id: user.id, business_id: business.id, kind: 'weekly_marketing_pack', input: body, output });
    if (error) throw error;
    return NextResponse.json({ output, usage: { used: (count ?? 0) + 1, limit: monthlyLimit, plan } });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Generation failed' }, { status: 500 });
  }
}