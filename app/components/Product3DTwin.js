'use client';

import { useState } from 'react';
import RealProductModel from './RealProductModel';

function TwinFallback({ item, hidden }) {
  return (
    <div
      className="vv3-twinFallback"
      role="img"
      aria-label={`${item?.name || 'Real-world object'} 3D NFT digital twin`}
      aria-hidden={hidden ? 'true' : undefined}
      style={{
        opacity: hidden ? 0 : 1,
        pointerEvents: hidden ? 'none' : 'auto',
      }}
    >
      <div
        className="vv3-twinFallbackOrb"
        style={
          item?.previewUri
            ? {
                backgroundImage: `url(${item.previewUri})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                borderRadius: '18px',
                width: '150px',
                height: '170px',
                boxShadow:
                  '0 18px 45px rgba(0,0,0,.42), 0 0 35px rgba(106,88,232,.18)',
                transform: 'perspective(700px) rotateY(-10deg)',
                backgroundColor: '#10131c',
              }
            : undefined
        }
      />
      <span>REAL PRODUCT 3D NFT</span>
      <small>
        {item?.name || 'Interactive digital collectible'} · drag / orbit / zoom
      </small>
    </div>
  );
}

export default function Product3DTwin({ item, hero = false }) {
  const [ready, setReady] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  return (
    <div
      className="vv3-twinCanvas"
      role="img"
      aria-label={`${item?.name || 'Real-world object'} 3D NFT digital twin`}
      data-hero={hero ? 'true' : 'false'}
    >
      {!unavailable && <RealProductModel item={item} onLoaded={setReady} onUnavailable={() => setUnavailable(true)} />}
      <TwinFallback item={item} hidden={ready} />
    </div>
  );
}
