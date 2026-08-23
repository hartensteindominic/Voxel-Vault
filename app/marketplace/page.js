'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { REAL_WORLD_CATALOG } from '../../lib/realWorldCatalog';
import RealWorld3DNFT from '../components/RealWorld3DNFT';
import '../components/CJMarketplace.css';

function getModelState(item) {
  const modelUrl = item.modelUri || item.digitalTwin?.modelUrl;
  if (modelUrl && item.digitalTwin?.exactModelVerified) return 'verified';
  if (modelUrl) return 'review';
  return 'pending';
}

export default function MarketplacePage() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const categories = useMemo(() => ['all', ...new Set(REAL_WORLD_CATALOG.map((item) => item.type))], []);
  const products = useMemo(() => REAL_WORLD_CATALOG.filter((item) => {
    const haystack = `${item.name} ${item.type} ${item.sourceName}`.toLowerCase();
    return (!query || haystack.includes(query.toLowerCase())) && (category === 'all' || item.type === category);
  }), [query, category]);

  return <main className="cj-page">
    <header className="cj-header"><Link className="cj-brand" href="/">VOXEL VAULT</Link><nav className="cj-nav" aria-label="Marketplace navigation"><a href="#catalog">Catalog</a><a href="#policy">3D standard</a><Link href="/">Launch object</Link></nav></header>
    <section className="cj-hero"><div className="cj-kicker">CJ-DROPSHIPPED OBJECTS · VOXEL VAULT 3D</div><h1>Real products.<br/><em>Real 3D twins.</em></h1><p>Browse physical products sourced through CJdropshipping. Every product can enter the catalog immediately, but it only receives a verified interactive 3D twin after the model passes accuracy review. Normal card checkout stays locked until fulfillment and the product-specific 3D asset are both ready.</p><div className="cj-trust"><span>✓ CJ source disclosed</span><span>✓ No generic 3D substitution</span><span>✓ Card checkout only when ready</span><span>✓ 3D collectible included</span></div></section>
    <section id="catalog"><div className="cj-toolbar"><input className="cj-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products" aria-label="Search products"/><select className="cj-select" value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Filter by category">{categories.map((value) => <option key={value} value={value}>{value === 'all' ? 'All categories' : value}</option>)}</select></div>
      {products.length ? <div className="cj-grid">{products.map((item) => { const modelState = getModelState(item); const checkoutReady = Boolean(item.fulfillmentReady && item.purchaseAssetId && modelState === 'verified'); return <article className="cj-card" key={item.id}><div className="cj-cardTop"><div><small>{item.type}</small><h2>{item.name}</h2></div><div className="cj-price"><strong>${item.customerPriceUsd}</strong><span>target bundle</span></div></div><div className="cj-media"><RealWorld3DNFT item={item}/></div><div className="cj-meta"><div className="cj-status"><span className="ok">CJ SOURCE MAPPED</span><span>{modelState === 'verified' ? '3D VERIFIED' : modelState === 'review' ? '3D IN REVIEW' : '3D GENERATION QUEUED'}</span><span>{checkoutReady ? 'READY TO BUY' : 'CHECKOUT LOCKED'}</span></div><div className="cj-source"><span>Supplier SKU · {item.supplierSku}</span><a href={item.sourceUrl} target="_blank" rel="noreferrer">Verify CJ source ↗</a></div></div><div className="cj-actions">{checkoutReady ? <Link className="cj-primary" href={`/marketplace?purchase=${encodeURIComponent(item.purchaseAssetId)}`}>Buy with card</Link> : <span className="cj-locked">Awaiting verified 3D + fulfillment</span>}<a className="cj-secondary" href={item.sourceUrl} target="_blank" rel="noreferrer">Physical product</a></div></article>; })}</div> : <div className="cj-empty">No products match that search.</div>}
    </section>
    <section className="cj-policy" id="policy"><small>THE 3D STANDARD</small><h2>Scale the catalog. Never fake the twin.</h2><p>The storefront is built to accept many CJ products without pretending a generated shape is exact. Products can be sourced and merchandised first; their 3D state remains visibly queued or under review until a product-specific model is approved. That lets Voxel Vault grow toward a large catalog while keeping the promise understandable and honest.</p></section><footer className="cj-footer"><span>VOXEL VAULT · PHYSICAL + DIGITAL</span><Link href="/">Back to launch product</Link><span>NO CRYPTO REQUIRED</span></footer>
  </main>;
}
