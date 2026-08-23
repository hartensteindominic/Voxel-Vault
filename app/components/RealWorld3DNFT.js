'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import './vv3-nft.css';
import './AccuracyCommerce.css';

const Product3DTwin = dynamic(() => import('./Product3DTwin'), {
  ssr: false,
  loading: () => <div className="vv3-twinLoading">LOADING VERIFIED 3D COLLECTIBLE</div>,
});

function isPlaceholder(url = '') {
  return /unsplash\.com|\/cj\/share\d+x\d+\.(?:jpg|jpeg|png|webp)(?:\?|$)|config-resource\/cj\/share/i.test(url);
}

function PendingMedia() {
  return <div className="vv3-accuracyEmpty">
    <div aria-hidden="true" style={{width:72,height:72,border:'1px solid rgba(255,255,255,.18)',borderRadius:20,display:'grid',placeItems:'center',marginBottom:16,background:'linear-gradient(145deg,rgba(143,112,255,.16),rgba(255,255,255,.03))'}}><span style={{fontSize:28,color:'#a894ff'}}>◇</span></div>
    <strong>Exact product media is being verified</strong>
    <small>We removed generic or stock imagery. The supplier product photo and interactive 3D collectible will appear here only after they are confirmed to match the product you can actually buy.</small>
    <span style={{marginTop:12,fontSize:8,letterSpacing:'.14em',fontWeight:900,color:'#a894ff'}}>PREVIEW ONLY · CHECKOUT LOCKED</span>
  </div>;
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

  if (!src || failed) return <PendingMedia />;

  return <div className="vv3-verifiedPhoto"><img src={src} alt={`${item?.name || 'Product'} from the linked supplier`} /><span>VERIFIED SUPPLIER PRODUCT IMAGE</span></div>;
}

export default function RealWorld3DNFT({ item, hero = false }) {
  const price = item?.customerPriceUsd ? `$${item.customerPriceUsd}` : null;
  const modelUrl = item?.modelUri || item?.digitalTwin?.modelUrl;
  const exactModelVerified = Boolean(modelUrl && item?.digitalTwin?.exactModelVerified);
  const titleId = `collectible-${item?.id || 'object'}`;

  return (
    <figure className={`vv3-modelFrame ${hero ? 'vv3-modelFrameHero' : ''}`} aria-labelledby={titleId}>
      <div className="vv3-twinHeader">
        <span className={`vv3-twinPill ${exactModelVerified ? 'is-verified' : 'is-pending'}`}><span aria-hidden="true">◆</span> {exactModelVerified ? 'VERIFIED 3D COLLECTIBLE' : 'EXACT 3D PENDING'}</span>
        <span className="vv3-twinSource">PRODUCT-SPECIFIC ACCURACY REQUIRED</span>
      </div>

      <div className="vv3-accuracyStage">
        {exactModelVerified ? <Product3DTwin item={item} hero={hero} /> : <VerifiedProductPhoto item={item} />}
      </div>

      <div className={`vv3-accuracyStatus ${exactModelVerified ? 'is-verified' : 'is-pending'}`}>
        <strong>{exactModelVerified ? 'Exact 3D collectible verified' : 'Exact 3D collectible not yet verified'}</strong>
        <small>{exactModelVerified ? 'This interactive 3D collectible has been checked against the physical product.' : 'Preview only. We will not show a generic shape or open checkout as though it were this product.'}</small>
      </div>

      <figcaption className="vv3-twinFooter" id={titleId}>
        <div className="vv3-twinName"><small>{item?.creator || 'Voxel Vault'}</small><strong>{item?.name || 'Collectible object'}</strong></div>
        <div className="vv3-twinPrice"><small>PHYSICAL + 3D COLLECTIBLE</small>{price && <strong>{price}</strong>}</div>
        <a className="vv3-twinOpen" href={item?.sourceUrl} target="_blank" rel="noreferrer" aria-label={`Verify the supplier product for ${item?.name || 'this collectible'}`}>VERIFY PRODUCT ↗</a>
      </figcaption>
    </figure>
  );
}
