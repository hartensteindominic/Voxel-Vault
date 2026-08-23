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

function ProductTile({ item, index }) {
  const state = stateFor(item);
  return <article className="vs-card">
    <div className="vs-cardHead"><span>0{index + 1}</span><b>{item.type}</b></div>
    <div className="vs-cardMedia"><RealWorld3DNFT item={item}/></div>
    <div className="vs-cardBody"><div><small>{state === 'verified' ? 'VERIFIED 3D TWIN' : state === 'review' ? '3D UNDER REVIEW' : 'EXACT 3D PENDING'}</small><h3>{item.name}</h3></div><strong>${item.customerPriceUsd}</strong></div>
    <div className="vs-cardFoot"><span>PHYSICAL + DIGITAL TWIN</span><Link href="/marketplace">View object ↗</Link></div>
  </article>;
}

export default function VoxelStorefront() {
  const heroReady = Boolean(hero.fulfillmentReady && hero.purchaseAssetId && stateFor(hero) === 'verified');
  return <main className="vs-page">
    <header className="vs-topbar"><Link href="/" className="vs-logo">VOXEL <b>VAULT</b></Link><nav><Link href="/marketplace">Find</Link><Link href="/scan">Scan</Link><Link href="/vault">Vault</Link><Link href="/ai">AI</Link></nav><Link href="/marketplace" className="vs-shop">Explore objects</Link></header>

    <section className="vs-hero">
      <div className="vs-heroCopy"><div className="vs-eyebrow"><i/> PHYSICAL OBJECTS · VERIFIED DIGITAL TWINS</div><h1>Things worth<br/><em>keeping twice.</em></h1><p>Discover real CJ-sourced products through a 3D-first storefront. Buy with normal money. The physical object ships to you, and its matching digital twin is included automatically.</p><div className="vs-heroActions"><Link href="/marketplace" className="vs-primary">Explore the catalog <span>↗</span></Link><a href="#how" className="vs-secondary">How it works</a></div><div className="vs-assurance"><span>Card payment</span><span>Home delivery</span><span>No wallet required</span><span>3D collectible included</span></div></div>
      <div className="vs-heroObject"><div className="vs-objectChrome"><span>DROP 001</span><b>{stateFor(hero) === 'verified' ? '3D VERIFIED' : 'PREVIEW ONLY'}</b></div><RealWorld3DNFT item={hero} hero/><div className="vs-objectInfo"><div><small>FEATURED OBJECT</small><strong>{hero.name}</strong></div><b>${hero.customerPriceUsd}</b></div></div>
    </section>

    <section className="vs-strip"><span>REAL PRODUCT</span><i>+</i><span>3D TWIN</span><i>+</i><span>QR IDENTITY</span><i>+</i><span>VAULT PASSPORT</span></section>

    <section className="vs-featured"><div className="vs-sectionHead"><div><small>CURATED FROM CJ</small><h2>Find your next object.</h2></div><Link href="/marketplace">View all {REAL_WORLD_CATALOG.length} mapped products ↗</Link></div><div className="vs-grid">{picks.map((item, index) => <ProductTile key={item.id} item={item} index={index}/>)}</div></section>

    <section className="vs-how" id="how"><div className="vs-howIntro"><small>THE VOXEL LOOP</small><h2>Normal shopping.<br/>A better object history.</h2><p>The blockchain layer stays behind the scenes. You buy the real product first; Voxel Vault handles the digital identity only after the commerce and asset checks pass.</p></div><ol><li><b>01</b><div><strong>Find</strong><p>Browse real products. Exact 3D only appears when verified.</p></div></li><li><b>02</b><div><strong>Buy</strong><p>Pay in USD with card. No crypto setup.</p></div></li><li><b>03</b><div><strong>Receive</strong><p>CJ fulfillment sends the physical product home.</p></div></li><li><b>04</b><div><strong>Keep</strong><p>Your confirmed digital twin enters Vault and Room.</p></div></li></ol></section>

    <section className="vs-launch"><div><small>LAUNCH SAFETY</small><h2>{heroReady ? 'This object is ready.' : 'Checkout stays locked until the promise is real.'}</h2><p>Products can appear in the catalog before they are purchasable. We only unlock checkout when fulfillment and the exact product-specific 3D asset are verified.</p></div><Link href="/marketplace">See readiness states ↗</Link></section>

    <nav className="vs-mobileNav" aria-label="Mobile navigation"><Link href="/marketplace"><b>⌕</b><span>Find</span></Link><Link href="/scan"><b>⌗</b><span>Scan</span></Link><Link href="/vault"><b>◇</b><span>Vault</span></Link><Link href="/ai"><b>✦</b><span>AI</span></Link></nav>
    <footer className="vs-footer"><span>VOXEL VAULT</span><p>Buy real. Keep digital.</p><div><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link></div></footer>
  </main>;
}
