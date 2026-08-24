'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { REAL_WORLD_CATALOG } from '../../lib/realWorldCatalog';
import RealWorld3DNFT from './RealWorld3DNFT';
import './VoxelStorefront.css';

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

function readyForCheckout(item) {
  return Boolean(item.fulfillmentReady && item.purchaseAssetId && item.digitalTwin?.exactModelVerified);
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
            setLiveMap(Object.fromEntries(data.items.map((row) => [row.itemId, row])));
          }
        }
      } catch {}
      if (alive) timer = window.setTimeout(sync, 12000);
    }
    sync();
    return () => {
      alive = false;
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  const catalog = useMemo(
    () => REAL_WORLD_CATALOG.map((item) => mergeLiveState(item, liveMap[item.id])),
    [liveMap],
  );

  return (
    <main className="vs-page">
      <header className="vs-topbar">
        <Link href="/" className="vs-logo">VOXEL VAULT</Link>
        <nav>
          <Link href="/marketplace">Explore</Link>
          <Link href="/vault">Vault</Link>
        </nav>
        <Link href="/marketplace" className="vs-shop">Bag</Link>
      </header>

      <section className="vs-intro" aria-labelledby="vs-collection-heading">
        <p className="vs-introHeading">The collection</p>
        <h1 id="vs-collection-heading" className="vs-introHeading">Love essentials.</h1>
        <small>Real objects. Digital twins. Drag to turn. Swipe for the next.</small>
      </section>

      <section className="vs-rail" aria-label="3D NFT collection">
        {catalog.map((item) => (
          <article key={item.id} className="vs-capsule">
            <RealWorld3DNFT item={item} compact />
            <Link href={`/marketplace?object=${encodeURIComponent(item.id)}`}>
              {readyForCheckout(item) ? 'Buy' : 'Open'}
            </Link>
          </article>
        ))}
      </section>

      <section className="vs-how" id="how">
        <p>Tap one you love. Buy it like anything else. The real piece ships home. Its 3D NFT waits in your Vault.</p>
        <ol>
          <li><b>Browse</b> Fall for an object.</li>
          <li><b>Buy</b> Pay normally. No wallet.</li>
          <li><b>Receive</b> The real piece ships home.</li>
          <li><b>Yours</b> The 3D NFT waits in Vault.</li>
        </ol>
        <Link href="/marketplace" className="vs-primary">Keep browsing</Link>
      </section>

      <nav className="vs-mobileNav" aria-label="Mobile navigation">
        <Link href="/marketplace"><span>Explore</span></Link>
        <Link href="/vault"><span>Vault</span></Link>
      </nav>
      <footer className="vs-footer">
        <span>VOXEL VAULT</span>
        <p>Real objects. Digital twins.</p>
      </footer>
    </main>
  );
}
