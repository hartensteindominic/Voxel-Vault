'use client';

import { useEffect, useState } from 'react';
import RealProductModel from './RealProductModel';

function ProductFallback({ item, hidden, unavailable }) {
  const preview = item?.previewUri || item?.digitalTwin?.previewUrl || '';
  return (
    <div
      className="vv3-twinFallback"
      role="img"
      aria-label={`${item?.name || 'Real-world object'} product preview`}
      aria-hidden={hidden ? 'true' : undefined}
      style={{ opacity: hidden ? 0 : 1, pointerEvents: hidden ? 'none' : 'auto' }}
    >
      <div
        className="vv3-twinFallbackOrb"
        style={preview ? {
          backgroundImage: `url(${preview})`,
          backgroundSize: 'contain',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
        } : undefined}
      />
      <span>{unavailable ? 'Product preview' : 'Preparing dynamic 3D'}</span>
      <small>
        {unavailable
          ? 'Interactive 3D is unavailable on this device.'
          : `${item?.name || 'Interactive collectible'} · auto-rotating view`}
      </small>
    </div>
  );
}

export default function Product3DTwin({ item, hero = false }) {
  const [ready, setReady] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    setReady(false);
    setUnavailable(false);
  }, [item?.id, item?.modelUri, item?.digitalTwin?.modelUrl]);

  const handleUnavailable = () => {
    setReady(false);
    setUnavailable(true);
  };

  return (
    <div
      className="vv3-twinCanvas"
      role="img"
      aria-label={`${item?.name || 'Real-world object'} dynamic 3D product view`}
      data-hero={hero ? 'true' : 'false'}
    >
      {!unavailable && (
        <RealProductModel
          item={item}
          onLoaded={() => setReady(true)}
          onUnavailable={handleUnavailable}
        />
      )}
      <ProductFallback item={item} hidden={ready} unavailable={unavailable} />
    </div>
  );
}
