import { NextResponse } from 'next/server';
import { DIGITAL_ESTATE_DISCLOSURE, formatUsdCents, getDigitalEstate } from '../../../../lib/digital-estates';
import { verifyDigitalEstateMetadataSignature } from '../../../../lib/digital-estate-mint';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function escapeXml(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const estateId = url.searchParams.get('estateId') || '';
  const signature = url.searchParams.get('sig') || '';
  const estate = getDigitalEstate(estateId);
  if (!estate || !verifyDigitalEstateMetadataSignature(estateId, signature)) {
    return NextResponse.json({ error: 'Digital Estate metadata is unavailable.' }, { status: 404 });
  }

  const price = formatUsdCents(estate.purchasePriceCents);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200">
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#070912"/><stop offset="1" stop-color="${escapeXml(estate.roof)}"/></linearGradient>
      <linearGradient id="land" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${escapeXml(estate.terrain)}"/><stop offset="1" stop-color="#080a0f"/></linearGradient>
      <filter id="glow"><feGaussianBlur stdDeviation="10" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>
    <rect width="1200" height="1200" fill="url(#sky)"/>
    <circle cx="960" cy="220" r="110" fill="${escapeXml(estate.accent)}" opacity=".16" filter="url(#glow)"/>
    <path d="M0 760 L1200 620 L1200 1200 L0 1200Z" fill="url(#land)"/>
    <g transform="translate(185 340)">
      <path d="M90 400 L400 240 L830 350 L510 530Z" fill="${escapeXml(estate.structure)}" opacity=".92"/>
      <path d="M90 400 L90 625 L510 820 L510 530Z" fill="#171a22"/>
      <path d="M830 350 L830 600 L510 820 L510 530Z" fill="#0c1018"/>
      <path d="M190 380 L410 275 L720 350 L500 465Z" fill="${escapeXml(estate.roof)}"/>
      <g fill="${escapeXml(estate.accent)}" opacity=".88">
        <rect x="190" y="480" width="100" height="120" rx="5" transform="skewY(24)"/>
        <rect x="330" y="545" width="100" height="120" rx="5" transform="skewY(24)"/>
      </g>
    </g>
    <text x="76" y="95" fill="#ffffff" font-family="Arial, sans-serif" font-size="24" font-weight="700" letter-spacing="7">VOXEL VAULT DIGITAL ESTATE</text>
    <text x="76" y="985" fill="#ffffff" font-family="Arial, sans-serif" font-size="70" font-weight="800">${escapeXml(estate.name)}</text>
    <text x="76" y="1055" fill="${escapeXml(estate.accent)}" font-family="Arial, sans-serif" font-size="46" font-weight="800">${escapeXml(price)}</text>
    <text x="76" y="1110" fill="#9ea7ba" font-family="Arial, sans-serif" font-size="24">${estate.beds} BED · ${estate.baths} BATH · ${estate.sqft.toLocaleString('en-US')} SQ FT · DIGITAL ONLY</text>
  </svg>`;
  const image = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  const origin = url.origin;

  return NextResponse.json({
    name: `${estate.name} · Digital Estate`,
    description: `${estate.summary} ${DIGITAL_ESTATE_DISCLOSURE}`,
    image,
    animation_url: `${origin}/vault/estates?estate=${encodeURIComponent(estate.id)}`,
    external_url: `${origin}/vault/estates?estate=${encodeURIComponent(estate.id)}`,
    attributes: [
      { trait_type: 'Asset Type', value: 'Digital Estate' },
      { trait_type: 'Architecture', value: estate.architecture },
      { trait_type: 'Bedrooms', value: estate.beds },
      { trait_type: 'Bathrooms', value: estate.baths },
      { trait_type: 'Modeled Square Feet', value: estate.sqft },
      { trait_type: 'Modeled Lot Square Feet', value: estate.lotSqft },
      { trait_type: 'Digital List Price USD', value: estate.purchasePriceCents / 100 },
      { trait_type: 'Real-World Reference USD', value: estate.referenceValueCents / 100 },
      { trait_type: 'Real Property Rights', value: 'None' },
      { trait_type: 'Rent Rights', value: 'None' },
      { trait_type: 'Deed', value: 'None' },
    ],
    properties: {
      digital_only: true,
      real_property_rights: false,
      reference_value_is_appraisal: false,
      purchase_price_matches_reference_value: estate.purchasePriceCents === estate.referenceValueCents,
    },
  }, {
    headers: {
      'Cache-Control': 'public, max-age=300, s-maxage=3600',
      'X-Robots-Tag': 'noindex',
    },
  });
}
