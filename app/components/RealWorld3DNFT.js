'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import './AccuracyCommerce.css';
import './vv3-nft.css';

const Product3DTwin = dynamic(() => import('./Product3DTwin'), {
  ssr: false,
  loading: () => <div className="vv3-twinLoading">Turning on the object</div>,
});

export default function RealWorld3DNFT({ item, hero = false, compact = false }) {
  const price = item?.customerPriceUsd ? `$${item.customerPriceUsd}` : null;
  const modelUrl = item?.modelUri || item?.digitalTwin?.modelUrl;
  const exactModelVerified = Boolean(modelUrl && item?.digitalTwin?.exactModelVerified);
  const titleId = `collectible-${item?.id || 'object'}`;
  const frame = useRef(null);
  const [seen, setSeen] = useState(!compact);

  useEffect(() => {
    if (!compact) return undefined;
    const node = frame.current;
    if (!node) return undefined;
    const io = new IntersectionObserver(([entry]) => setSeen(entry.isIntersecting), { rootMargin: '80px', threshold: 0.05 });
    io.observe(node);
    return () => io.disconnect();
  }, [compact]);

  const stage = seen ? <Product3DTwin item={item} hero={hero} /> : null;

  if (compact) {
    return (
      <figure ref={frame} className="vv3-modelFrame vv3-compact" aria-labelledby={titleId}>
        <div className="vv3-accuracyStage">{stage}</div>
        <figcaption className="vv3-compactFoot" id={titleId}>
          <strong>{item?.name || '3D NFT'}</strong>
          {price ? <span>{price}</span> : null}
        </figcaption>
      </figure>
    );
  }

  return (
    <figure className={`vv3-modelFrame ${hero ? 'vv3-modelFrameHero' : ''}`} aria-labelledby={titleId}>
      <div className="vv3-twinHeader">
        <span className={`vv3-twinPill ${exactModelVerified ? 'is-verified' : 'is-pending'}`}>
          <span aria-hidden="true">◆</span> {exactModelVerified ? '3D NFT' : '3D NFT · turning'}
        </span>
        <span className="vv3-twinSource">Drag to turn</span>
      </div>
      <div className="vv3-accuracyStage">{stage}</div>
      <figcaption className="vv3-twinFooter" id={titleId}>
        <div className="vv3-twinName">
          <small>Physical + Digital</small>
          <strong>{item?.name || 'Collectible object'}</strong>
        </div>
        <div className="vv3-twinPrice">
          <small>3D NFT</small>
          {price && <strong>{price}</strong>}
        </div>
      </figcaption>
    </figure>
  );
}
