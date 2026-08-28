import { NextResponse } from 'next/server';
import { getEarthProviderCoverage, searchEarthProperties } from '../../../../lib/earth-properties';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function optionalNumber(value: string | null) {
  if (value === null || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function anyProviderConfigured() {
  return getEarthProviderCoverage().some((provider) => provider.configured);
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const query = String(url.searchParams.get('q') || '').trim().slice(0, 80);
    const category = String(url.searchParams.get('category') || 'all').trim().toLowerCase();
    const transactionType = String(url.searchParams.get('type') || 'all').trim().toLowerCase();
    const latitude = optionalNumber(url.searchParams.get('lat'));
    const longitude = optionalNumber(url.searchParams.get('lng'));

    if (!query && (!Number.isFinite(latitude) || !Number.isFinite(longitude))) {
      const providers = getEarthProviderCoverage();
      return NextResponse.json({
        configured: providers.some((provider) => provider.configured),
        provider: 'Global authorized property federation',
        providers,
        listings: [],
        message: 'Search any city, country, ZIP/postcode or address, use your location, or tap the globe.',
      }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
    }

    const result = await searchEarthProperties({
      query: query || undefined,
      latitude,
      longitude,
      category,
      transactionType,
    });

    return NextResponse.json({
      ...result,
      query: query || null,
      location: Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : null,
      category,
      transactionType,
      rights: {
        browsing: 'Real-property listing discovery only.',
        digitalTwin: 'A digital twin or NFT does not itself convey a deed, title, tenancy, rent rights, or an investment interest.',
        physicalPurchase: 'A real-property acquisition requires the normal contract, title, escrow/attorney, funding and deed-recording process.',
      },
    }, {
      headers: { 'Cache-Control': 'private, no-store, max-age=0' },
    });
  } catch (error) {
    console.error('Earth property search failed', error);
    return NextResponse.json({
      configured: anyProviderConfigured(),
      provider: 'Global authorized property federation',
      providers: getEarthProviderCoverage(),
      listings: [],
      error: 'Real-property search is temporarily unavailable. No replacement or fabricated listings were returned.',
    }, { status: 503, headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  }
}
