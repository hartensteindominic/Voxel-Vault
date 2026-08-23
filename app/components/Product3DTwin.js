'use client';

import { useState } from 'react';
import RealProductModel from './RealProductModel';

function ProductFallback({ item, hidden }) {
  const preview = item?.previewUri || item?.digitalTwin?.previewUrl || '';
  return (
    <div className="vv3-twinFallback" role="img" aria-label={`${item?.name || 'Real-world object'} product preview`} aria-hidden={hidden ? 'true' : undefined} style={{ opacity: hidden ? 0 : 1, pointerEvents: hidden ? 'none' : 'auto' }}>
      <div className="vv3-twinFallbackOrb" style={preview ? { backgroundImage: `url(${preview})`, backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center', borderRadius: '18px', width: '180px', height: '190px', backgroundColor: '#10131c' } : undefined} />
      <span>LOADING INTERACTIVE OBJECT</span>
      <small>{item?.name || 'Interactive collectible'} · drag / orbit / zoom</small>
    </div>
  );
}

export default function Product3DTwin({ item, hero = false }) {
  const [ready, setReady] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  return (
    <div className="vv3-twinCanvas" role="img" aria-label={`${item?.name || 'Real-world object'} interactive collectible`} data-hero={hero ? 'true' : 'false'}>
      {!unavailable && <RealProductModel item={item} onLoaded={setReady} onUnavailable={() => setUnavailable(true)} />}
      <ProductFallback item={item} hidden={ready} />
    </div>
  );
}
