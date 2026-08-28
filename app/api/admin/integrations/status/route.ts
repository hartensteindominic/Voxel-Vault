import { NextResponse } from 'next/server';
import { requireVoxelVaultAdmin } from '../../../../../lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function has(name: string) {
  return Boolean(String(process.env[name] || '').trim());
}

function truthy(name: string) {
  return String(process.env[name] || '').trim().toLowerCase() === 'true';
}

function nonzero(name: string) {
  const value = String(process.env[name] || '').trim();
  return Boolean(value && !/^0x0{40}$/i.test(value));
}

function item(id: string, label: string, category: string, state: string, detail: string, configured: boolean, mode = '') {
  return { id, label, category, state, detail, configured, mode };
}

export async function GET(request: Request) {
  const auth = await requireVoxelVaultAdmin(request);
  if (auth.ok === false) return NextResponse.json({ ok: false, error: auth.error, setupRequired: auth.setupRequired || false }, { status: auth.status });

  const supabaseServer = has('SUPABASE_URL') && (has('SUPABASE_SECRET_KEY') || has('SUPABASE_SERVICE_ROLE_KEY'));
  const supabaseBrowser = (has('NEXT_PUBLIC_SUPABASE_URL') || has('SUPABASE_URL')) && (has('NEXT_PUBLIC_SUPABASE_ANON_KEY') || has('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'));
  const bridge = has('BRIDGE_DATASET_ID') && has('BRIDGE_ACCESS_TOKEN');
  const domain = has('DOMAIN_CLIENT_ID') && has('DOMAIN_CLIENT_SECRET');
  const dinari = has('DINARI_API_KEY_ID') && has('DINARI_API_SECRET_KEY');
  const algorand = has('ALGORAND_INDEXER_BASE_URL') && truthy('ALGORAND_READONLY_POSITION_VERIFICATION_ENABLED');
  const cdp = has('CDP_API_KEY_ID') && has('CDP_API_KEY_SECRET');
  const stripe = has('STRIPE_SECRET_KEY');
  const meshy = has('MESHY_API_KEY');
  const x402 = nonzero('X402_PAY_TO');
  const liquidity = has('BASE_LIQUIDITY_MANAGER_ADDRESS') && nonzero('LIQUIDITY_OWNER_ADDRESS');
  const partnerFeeds = has('EARTH_PARTNER_FEEDS_JSON');

  const regulatedChecks = [
    'REAL_ESTATE_REGISTERED_INTERMEDIARY_ACTIVE',
    'REAL_ESTATE_OFFERING_AUTHORIZED',
    'REAL_ESTATE_SECURITIES_COUNSEL_APPROVED',
    'REAL_ESTATE_TITLE_COUNSEL_APPROVED',
    'REAL_ESTATE_ISSUER_ENTITY_VERIFIED',
    'REAL_ESTATE_KYC_AML_CONFIGURED',
    'REAL_ESTATE_ESCROW_SETTLEMENT_CONFIGURED',
    'REAL_ESTATE_CUSTODY_RAILS_CONFIGURED',
    'REAL_ESTATE_CAP_TABLE_TRANSFER_CONFIGURED',
    'REAL_ESTATE_PROPERTY_ACCOUNTING_CONFIGURED',
    'REAL_ESTATE_TAX_REPORTING_CONFIGURED',
    'REAL_ESTATE_CONTRACTS_AUDITED',
    'REAL_ESTATE_PRIVACY_SECURITY_APPROVED',
    'REAL_ESTATE_INCIDENT_RESPONSE_APPROVED',
    'REAL_ESTATE_PROVIDER_INTEGRATION_VERIFIED',
  ];
  const regulatedPassed = regulatedChecks.filter(truthy).length;

  const integrations = [
    item('meshy', 'Meshy 7', '3D + AI', meshy ? 'CONFIGURED' : 'NOT CONFIGURED', meshy ? 'Server key is present for controlled multi-image property reconstruction.' : 'MESHY_API_KEY is not visible to this deployment.', meshy, 'server-only'),
    item('overture', 'Overture Maps', 'World data', 'OPEN · READY', 'Global building PMTiles are used without a private API key.', true, 'open data'),
    item('kartaview', 'KartaView', 'World data', 'OPEN · READY', 'Open street-level imagery is available without a paid Google Maps key.', true, 'CC BY-SA'),
    item('supabase-server', 'Supabase server', 'Identity + storage', supabaseServer ? 'CONFIGURED' : 'NOT CONFIGURED', 'Owner auth, durable records and private storage depend on server credentials.', supabaseServer, 'server-only'),
    item('supabase-browser', 'Supabase browser auth', 'Identity + storage', supabaseBrowser ? 'CONFIGURED' : 'NOT CONFIGURED', 'User sign-in and browser sessions use publishable Supabase configuration.', supabaseBrowser, 'publishable'),
    item('stripe', 'Stripe', 'Payments', stripe ? 'CONFIGURED' : 'NOT CONFIGURED', 'Server-authoritative checkout can run only when the Stripe secret is present.', stripe, 'server-only'),
    item('bridge', 'Bridge / RESO MLS', 'Property market', bridge ? 'CONFIGURED' : 'AWAITING ACCESS', 'Authorized U.S. listing coverage requires both dataset ID and access token.', bridge, 'licensed feed'),
    item('domain', 'Domain Australia', 'Property market', domain ? 'CONFIGURED' : 'AWAITING ACCESS', 'Australian listing access requires provider OAuth credentials.', domain, 'licensed feed'),
    item('partner-feeds', 'Additional property feeds', 'Property market', partnerFeeds ? 'CONFIGURED' : 'OPTIONAL', 'Country/provider adapters can be added through the normalized partner-feed contract.', partnerFeeds, 'server-only'),
    item('dinari', 'Dinari', 'Investments', dinari ? 'CONFIGURED' : 'NOT CONFIGURED', `Provider credentials ${dinari ? 'are present' : 'are not present'}; live execution still depends on separate approval gates.`, dinari, String(process.env.DINARI_ENVIRONMENT || 'sandbox')),
    item('algorand', 'Algorand Indexer', 'Ownership evidence', algorand ? 'READ-ONLY ENABLED' : 'DISABLED', 'Position verification is intentionally read-only and does not authorize signing or trading.', algorand, 'read-only'),
    item('coinbase-cdp', 'Coinbase CDP', 'Payments + x402', cdp ? 'CONFIGURED' : 'NOT CONFIGURED', 'Facilitator credentials are server-only.', cdp, 'server-only'),
    item('x402', 'x402 revenue receiver', 'Payments + x402', x402 ? 'CONFIGURED' : 'NOT CONFIGURED', 'A nonzero public receiver is required before x402 revenue routing can be considered configured.', x402, 'public receiver'),
    item('base', 'Base RPC', 'Blockchain', 'READY', 'Public Base and Base Sepolia RPC fallbacks are built into the app configuration.', true, 'public RPC'),
    item('liquidity', 'Base liquidity engine', 'Blockchain', liquidity ? 'CONFIGURED · LOCKED' : 'NOT CONFIGURED', 'Addresses may be configured while autonomous/mainnet execution remains separately gated.', liquidity, 'fail-closed'),
    item('regulated-property', 'Direct real-estate launch gates', 'Compliance', regulatedPassed === regulatedChecks.length ? 'EVIDENCE GATES COMPLETE' : 'LOCKED', `${regulatedPassed}/${regulatedChecks.length} reviewed readiness flags are true. This status alone never authorizes an offering.`, regulatedPassed === regulatedChecks.length, 'fail-closed'),
    item('live-investing', 'Voxel Vault live property investing', 'Compliance', truthy('REAL_ESTATE_LIVE_INVESTING_ENABLED') ? 'SWITCH ON' : 'OFF', 'The final product switch remains separate from provider, legal, title, custody and accounting evidence.', truthy('REAL_ESTATE_LIVE_INVESTING_ENABLED'), 'final switch'),
    item('auto-reinvest', 'Live auto-reinvestment', 'Compliance', truthy('REAL_ESTATE_LIVE_AUTO_REINVESTMENT_ENABLED') ? 'SWITCH ON' : 'OFF', 'Automatic real-money reinvestment remains independently fail-closed.', truthy('REAL_ESTATE_LIVE_AUTO_REINVESTMENT_ENABLED'), 'final switch'),
  ];

  const configuredCount = integrations.filter((entry) => entry.configured).length;
  return NextResponse.json({
    ok: true,
    generatedAt: new Date().toISOString(),
    environment: String(process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown'),
    configuredCount,
    totalCount: integrations.length,
    integrations,
    safety: {
      secretsReturned: false,
      valuesReturned: false,
      note: 'This endpoint returns status booleans and reviewed modes only. It never returns API keys, tokens, private keys or secret values.',
    },
  }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
}
