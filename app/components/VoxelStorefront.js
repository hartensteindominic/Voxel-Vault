'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { REAL_WORLD_CATALOG } from '../../lib/realWorldCatalog';
import RealWorld3DNFT from './RealWorld3DNFT';
import './VoxelStorefront.css';

function stateFor(item) {
  const model = item.modelUri || item.digitalTwin?.modelUrl;
  if (model && item.digitalTwin?.exactModelVerified) return 'verified';
  if (model) return 'review';
  return 'pending';
}

function readyForCheckout(item) {
  return Boolean(item.fulfillmentReady && item.purchaseAssetId && stateFor(item) === 'verified');
}

function mergeLiveState(item, live) {
  if (!live) return item;
  const modelUrl = live.modelUrl || item.modelUri || item.digitalTwin?.modelUrl || null;
  return {
    ...item,
    modelUri: modelUrl,
    liveBuildProgress: Number(live.progress || 0),
    liveThumbnailUrl: live.thumbnailUrl || null,
    digitalTwin: {
      ...(item.digitalTwin || {}),
      modelUrl,
      exactModelVerified: Boolean(live.exactModelApproved || item.digitalTwin?.exactModelVerified),
    },
  };
}

function ProductTile({ item, index }) {
  const state = stateFor(item);
  const ready = readyForCheckout(item);
  const progress = Number(item.liveBuildProgress || 0);
  return <article className="vs-card">
    <div className="vs-cardHead"><span>{String(index + 1).padStart(2, '0')}</span><b>{item.type}</b></div>
    <div className="vs-cardMedia"><RealWorld3DNFT item={item}/></div>
    <div className="vs-cardBody"><div><small>{state === 'verified' ? 'COLLECTIBLE APPROVED' : state === 'review' ? 'INTERACTIVE PREVIEW READY' : progress > 0 ? `PREVIEW BUILDING · ${Math.round(progress)}%` : 'PREVIEW PREBUILDING'}</small><h3>{item.name}</h3></div><strong>${item.customerPriceUsd}</strong></div>
    <div className="vs-cardSignals"><span className="is-source">PRODUCT SYNCED</span><span>{state === 'verified' ? 'MATCH APPROVED' : state === 'review' ? 'PREVIEW READY' : progress > 0 ? 'BUILDING NOW' : 'PREBUILDING'}</span><span>{ready ? 'BUY READY' : 'COMING SOON'}</span></div>
    <div className="vs-cardFoot"><span>PHYSICAL PRODUCT + DIGITAL COLLECTIBLE</span><Link href={`/marketplace?object=${encodeURIComponent(item.id)}`}>Inspect object ↗</Link></div>
  </article>;
}

export default function VoxelStorefront() {
  const [liveMap, setLiveMap] = useState({});

  useEffect(() => {
    let alive = true;
    let timer;
    async function sync() {
      try {
        const response = await fetch('/api/catalog-3d', { cache: 'no-store' });
        if (response.ok) {
          const data = await response.json();
          if (alive && Array.isArray(data?.items)) {
            setLiveMap(Object.fromEntries(data.items.map(row => [row.itemId, row])));
          }
        }
      } catch {}
      if (alive) timer = window.setTimeout(sync, 12000);
    }
    sync();
    return () => { alive = false; if (timer) window.clearTimeout(timer); };
  }, []);

  const catalog = useMemo(() => REAL_WORLD_CATALOG.map(item => mergeLiveState(item, liveMap[item.id])), [liveMap]);
  const hero = catalog.find((item) => item.id === 'vault-spiral-table-lamp') || catalog[0];
  const picks = catalog.slice(0, 4);
  const heroReady = readyForCheckout(hero);
  const readyCount = catalog.filter(readyForCheckout).length;
  const previewReadyCount = catalog.filter(item => stateFor(item) !== 'pending').length;

  return <main className="vs-page">
    <header className="vs-topbar"><Link href="/" className="vs-logo">VOXEL <b>VAULT</b></Link><nav><Link href="/marketplace">Find</Link><Link href="/scan">Scan</Link><Link href="/vault">Vault</Link><Link href="/ai">AI</Link></nav><Link href="/marketplace" className="vs-shop">Explore {catalog.length} objects</Link></header>

    <section className="vs-hero">
      <div className="vs-heroCopy"><div className="vs-eyebrow"><i/> REAL PRODUCTS · INTERACTIVE COLLECTIBLES</div><h1>Find it real.<br/><em>Keep it yours.</em></h1><p>Discover useful physical products with an interactive collectible included. Shop in USD, receive the real product at home, and keep its matching digital object after Voxel Vault completes the behind-the-scenes readiness checks.</p><div className="vs-heroActions"><Link href="/marketplace" className="vs-primary">Explore the collection <span>↗</span></Link><a href="#how" className="vs-secondary">How it works</a></div><div className="vs-assurance"><span>Card payment</span><span>Home delivery</span><span>No wallet required to buy</span><span>Collectible included</span></div><div className="vs-pulse" aria-label="Catalog readiness"><div><strong>{catalog.length}</strong><span>products synced</span></div><div><strong>{previewReadyCount}</strong><span>previews ready</span></div><div><strong>{readyCount}</strong><span>ready to buy</span></div></div></div>
      <div className="vs-heroObject"><div className="vs-objectChrome"><span>FEATURED OBJECT</span><b>{stateFor(hero) === 'verified' ? 'MATCH APPROVED' : stateFor(hero) === 'review' ? 'PREVIEW READY' : hero.liveBuildProgress > 0 ? `BUILDING · ${Math.round(hero.liveBuildProgress)}%` : 'PREBUILDING'}</b></div><RealWorld3DNFT item={hero} hero/><div className="vs-objectInfo"><div><small>FEATURED OBJECT</small><strong>{hero.name}</strong><span>{heroReady ? 'READY TO BUY' : stateFor(hero) === 'review' ? 'INTERACTIVE PREVIEW READY' : 'PREVIEW APPEARS AUTOMATICALLY WHEN READY'}</span></div><b>${hero.customerPriceUsd}</b></div><Link className="vs-objectLink" href={`/marketplace?object=${encodeURIComponent(hero.id)}`}>Open full object record <span>↗</span></Link></div>
    </section>

    <section className="vs-strip"><span>REAL PRODUCT</span><i>+</i><span>INTERACTIVE COLLECTIBLE</span><i>+</i><span>QR IDENTITY</span><i>+</i><span>VAULT PASSPORT</span></section>

    <section className="vs-featured"><div className="vs-sectionHead"><div><small>ENTERING THE VAULT</small><h2>Objects worth keeping.</h2><p>Products can appear while their interactive collectible is still prebuilding. Finished previews now update across the site automatically as background jobs complete.</p></div><Link href="/marketplace">View all {catalog.length} products ↗</Link></div><div className="vs-grid">{picks.map((item, index) => <ProductTile key={item.id} item={item} index={index}/>)}</div></section>

    <section className="vs-how" id="how"><div className="vs-howIntro"><small>THE VOXEL LOOP</small><h2>One purchase.<br/>Two forms of the object.</h2><p>The technical layer stays behind the scenes. You buy the real product normally; Voxel Vault handles the collectible and ownership systems after the required checks pass.</p></div><ol><li><b>01</b><div><strong>Find</strong><p>Browse real products while interactive previews are prebuilt in the background.</p></div></li><li><b>02</b><div><strong>Buy</strong><p>Pay normally in USD when that product becomes eligible.</p></div></li><li><b>03</b><div><strong>Receive</strong><p>The physical product is shipped to your address.</p></div></li><li><b>04</b><div><strong>Keep</strong><p>The confirmed collectible enters Vault and can live in Room.</p></div></li></ol></section>

    <section className="vs-launch"><div><small>QUALITY FIRST</small><h2>{heroReady ? 'The featured object is ready.' : previewReadyCount ? `${previewReadyCount} interactive preview${previewReadyCount === 1 ? '' : 's'} ready now.` : 'The catalog can grow while collectibles finish.'}</h2><p>Generated previews are never treated as exact automatically. If a model does not closely match the physical item, it stays unpublished as the official collectible and buying remains closed for that product.</p></div><Link href="/marketplace">Explore the collection ↗</Link></section>

    <nav className="vs-mobileNav" aria-label="Mobile navigation"><Link href="/marketplace"><b>⌕</b><span>Find</span></Link><Link href="/scan"><b>⌗</b><span>Scan</span></Link><Link href="/vault"><b>◇</b><span>Vault</span></Link><Link href="/ai"><b>✦</b><span>AI</span></Link></nav>
    <footer className="vs-footer"><span>VOXEL VAULT</span><p>Real products. Interactive collectibles. One history.</p><div><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link></div><small>Products are fulfilled through third-party supply partners.</small></footer>
  </main>;
}
