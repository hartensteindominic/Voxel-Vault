'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import Auto3DPreview from './Auto3DPreview';
import './vv3-nft.css';
import './AccuracyCommerce.css';

const Product3DTwin = dynamic(() => import('./Product3DTwin'), {
  ssr: false,
  loading: () => <div className="vv3-twinLoading">LOADING INTERACTIVE COLLECTIBLE</div>,
});

function isPlaceholder(url = '') {
  return /unsplash\.com|\/cj\/share\d+x\d+\.(?:jpg|jpeg|png|webp)(?:\?|$)|config-resource\/cj\/share/i.test(url);
}

function PendingMedia() {
  return <div className="vv3-accuracyEmpty">
    <div aria-hidden="true" style={{width:72,height:72,border:'1px solid rgba(255,255,255,.18)',borderRadius:20,display:'grid',placeItems:'center',marginBottom:16,background:'linear-gradient(145deg,rgba(143,112,255,.16),rgba(255,255,255,.03))'}}><span style={{fontSize:28,color:'#a894ff'}}>◇</span></div>
    <strong>Product media is syncing</strong>
    <small>Voxel Vault is pulling the CJ product image and preparing an interactive preview in the background.</small>
    <span style={{marginTop:12,fontSize:8,letterSpacing:'.14em',fontWeight:900,color:'#a894ff'}}>BROWSE NOW · CHECKOUT OPENS WHEN READY</span>
  </div>;
}

function VerifiedProductPhoto({ item }) {
  const fallback = !isPlaceholder(item?.previewUri || '') ? item.previewUri : '';
  const [src, setSrc] = useState(fallback);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    if (!item?.sourceUrl && !item?.supplierSku) return undefined;
    const params = new URLSearchParams();
    if (item?.sourceUrl) params.set('url', item.sourceUrl);
    if (item?.supplierSku) params.set('sku', item.supplierSku);
    fetch(`/api/product-image?${params.toString()}`, { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('Product image unavailable'))))
      .then((data) => {
        if (active && data?.imageUrl && !isPlaceholder(data.imageUrl)) { setSrc(data.imageUrl); setFailed(false); }
        else if (active) { setSrc(''); setFailed(true); }
      })
      .catch(() => { if (active && !fallback) setFailed(true); });
    return () => { active = false; };
  }, [item?.sourceUrl, item?.supplierSku, fallback]);

  if (!src || failed) return <PendingMedia />;
  return <div className="vv3-verifiedPhoto"><img src={src} alt={`${item?.name || 'Product'} from CJdropshipping`} /><span>LIVE CJ PRODUCT IMAGE · INTERACTIVE PREVIEW BUILDING</span></div>;
}

export default function RealWorld3DNFT({ item, hero = false }) {
  const price = item?.customerPriceUsd ? `$${item.customerPriceUsd}` : null;
  const modelUrl = item?.modelUri || item?.digitalTwin?.modelUrl;
  const exactModelVerified = Boolean(modelUrl && item?.digitalTwin?.exactModelVerified);
  const titleId = `collectible-${item?.id || 'object'}`;

  return (
    <figure className={`vv3-modelFrame ${hero ? 'vv3-modelFrameHero' : ''}`} aria-labelledby={titleId}>
      <div className="vv3-twinHeader">
        <span className={`vv3-twinPill ${exactModelVerified ? 'is-verified' : 'is-pending'}`}><span aria-hidden="true">◆</span> {exactModelVerified ? 'EXACT MODEL APPROVED' : hero ? 'LIVE INTERACTIVE PREVIEW' : 'PREVIEW BUILDING'}</span>
        <span className="vv3-twinSource">REAL CJ PRODUCT · USD PURCHASE</span>
      </div>
      <div className="vv3-accuracyStage">
        {exactModelVerified ? <Product3DTwin item={item} hero={hero} /> : hero ? <Auto3DPreview item={item} hero /> : <VerifiedProductPhoto item={item} />}
      </div>
      <div className={`vv3-accuracyStatus ${exactModelVerified ? 'is-verified' : 'is-pending'}`}>
        <strong>{exactModelVerified ? 'Interactive collectible matches the sellable physical item' : hero ? 'Interactive preview builds automatically' : 'Open this product to view its interactive preview'}</strong>
        <small>{exactModelVerified ? 'Voxel Vault approved this model for the same CJ product customers can buy.' : hero ? 'The preview is built from synced CJ product media and can continue in the background. Checkout stays off until Voxel Vault confirms the shape represents the same physical product closely enough.' : 'Readiness checks happen behind the scenes before checkout goes live.'}</small>
      </div>
      <figcaption className="vv3-twinFooter" id={titleId}>
        <div className="vv3-twinName"><small>{item?.creator || 'Voxel Vault'}</small><strong>{item?.name || 'Collectible object'}</strong></div>
        <div className="vv3-twinPrice"><small>PHYSICAL + DIGITAL COLLECTIBLE</small>{price && <strong>{price}</strong>}</div>
        <a className="vv3-twinOpen" href={item?.sourceUrl} target="_blank" rel="noreferrer" aria-label={`Open the CJ supplier listing for ${item?.name || 'this product'}`}>VIEW CJ LISTING ↗</a>
      </figcaption>
    </figure>
  );
}
