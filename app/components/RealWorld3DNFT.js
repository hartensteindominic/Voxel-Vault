'use client';

import dynamic from 'next/dynamic';
import './vv3-nft.css';
import './real-product-3d.css';
import RealProduct3DCollectible from './RealProduct3DCollectible';

const Product3DTwin = dynamic(() => import('./Product3DTwin'), {
  ssr: false,
  loading: () => <div role="img" aria-label="Loading 3D NFT digital twin" className="vv3-twinLoading">LOADING 3D TWIN</div>,
});

export default function RealWorld3DNFT({ item, hero = false }) {
  const price = item?.customerPriceUsd ? `${item.customerPriceUsd}` : null;
  const isVaultReady = item?.vaultReady === true;
  const preview = item?.previewUri || item?.image || item?.imageUrl;
  const titleId = `twin-${item?.id || 'object'}`;
  const twinUrl = `/twin?asset=${encodeURIComponent(item?.id || '')}`;

  return (
    <figure className={`vv3-modelFrame ${hero ? 'vv3-modelFrameHero' : ''}`} aria-labelledby={titleId}>
      <div className="vv3-twinHeader">
        <span className="vv3-twinPill"><span aria-hidden="true">◆</span> {isVaultReady ? '3D NFT INCLUDED' : '3D CONCEPT PREVIEW'}</span>
        <span className="vv3-twinSource">{isVaultReady ? 'REAL PRODUCT + INTERACTIVE 3D NFT' : 'REFERENCE PRODUCT · NOT FOR SALE'}</span>
      </div>

      <div className="vv3-3dDualStage">
        <Product3DTwin item={item} hero={hero} />
        {preview && <RealProduct3DCollectible item={item} hero={hero} />}
      </div>

      <div className="vv3-nftBadge" aria-hidden="true">
        <span>{isVaultReady ? 'REAL PRODUCT + 3D NFT' : 'CONCEPT MODEL · NOT AN NFT'}</span>
        <small>{isVaultReady ? 'CONFIRMED MODEL MATCHED TO THIS PHYSICAL ITEM' : 'IMAGE-BASED PRESENTATION · MODEL RIGHTS NOT VERIFIED'}</small>
      </div>

      <figcaption className="vv3-twinFooter" id={titleId}>
        <div className="vv3-twinName">
          <small>{item?.creator || 'Voxel Vault'}</small>
          <strong>{item?.name || 'Collectible object'}</strong>
        </div>
        <div className="vv3-twinPrice">
          <small>{isVaultReady ? 'PHYSICAL + DIGITAL' : 'CONCEPT REFERENCE'}</small>
          {price && <strong>{price}</strong>}
        </div>
        <a className="vv3-twinOpen" href={twinUrl} aria-label={`Open ${isVaultReady ? '3D NFT' : 'concept preview'} for ${item?.name || 'this collectible'}`}>
          {isVaultReady ? 'OPEN 3D NFT ↗' : 'OPEN CONCEPT VIEW ↗'}
        </a>
      </figcaption>
    </figure>
  );
}
