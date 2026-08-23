import { NextResponse } from 'next/server';
import { stripe } from '../../../lib/stripe-server';
import { getCatalogItem } from '../../../lib/catalog';
import { getSupabaseAdmin } from '../../../lib/supabase-admin';
import { getFulfillmentConfig } from '../../../lib/fulfillment';

const NFT_FEE_CENTS = 299;
const DEFAULT_MARKUP_PERCENT = 25;
const WALLET_RE = /^0x[a-fA-F0-9]{40}$/;
const SHIPPING_CENTS = Number(process.env.VOXEL_US_SHIPPING_CENTS || 0);

function getMarkupPercent() {
  const configured = Number(process.env.VOXEL_MARKUP_PERCENT || DEFAULT_MARKUP_PERCENT);
  return Number.isFinite(configured) && configured >= 0 && configured <= 500 ? configured : DEFAULT_MARKUP_PERCENT;
}

function customerPriceCents(basePrice) {
  const numeric = Number(basePrice);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  const markup = getMarkupPercent();
  return Math.ceil(numeric * (1 + markup / 100) * 100);
}

export async function POST(request: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const auth = request.headers.get('authorization');
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const { catalogId, wallet } = await request.json();
    const id = Number(catalogId);
    const normalizedWallet = String(wallet || '').toLowerCase();
    if (!Number.isInteger(id) || id < 1) return NextResponse.json({ error: 'Invalid product' }, { status: 400 });
    if (!WALLET_RE.test(normalizedWallet)) return NextResponse.json({ error: 'Connect a valid wallet first' }, { status: 400 });

    const item = getCatalogItem(id - 1);
    if (!item) return NextResponse.json({ error: 'Product unavailable' }, { status: 404 });
    if (!item.sourceUrl || !item.sourceName) return NextResponse.json({ error: 'This product has no verified online source' }, { status: 409 });

    const fulfillment = getFulfillmentConfig(item.id);
    if (!fulfillment) {
      return NextResponse.json({
        error: 'This product is source-verified but not connected to a Voxel Vault fulfillment supplier yet.',
        code: 'FULFILLMENT_NOT_READY',
        sourceUrl: item.sourceUrl,
      }, { status: 503 });
    }
    if (fulfillment.costUsd === null) {
      return NextResponse.json({
        error: 'Supplier cost is not configured for this SKU. Checkout is intentionally locked until the dropship cost is known.',
        code: 'FULFILLMENT_COST_NOT_CONFIGURED',
      }, { status: 503 });
    }

    const physicalCents = customerPriceCents(fulfillment.costUsd);
    const basePriceCents = Math.round(Number(fulfillment.costUsd) * 100);
    if (physicalCents === null || physicalCents < 50 || !Number.isFinite(basePriceCents) || basePriceCents < 50) return NextResponse.json({ error: 'Supplier price is not configured for checkout' }, { status: 500 });

    const markupPercent = getMarkupPercent();
    const grossMerchandiseMarginCents = physicalCents - basePriceCents;
    const shippingCents = Number.isInteger(SHIPPING_CENTS) && SHIPPING_CENTS >= 0 ? SHIPPING_CENTS : 0;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.voxelvault.io';
    const metadata = {
      mint_mode: 'physical_nft',
      catalog_id: String(id),
      catalog_key: item.id,
      wallet: normalizedWallet,
      buyer_id: user.id,
      physical_amount_cents: String(physicalCents),
      source_cost_cents: String(basePriceCents),
      gross_merchandise_margin_cents: String(grossMerchandiseMarginCents),
      markup_percent: String(markupPercent),
      markup_basis: 'configured_supplier_cost',
      nft_amount_cents: String(NFT_FEE_CENTS),
      shipping_amount_cents: String(shippingCents),
      product_source_url: item.sourceUrl,
      fulfillment_provider: fulfillment.provider,
    };

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: user.email || undefined,
      billing_address_collection: 'required',
      shipping_address_collection: { allowed_countries: ['US'] },
      phone_number_collection: { enabled: true },
      line_items: [
        { quantity: 1, price_data: { currency: 'usd', unit_amount: physicalCents, product_data: { name: item.name, description: `Real-world product fulfilled through the configured supplier. Voxel Vault retail price includes a ${markupPercent}% store markup.` } } },
        { quantity: 1, price_data: { currency: 'usd', unit_amount: NFT_FEE_CENTS, product_data: { name: `${item.name} · Voxel Vault Digital Twin`, description: 'Original interactive digital collectible for your Vault, Room, and world placement.' } } },
        ...(shippingCents > 0 ? [{ quantity: 1, price_data: { currency: 'usd', unit_amount: shippingCents, product_data: { name: 'Insured home delivery', description: 'Shipping is included in the single checkout total shown before payment.' } } }] : []),
      ],
      metadata,
      payment_intent_data: { metadata },
      success_url: `${appUrl}/mint?catalog=${id}&session_id={CHECKOUT_SESSION_ID}&physical=1`,
      cancel_url: `${appUrl}/mint?catalog=${id}&cancelled=1`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('physical + NFT checkout failed', error);
    return NextResponse.json({ error: 'Unable to start physical + NFT checkout' }, { status: 500 });
  }
}
