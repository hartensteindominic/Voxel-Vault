'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import './vv3-nft.css';
import './AccuracyCommerce.css';

const Product3DTwin = dynamic(() => import('./Product3DTwin'), {
  ssr: false,
  loading: () => null,
});

function isPlaceholder(url = '') {
  return /unsplash\.com|\/cj\/share\d+x\d+\.(?:jpg|jpeg|png|webp)(?:\?|$)|config-resource\/cj\/share/i.test(url);
}

function ProductPhoto({ item }) {
  const fallback = !isPlaceholder(item?.previewUri || '') ? item.previewUri : '';
  const [src, setSrc] = useState(fallback);
  const [failed, setFailed] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const drag = useRef({ x: 0, y: 0, active: false });

  useEffect(() => {
    let active = true;
    if (!item?.sourceUrl && !item?.supplierSku) return undefined;
    const params = new URLSearchParams();
    if (item?.sourceUrl) params.set('url', item.sourceUrl);
    if (item?.supplierSku) params.set('sku', item.supplierSku);
    fetch(`/api/product-image?${params.toString()}`, { cache: 'force-cache' })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('unavailable'))))
      .then((data) => {
        if (active && data?.imageUrl && !isPlaceholder(data.imageUrl)) {
          setSrc(data.imageUrl);
          setFailed(false);
        } else if (active && !fallback) {
          setSrc('');
          setFailed(true);
        }
      })
      .catch(() => {
        if (active && !fallback) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [item?.sourceUrl, item?.supplierSku, fallback]);

  if (!src || failed) {
    return (
      <div className="vv3-accuracyEmpty">
        <strong>Product photo arriving</strong>
        <small>The real item is synced. The digital twin stays hidden until it matches this product.</small>
      </div>
    );
  }

  return (
    <div
      className="vv3-verifiedPhoto"
      style={{ cursor: 'grab' }}
      onPointerDown={(e) => {
        drag.current = { x: e.clientX, y: e.clientY, active: true };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!drag.current.active) return;
        setTilt({
          x: Math.max(-10, Math.min(10, -(e.clientY - drag.current.y) / 18)),
          y: Math.max(-14, Math.min(14, (e.clientX - drag.current.x) / 18)),
        });
      }}
      onPointerUp={() => {
        drag.current.active = false;
        setTilt({ x: 0, y: 0 });
      }}
      onPointerCancel={() => {
        drag.current.active = false;
        setTilt({ x: 0, y: 0 });
      }}
    >
      <img
        src={src}
        alt={`${item?.name || 'Product'} physical product`}
        draggable={false}
        style={{
          transform: `perspective(900px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
          transition: 'transform 150ms ease',
        }}
      />
      <span>PHYSICAL PRODUCT · DRAG TO INSPECT</span>
    </div>
  );
}

export default function RealWorld3DNFT({ item, hero = false }) {
  const [mode, setMode] = useState('photo');
  const price = item?.customerPriceUsd ? `$${item.customerPriceUsd}` : null;
  const modelUrl = item?.modelUri || item?.digitalTwin?.modelUrl;
  const exactModelVerified = Boolean(modelUrl && item?.digitalTwin?.exactModelVerified);
  const titleId = `collectible-${item?.id || 'object'}`;
  const showTwin = exactModelVerified && mode === 'twin';

  return (
    <figure className={`vv3-modelFrame ${hero ? 'vv3-modelFrameHero' : ''}`} aria-labelledby={titleId}>
      <div className="vv3-twinHeader">
        <span className={`vv3-twinPill ${exactModelVerified ? 'is-verified' : 'is-pending'}`}>
          <span aria-hidden="true">◆</span>
          {exactModelVerified ? 'COLLECTIBLE READY' : 'PHYSICAL PRODUCT'}
        </span>
        <span className="vv3-twinSource">USD · HOME DELIVERY · DIGITAL TWIN INCLUDED</span>
      </div>
      <div className="vv3-accuracyStage">
        {showTwin ? <Product3DTwin item={item} hero={hero} /> : <ProductPhoto item={item} />}
      </div>
      <div className={`vv3-accuracyStatus ${exactModelVerified ? 'is-verified' : 'is-pending'}`}>
        <strong>
          {exactModelVerified
            ? 'The interactive collectible was approved against this product photo'
            : 'Shop the real product. The digital twin appears when it matches this photo.'}
        </strong>
        <small>
          {exactModelVerified
            ? 'One purchase includes the physical item and its matching 3D digital twin.'
            : 'We never show a guessed model as if it were this product.'}
        </small>
        {exactModelVerified ? (
          <button
            type="button"
            className="vv3-twinOpen"
            onClick={() => setMode((current) => (current === 'twin' ? 'photo' : 'twin'))}
            style={{ marginTop: 10 }}
          >
            {mode === 'twin' ? 'Show product photo' : 'View digital twin'}
          </button>
        ) : null}
      </div>
      <figcaption className="vv3-twinFooter" id={titleId}>
        <div className="vv3-twinName">
          <small>Voxel Vault</small>
          <strong>{item?.name || 'Collectible object'}</strong>
        </div>
        <div className="vv3-twinPrice">
          <small>PHYSICAL + DIGITAL TWIN</small>
          {price && <strong>{price}</strong>}
        </div>
        <span className="vv3-twinOpen" aria-label="Supplier disclosure">
          Fulfilled through a verified Voxel Vault supply partner
        </span>
      </figcaption>
    </figure>
  );
}
