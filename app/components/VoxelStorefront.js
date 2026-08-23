'use client';

import Link from 'next/link';
import { REAL_WORLD_CATALOG } from '../../lib/realWorldCatalog';
import RealWorld3DNFT from './RealWorld3DNFT';
import './VoxelStorefront.css';

const hero = REAL_WORLD_CATALOG.find((item) => item.id === 'vault-spiral-table-lamp') || REAL_WORLD_CATALOG[0];
const picks = REAL_WORLD_CATALOG.slice(0, 4);

function stateFor(item) {
  const model = item.modelUri || item.digitalTwin?.modelUrl;
  if (model && item.digitalTwin?.exactModelVerified) return 'verified';
  if (model) return 'review';
  return 'pending';
}

function readyForCheckout(item) {
  return Boolean(item.fulfillmentReady && item.purchaseAssetId && stateFor(item) === 'verified');
}

function ProductTile({ item, index }) {
  const state = stateFor(item);
  const ready = readyForCheckout(item);
  return <article className="vs-card">
    <div className="vs-cardHead"><span>{String(index + 1).padStart(2, '0')}</span><b>{item.type}</b></div>
    <div className="vs-cardMedia"><RealWorld3DNFT item={item}/></div>
    <div className="vs-cardBody"><div><small>{state === 'verified' ? 'VERIFIED 3D TWIN' : state === 'review' ? '3D UNDER REVIEW' : 'EXACT 3D PENDING'}</small><h3>{item.name}</h3></div><strong>${item.customerPriceUsd}</strong></div>
    <div className="vs-cardSignals"><span className="is-source">CJ MAPPED</span><span>{state === 'verified' ? '3D VERIFIED' : '3D PENDING'}</span><span>{ready ? 'BUY READY' : 'CHECKOUT LOCKED'}</span></div>
    <div className="vs-cardFoot"><span>PHYSICAL + DIGITAL TWIN</span><Link href={`/marketplace?object=${encodeURIComponent(item.id)}`}>Inspect object ↗</Link></div>
  </article>;
}

export default function VoxelStorefront() {
  const heroReady = readyForCheckout(hero);
  const verifiedCount = REAL_WORLD_CATALOG.filter((item) => stateFor(item) === 'verified').length;
  const readyCount = REAL_WORLD_CATALOG.filter(readyForCheckout).length;

  return <main className="vs-page">
    <header className="vs-topbar"><Link href="/" className="vs-logo">VOXEL <b>VAULT</b></Link><nav><Link href="/marketplace">Find</Link><Link href="/scan">Scan</Link><Link href="/vault">Vault</Link><Link href="/ai">AI</Link></nav><Link href="/marketplace" className="vs-shop">Explore {REAL_WORLD_CATALOG.length} objects</Link></header>

    <section className="vs-hero">
      <div className="vs-heroCopy"><div className="vs-eyebrow"><i/> PHYSICAL OBJECTS · VERIFIED DIGITAL TWINS</div><h1>Find it real.<br/><em>Keep it digital.</em></h1><p>Voxel Vault turns real CJ-sourced products into collectible objects with persistent digital identity. Shop in USD, receive the physical product at home, and keep its verified 3D twin after the commerce and chain checks are complete.</p><div className="vs-heroActions"><Link href="/marketplace" className="vs-primary">Enter the object index <span>↗</span></Link><a href="#how" className="vs-secondary">See the loop</a></div><div className="vs-assurance"><span>Card payment</span><span>Home delivery</span><span>No wallet required to buy</span><span>Digital twin included</span></div><div className="vs-pulse" aria-label="Catalog readiness"><div><strong>{REAL_WORLD_CATALOG.length}</strong><span>CJ objects mapped</span></div><div><strong>{verifiedCount}</strong><span>Exact 3D verified</span></div><div><strong>{readyCount}</strong><span>Checkout ready</span></div></div></div>
      <div className="vs-heroObject"><div className="vs-objectChrome"><span>DROP 001 · LAUNCH OBJECT</span><b>{stateFor(hero) === 'verified' ? '3D VERIFIED' : 'ACCURACY REVIEW'}</b></div><RealWorld3DNFT item={hero} hero/><div className="vs-objectInfo"><div><small>FEATURED OBJECT</small><strong>{hero.name}</strong><span>{heroReady ? 'READY TO BUY' : 'PREVIEW ONLY · CHECKOUT LOCKED'}</span></div><b>${hero.customerPriceUsd}</b></div><Link className="vs-objectLink" href={`/marketplace?object=${encodeURIComponent(hero.id)}`}>Open full object record <span>↗</span></Link></div>
    </section>

    <section className="vs-strip"><span>REAL PRODUCT</span><i>+</i><span>VERIFIED 3D</span><i>+</i><span>QR IDENTITY</span><i>+</i><span>VAULT PASSPORT</span></section>

    <section className="vs-featured"><div className="vs-sectionHead"><div><small>CURATED FROM CJ</small><h2>Objects entering the vault.</h2><p>Mapped now. Verified one by one. Checkout only when the exact product, fulfillment path, and 3D twin are ready.</p></div><Link href="/marketplace">View all {REAL_WORLD_CATALOG.length} mapped products ↗</Link></div><div className="vs-grid">{picks.map((item, index) => <ProductTile key={item.id} item={item} index={index}/>)}</div></section>

    <section className="vs-how" id="how"><div className="vs-howIntro"><small>THE VOXEL LOOP</small><h2>One purchase.<br/>Two forms of the object.</h2><p>The blockchain layer stays behind the scenes. Customers buy the real product first; Voxel Vault only finalizes the digital identity after payment, fulfillment, asset, and chain checks pass.</p></div><ol><li><b>01</b><div><strong>Find</strong><p>Browse mapped CJ products. Exact 3D is never faked.</p></div></li><li><b>02</b><div><strong>Buy</strong><p>Pay normally in USD when that object becomes eligible.</p></div></li><li><b>03</b><div><strong>Receive</strong><p>CJ fulfillment sends the physical object to your address.</p></div></li><li><b>04</b><div><strong>Keep</strong><p>The confirmed digital twin enters Vault and can live in Room.</p></div></li></ol></section>

    <section className="vs-launch"><div><small>COMMERCE SAFETY</small><h2>{heroReady ? 'The launch object passed every gate.' : 'The store can grow before checkout opens.'}</h2><p>Catalog visibility is not purchase eligibility. Products can be discovered while 3D or fulfillment is pending; checkout remains closed until the exact product-specific twin and real fulfillment path are verified.</p></div><Link href="/marketplace">Inspect readiness by object ↗</Link></section>

    <nav className="vs-mobileNav" aria-label="Mobile navigation"><Link href="/marketplace"><b>⌕</b><span>Find</span></Link><Link href="/scan"><b>⌗</b><span>Scan</span></Link><Link href="/vault"><b>◇</b><span>Vault</span></Link><Link href="/ai"><b>✦</b><span>AI</span></Link></nav>
    <footer className="vs-footer"><span>VOXEL VAULT</span><p>Real object. Verified twin. One history.</p><div><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link></div></footer>
  </main>;
}
