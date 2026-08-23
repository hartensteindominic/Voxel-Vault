'use client';

import Link from 'next/link';
import { REAL_WORLD_CATALOG } from '../../lib/realWorldCatalog';
import RealWorld3DNFT from '../components/RealWorld3DNFT';

const PRODUCT_ID = 'vault-spiral-table-lamp';

export default function MintPage() {
  const product = REAL_WORLD_CATALOG.find((entry) => entry.id === PRODUCT_ID) || REAL_WORLD_CATALOG[0];
  const modelUrl = product?.modelUri || product?.digitalTwin?.modelUrl;
  const exactModelVerified = Boolean(modelUrl && product?.digitalTwin?.exactModelVerified);
  const checkoutReady = Boolean(product?.fulfillmentReady && product?.purchaseAssetId && exactModelVerified);

  return <main className="page" id="main-content">
    <header>
      <Link href="/" className="brand">VOXEL VAULT</Link>
      <Link href="/" className="back">Back to launch product</Link>
    </header>

    <section className="hero">
      <small>LAUNCH PRODUCT PREVIEW</small>
      <h1>Buy the real thing.<br/><em>Keep its 3D collectible.</em></h1>
      <p>Voxel Vault is launching with one simple bundle: the physical LED Spiral Table Lamp shipped to your home, with its matching 3D collectible included automatically. Pay in normal USD. No wallet setup or crypto knowledge is required to buy.</p>
      <div className="price"><strong>${product.customerPriceUsd}</strong><span>target bundle price</span></div>
    </section>

    <section className="preview" aria-label="Launch product preview">
      <RealWorld3DNFT item={product} hero />
    </section>

    <section className="panel" aria-labelledby="status-title">
      <div className="intro"><small>CHECKOUT STATUS</small><h2 id="status-title">Preview now. Purchase when verified.</h2><p>Checkout remains locked until the physical fulfillment path and exact 3D asset have passed a complete test. We will not ask you to connect a wallet or offer a digital-only purchase as a substitute.</p></div>
      <div className="steps" role="list">
        <div className="step done" role="listitem"><b>01</b><div><strong>One physical-first bundle</strong><span>The real lamp is the product. The matching 3D collectible is included.</span></div><i>✓</i></div>
        <div className="step done" role="listitem"><b>02</b><div><strong>Normal USD checkout</strong><span>Card payment only for the customer-facing launch flow. No crypto steps required.</span></div><i>✓</i></div>
        <div className={`step ${exactModelVerified ? 'done' : 'pending'}`} role="listitem"><b>03</b><div><strong>Exact 3D verification</strong><span>{exactModelVerified ? 'The product-specific 3D collectible has passed review.' : 'The exact product-specific 3D collectible is still under review.'}</span></div><i>{exactModelVerified ? '✓' : '3'}</i></div>
        <div className={`step ${product.fulfillmentReady ? 'done' : 'pending'}`} role="listitem"><b>04</b><div><strong>Fulfillment test</strong><span>{product.fulfillmentReady ? 'Inventory, shipping, tracking, and delivery have been verified.' : 'Supplier inventory, freight, tracking, and delivery still need a complete test order.'}</span></div><i>{product.fulfillmentReady ? '✓' : '4'}</i></div>
      </div>
    </section>

    <section className="actions">
      {checkoutReady
        ? <Link href={`/marketplace?purchase=${encodeURIComponent(product.purchaseAssetId)}`} className="primary">Continue to secure checkout</Link>
        : <a href="#status-title" className="primary disabled" aria-disabled="true">Checkout opens after verification</a>}
      <a href={product.sourceUrl} target="_blank" rel="noreferrer" className="secondary">View physical product source ↗</a>
    </section>

    <section className="note"><strong>No wallet required to purchase.</strong><p>Wallet features may exist later for collectors who want them, but they are not part of the launch buying process.</p></section>

    <footer><Link href="/">Launch product</Link><Link href="/orders">Track orders</Link><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link></footer>

    <style jsx>{`.page{min-height:100vh;background:#05060b;color:#f7f8fb;padding:0 16px 48px;font-family:Inter,ui-sans-serif,system-ui,sans-serif}.page *{box-sizing:border-box}header{height:64px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(255,255,255,.08)}.brand{color:#fff;text-decoration:none;font-size:11px;font-weight:950;letter-spacing:.16em}.back{color:#8d96a8;text-decoration:none;font-size:10px}.hero{padding:48px 0 28px}.hero small,.intro small{color:#a895ff;font-size:9px;font-weight:900;letter-spacing:.17em}.hero h1{font-size:clamp(48px,11vw,78px);line-height:.9;letter-spacing:-.065em;margin:10px 0 18px}.hero em{font-style:normal;color:#a894ff}.hero p{max-width:610px;color:#939bad;font-size:14px;line-height:1.65}.price{display:flex;gap:10px;align-items:baseline;margin-top:22px}.price strong{font-size:30px}.price span{color:#747d8f;font-size:10px;text-transform:uppercase;letter-spacing:.12em}.preview{margin:8px 0 18px}.panel{border:1px solid rgba(255,255,255,.09);border-radius:24px;background:rgba(255,255,255,.035);overflow:hidden}.intro{padding:24px}.intro h2{font-size:30px;letter-spacing:-.045em;margin:8px 0}.intro p{max-width:620px;color:#8b94a6;font-size:12px;line-height:1.6}.steps{border-top:1px solid rgba(255,255,255,.07)}.step{display:grid;grid-template-columns:34px 1fr 30px;gap:12px;align-items:center;padding:16px 20px;border-bottom:1px solid rgba(255,255,255,.07)}.step:last-child{border-bottom:0}.step>b{font-size:9px;color:#687184}.step strong,.step span{display:block}.step strong{font-size:12px}.step span{margin-top:4px;color:#7f889a;font-size:10px;line-height:1.45}.step i{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;font-size:10px;font-style:normal;font-weight:900}.step.done i{background:#173326;color:#6ee7ab}.step.pending i{background:#2b2637;color:#b7a3ff}.actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px}.actions a{min-height:46px;display:inline-flex;align-items:center;justify-content:center;border-radius:12px;padding:0 16px;text-decoration:none;font-size:10px;font-weight:900;letter-spacing:.04em}.primary{background:#f5f6f9;color:#08090d}.primary.disabled{opacity:.48;pointer-events:none}.secondary{border:1px solid rgba(255,255,255,.12);color:#dfe4ee}.note{margin-top:16px;padding:18px 20px;border-left:2px solid #8f70ff;background:rgba(143,112,255,.08)}.note strong{font-size:12px}.note p{margin:5px 0 0;color:#8e97a9;font-size:10px;line-height:1.5}.page footer{display:flex;flex-wrap:wrap;justify-content:center;gap:18px;margin-top:28px}.page footer a{color:#626b7d;text-decoration:none;font-size:9px}@media(min-width:760px){.page{max-width:880px;margin:0 auto;padding-left:24px;padding-right:24px}}`}</style>
  </main>;
}
