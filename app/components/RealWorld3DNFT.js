'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import './vv3-nft.css';
import './AccuracyCommerce.css';

const Product3DTwin = dynamic(() => import('./Product3DTwin'), {
  ssr: false,
  loading: () => <div className="vv3-twinLoading">LOADING VERIFIED 3D NFT</div>,
});

function isPlaceholder(url = '') {
  return /unsplash\.com|\/cj\/share\d+x\d+\.(?:jpg|jpeg|png|webp)(?:\?|$)|config-resource\/cj\/share/i.test(url);
}

function VerifiedProductPhoto({ item }) {
  const fallback = !isPlaceholder(item?.previewUri || '') ? item.previewUri : '';
  const [src, setSrc] = useState(fallback);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    if (!item?.sourceUrl) return undefined;

    fetch(`/api/product-image?url=${encodeURIComponent(item.sourceUrl)}`, { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('Product image unavailable'))))
      .then((data) => {
        if (active && data?.imageUrl && !isPlaceholder(data.imageUrl)) {
          setSrc(data.imageUrl);
          setFailed(false);
        } else if (active) {
          setSrc('');
          setFailed(true);
        }
      })
      .catch(() => {
        if (active && !fallback) setFailed(true);
      });

    return () => { active = false; };
  }, [item?.sourceUrl, fallback]);

  if (!src || failed) {
    return <div className="vv3-accuracyEmpty"><strong>Product media under review</strong><small>The supplier returned a generic storefront graphic, so it has been removed. An exact lamp image will appear here only after verification.</small></div>;
  }

  return <div className="vv3-verifiedPhoto"><img src={src} alt={`${item?.name || 'Product'} from the linked supplier`} /><span>LIVE SUPPLIER PRODUCT IMAGE</span></div>;
}

export default function RealWorld3DNFT({ item, hero = false }) {
  const price = item?.customerPriceUsd ? `$${item.customerPriceUsd}` : null;
  const modelUrl = item?.modelUri || item?.digitalTwin?.modelUrl;
  const exactModelVerified = Boolean(modelUrl && item?.digitalTwin?.exactModelVerified);
  const titleId = `twin-${item?.id || 'object'}`;

  return (
    <figure className={`vv3-modelFrame ${hero ? 'vv3-modelFrameHero' : ''}`} aria-labelledby={titleId}>
      <div className="vv3-twinHeader">
        <span className={`vv3-twinPill ${exactModelVerified ? 'is-verified' : 'is-pending'}`}><span aria-hidden="true">◆</span> {exactModelVerified ? 'VERIFIED 3D NFT' : 'EXACT 3D NFT PENDING'}</span>
        <span className="vv3-twinSource">PRODUCT-SPECIFIC ACCURACY REQUIRED</span>
      </div>

      <div className="vv3-accuracyStage">
        {exactModelVerified ? <Product3DTwin item={item} hero={hero} /> : <VerifiedProductPhoto item={item} />}
      </div>

      <div className={`vv3-accuracyStatus ${exactModelVerified ? 'is-verified' : 'is-pending'}`}>
        <strong>{exactModelVerified ? 'Exact model verified' : 'Exact 3D model not yet verified'}</strong>
        <small>{exactModelVerified ? 'This interactive 3D NFT has been checked against the physical product.' : 'We will not show a generic shape or unlock checkout as though it were this product.'}</small>
      </div>

      <figcaption className="vv3-twinFooter" id={titleId}>
        <div className="vv3-twinName"><small>{item?.creator || 'Voxel Vault'}</small><strong>{item?.name || 'Collectible object'}</strong></div>
        <div className="vv3-twinPrice"><small>PHYSICAL + DIGITAL</small>{price && <strong>{price}</strong>}</div>
        <a className="vv3-twinOpen" href={item?.sourceUrl} target="_blank" rel="noreferrer" aria-label={`Verify the supplier product for ${item?.name || 'this collectible'}`}>VERIFY PRODUCT ↗</a>
      </figcaption>
    </figure>
  );
}
