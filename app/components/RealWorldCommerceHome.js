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
      <a className="lp-navCta" href="#product">View launch product <Icon name="arrow" size={15}/></a>
    </header>

    <section className="lp-hero" id="product">
      <div className="lp-heroCopy">
        <div className="lp-kicker"><i/> FIRST VOXEL VAULT RELEASE</div>
        <h1>A real lamp.<br/><em>Its digital twin.</em></h1>
        <p className="lp-lede">One simple purchase: a sculptural LED table lamp delivered to your home, with its product-specific 3D collectible included. Pay normally. No crypto knowledge required.</p>
        <div className="lp-priceLine"><strong>${product.customerPriceUsd}</strong><span>target bundle price</span></div>
        <div className="lp-actions">
          {checkoutReady
            ? <Link className="lp-primary" href={`/marketplace?purchase=${encodeURIComponent(product.purchaseAssetId)}`}>Buy with card <Icon name="arrow" size={17}/></Link>
            : <a className="lp-primary" href="#launch-status">See launch status <Icon name="arrow" size={17}/></a>}
          <a className="lp-secondary" href={product.sourceUrl} target="_blank" rel="noreferrer">View physical product</a>
        </div>
        <div className="lp-assurances"><span><Icon name="card" size={17}/> Card payment</span><span><Icon name="package" size={17}/> Home delivery</span><span><Icon name="cube" size={17}/> 3D collectible included</span></div>
      </div>
      <div className="lp-productVisual">
        <div className="lp-visualLabel"><span>01 / LAUNCH OBJECT</span><b>{exactModelVerified ? '3D VERIFIED' : 'ACCURACY REVIEW'}</b></div>
        <RealWorld3DNFT item={product} hero/>
      </div>
    </section>

    <section className="lp-included" id="included">
      <div className="lp-sectionIntro"><span>THE BUNDLE</span><h2>Two versions.<br/>One object.</h2></div>
      <article><Icon name="package" size={25}/><small>PHYSICAL</small><h3>LED Spiral Table Lamp</h3><p>A real USB-powered sculptural lamp sourced from the linked supplier and shipped to your address after inventory and delivery are confirmed.</p></article>
      <article><Icon name="cube" size={25}/><small>DIGITAL</small><h3>Product-specific 3D collectible</h3><p>A matching interactive object for your Voxel Vault account. It is included in the bundle and never presented as exact until it passes visual review.</p></article>
    </section>

    <section className="lp-process" id="process">
      <div><span>HOW IT WORKS</span><h2>From one checkout<br/>to your collection.</h2><p>No wallet setup, tokens, gas fees, or technical steps.</p></div>
      <ol>
        <li><b>01</b><div><strong>Choose the lamp</strong><p>See the physical source, bundle price, and 3D verification status before paying.</p></div></li>
        <li><b>02</b><div><strong>Pay with your card</strong><p>A normal USD checkout shows product, shipping, and taxes before confirmation.</p></div></li>
        <li><b>03</b><div><strong>Receive your package</strong><p>The supplier ships the real lamp and your order page shows its progress.</p></div></li>
        <li><b>04</b><div><strong>Open the digital twin</strong><p>After delivery is confirmed, the matching collectible appears in your Voxel Vault account.</p></div></li>
      </ol>
    </section>

    <section className="lp-status" id="launch-status">
      <div className="lp-statusCopy"><span>LAUNCH STATUS</span><h2>We are finishing the promise—not pretending it is finished.</h2><p>The storefront is live. Card checkout will open after the lamp’s inventory, shipping quote, physical fulfillment, and exact 3D asset pass one complete test order.</p></div>
      <div className="lp-checklist" role="list" aria-label="Launch readiness checklist">
        <div className="done" role="listitem"><i>✓</i><span><b>Focused product experience</b><small>One product and one clear buying story</small></span></div>
        <div className="done" role="listitem"><i>✓</i><span><b>Physical source linked</b><small>Supplier and product can be inspected</small></span></div>
        <div className="pending" role="listitem"><i>3</i><span><b>Exact 3D model review</b><small>No generic substitute will be used</small></span></div>
        <div className="pending" role="listitem"><i>4</i><span><b>Fulfillment test order</b><small>Inventory, shipping, tracking, and delivery</small></span></div>
      </div>
    </section>

    <footer className="lp-footer"><Brand/><p>One real object.<br/>One verified digital twin.</p><a href={product.sourceUrl} target="_blank" rel="noreferrer">Verify product source <Icon name="arrow" size={14}/></a><span>NO CRYPTO REQUIRED</span></footer>
  </main>;
}
