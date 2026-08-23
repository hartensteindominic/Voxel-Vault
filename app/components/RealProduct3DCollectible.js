'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Turns the real catalog product image into the visible 3D collectible.
 * This is deliberately image-backed: it never invents manufacturer geometry.
 * A supplier GLB/GLTF can still be promoted to the exact-model path later.
 */
export default function RealProduct3DCollectible({ item, hero = false }) {
  const stageRef = useRef(null);
  const [rotation, setRotation] = useState({ x: -4, y: -14 });
  const dragging = useRef(false);
  const lastX = useRef(0);
  const lastY = useRef(0);

  const src = item?.previewUri || item?.image || item?.imageUrl;
  const name = item?.name || 'Real product';

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const onMove = (event) => {
      if (!dragging.current) return;
      const x = event.clientX ?? event.touches?.[0]?.clientX ?? lastX.current;
      const y = event.clientY ?? event.touches?.[0]?.clientY ?? lastY.current;
      setRotation((value) => ({
        x: Math.max(-75, Math.min(75, value.x - (y - lastY.current) * 0.45)),
        y: value.y + (x - lastX.current) * 0.55,
      }));
      lastX.current = x;
      lastY.current = y;
    };
    const stop = () => { dragging.current = false; };
    stage.addEventListener('pointermove', onMove);
    stage.addEventListener('pointerup', stop);
    stage.addEventListener('pointercancel', stop);
    stage.addEventListener('pointerleave', stop);
    return () => {
      stage.removeEventListener('pointermove', onMove);
      stage.removeEventListener('pointerup', stop);
      stage.removeEventListener('pointercancel', stop);
      stage.removeEventListener('pointerleave', stop);
    };
  }, []);

  if (!src) {
    return (
      <div className="vv3-real3dEmpty" role="img" aria-label={`${name} 3D NFT is unavailable until a real product image is supplied`}>
        <strong>3D NFT ASSET NEEDED</strong>
        <span>Add the real product image or a licensed GLB/GLTF to this catalog item.</span>
      </div>
    );
  }

  return (
    <div
      ref={stageRef}
      className={`vv3-real3dStage ${hero ? 'vv3-real3dStageHero' : ''}`}
      role="img"
      aria-label={`${name} real product 3D collectible. Drag to rotate.`}
      onPointerDown={(event) => {
        dragging.current = true;
        lastX.current = event.clientX;
        lastY.current = event.clientY;
        event.currentTarget.setPointerCapture?.(event.pointerId);
      }}
    >
      <div className="vv3-real3dGrid" aria-hidden="true" />
      <div className="vv3-real3dObject" style={{ transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)` }}>
        <div className="vv3-real3dFace vv3-real3dFront">
          <img src={src} alt="" draggable="false" />
        </div>
        <div className="vv3-real3dFace vv3-real3dBack" aria-hidden="true">
          <img src={src} alt="" draggable="false" />
        </div>
        <div className="vv3-real3dEdge vv3-real3dEdgeTop" />
        <div className="vv3-real3dEdge vv3-real3dEdgeBottom" />
        <div className="vv3-real3dEdge vv3-real3dEdgeLeft" />
        <div className="vv3-real3dEdge vv3-real3dEdgeRight" />
      </div>
      <div className="vv3-real3dFloor" aria-hidden="true" />
      <div className="vv3-real3dLabel">
        <span>REAL PRODUCT</span>
        <strong>3D NFT</strong>
        <small>DRAG ANY DIRECTION · MATCHED TO PHYSICAL ITEM</small>
      </div>
    </div>
  );
}
