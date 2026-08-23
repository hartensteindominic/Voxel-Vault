'use client';

import Link from 'next/link';
import { REAL_WORLD_CATALOG } from '../../lib/realWorldCatalog';
import RealWorld3DNFT from './RealWorld3DNFT';
import './VaultHomeV3.css';
import './LaunchProduct.css';

const PRODUCT_ID = 'vault-spiral-table-lamp';

function Icon({ name, size = 18 }) {
  const paths = {
    arrow: <><path d="M5 13 13 5"/><path d="M7 5h6v6"/></>,
    cube: <><path d="m10 2.5 6.5 3.7v7.6L10 17.5l-6.5-3.7V6.2Z"/><path d="m3.7 6.3 6.3 3.6 6.3-3.6M10 9.9v7.3"/></>,
    shield: <><path d="M10 2.5 16 5v4.5c0 3.6-2.2 6.3-6 8-3.8-1.7-6-4.4-6-8V5Z"/><path d="m7.2 10 1.8 1.8 3.8-4"/></>,
    card: <><rect x="2.5" y="4.5" width="15" height="11" rx="2"/><path d="M2.5 8h15M6 12h3"/></>,
    package: <><path d="M3 6.5 10 3l7 3.5v7L10 17l-7-3.5Z"/><path d="M3 6.5 10 10l7-3.5M10 10v7"/></>,
  };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function Brand() {
  return <Link href="/" className="lp-brand" aria-label="Voxel Vault home"><span className="lp-brandMark"><i/><i/><i/></span><span>VOXEL <b>VAULT</b></span></Link>;
}

export default function RealWorldCommerceHome() {
  const product = REAL_WORLD_CATALOG.find((item) => item.id === PRODUCT_ID) || REAL_WORLD_CATALOG[0];
  const modelUrl = product.modelUri || product.digitalTwin?.modelUrl;
  const exactModelVerified = Boolean(modelUrl && product.digitalTwin?.exactModelVerified);
  const checkoutReady = Boolean(product.fulfillmentReady && product.purchaseAssetId && exactModelVerified);

  return <main className="lp-page" id="main-content">
    <a className="lp-skip" href="#product">Skip to product</a>
    <header className="lp-header">
      <Brand/>
      <nav aria-label="Primary navigation"><a href="#product">The lamp</a><a href="#included">What you get</a><a href="#process">How it works</a></nav>
      <Link className="lp-navCta" href="/marketplace">Browse products <Icon name="arrow" size={15}/></Link>
    </header>

    <section className="lp-hero" id="product">
      <div className="lp-heroCopy">
        <div className="lp-kicker"><i/> FIRST VOXEL VAULT RELEASE</div>
        <h1>A real lamp.<br/><em>Its 3D collectible.</em></h1>
        <p className="lp-lede">One simple purchase: a sculptural LED table lamp delivered to your home, with its product-specific 3D collectible included. Pay normally. No crypto knowledge required.</p>
        <div className="lp-priceLine"><strong>${product.customerPriceUsd}</strong><span>target bundle price</span></div>
        <div className="lp-actions">
          {checkoutReady
            ? <Link className="lp-primary" href={`/marketplace?purchase=${encodeURIComponent(product.purchaseAssetId)}`}>Buy with card <Icon name="arrow" size={17}/></Link>
            : <Link className="lp-primary" href={`/marketplace?object=${encodeURIComponent(product.id)}`}>Open 3D preview <Icon name="arrow" size={17}/></Link>}
          <a className="lp-secondary" href={product.sourceUrl} target="_blank" rel="noreferrer">View CJ listing</a>
        </div>
        <div className="lp-assurances"><span><Icon name="card" size={17}/> Card payment</span><span><Icon name="package" size={17}/> Home delivery</span><span><Icon name="cube" size={17}/> 3D collectible included</span></div>
      </div>
      <div className="lp-productVisual">
        <div className="lp-visualLabel"><span>01 / LAUNCH OBJECT</span><b>{exactModelVerified ? 'EXACT 3D APPROVED' : '3D BUILDS AUTOMATICALLY'}</b></div>
        <RealWorld3DNFT item={product} hero/>
      </div>
    </section>

    <section className="lp-included" id="included">
      <div className="lp-sectionIntro"><span>THE BUNDLE</span><h2>Physical product.<br/>3D collectible.</h2></div>
      <article><Icon name="package" size={25}/><small>PHYSICAL</small><h3>LED Spiral Table Lamp</h3><p>A real USB-powered sculptural lamp sourced from CJ and shipped to your address after inventory and delivery are confirmed.</p></article>
      <article><Icon name="cube" size={25}/><small>DIGITAL</small><h3>Product-specific 3D collectible</h3><p>An interactive 3D object included with the purchase. Voxel Vault generates the preview automatically and only calls it exact after it matches the same physical product closely enough.</p></article>
    </section>

    <section className="lp-process" id="process">
      <div><span>HOW IT WORKS</span><h2>Normal shopping.<br/>A 3D collectible included.</h2><p>No wallet setup, tokens, gas fees, or customer verification steps.</p></div>
      <ol>
        <li><b>01</b><div><strong>Browse the product</strong><p>See the real CJ source and open an automatically generated 3D preview.</p></div></li>
        <li><b>02</b><div><strong>Buy with your card when ready</strong><p>Checkout only turns on after Voxel Vault completes the product, 3D, inventory, and fulfillment checks.</p></div></li>
        <li><b>03</b><div><strong>Receive your package</strong><p>CJ fulfillment ships the real product and your order page shows its progress.</p></div></li>
        <li><b>04</b><div><strong>Get the 3D collectible</strong><p>The matching digital collectible is included automatically. Crypto does not become a shopping step.</p></div></li>
      </ol>
    </section>

    <section className="lp-status" id="launch-status">
      <div className="lp-statusCopy"><span>READINESS</span><h2>You browse. Voxel Vault handles the checks.</h2><p>“Approval” is an internal safety gate, not something customers do. It prevents an AI-generated 3D model from being sold as the wrong physical product and keeps checkout closed until CJ fulfillment is ready.</p></div>
      <div className="lp-checklist" role="list" aria-label="Product readiness checklist">
        <div className="done" role="listitem"><i>✓</i><span><b>CJ product synced</b><small>SKU and supplier listing connected</small></span></div>
        <div className="done" role="listitem"><i>✓</i><span><b>3D generation connected</b><small>CJ product media feeds the 3D preview pipeline</small></span></div>
        <div className="pending" role="listitem"><i>3</i><span><b>Exact 3D approval</b><small>Internal check that the 3D represents the same product</small></span></div>
        <div className="pending" role="listitem"><i>4</i><span><b>Fulfillment readiness</b><small>Inventory, freight, tracking, and test order</small></span></div>
      </div>
    </section>

    <footer className="lp-footer"><Brand/><p>Real products.<br/>3D collectibles included.</p><Link href="/marketplace">Browse the marketplace <Icon name="arrow" size={14}/></Link><span>NO CRYPTO REQUIRED</span></footer>
  </main>;
}
