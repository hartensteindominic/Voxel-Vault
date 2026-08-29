'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './PhotoReliefModelViewer.module.css';

export default function PhotoReliefModelViewer({ imageUrl, onReady }) {
  const callbackRef = useRef(onReady);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  callbackRef.current = onReady;

  useEffect(() => {
    if (!imageUrl) return undefined;
    let dead = false;
    setStatus('loading');
    setError('');
    const image = new Image();
    image.decoding = 'async';
    image.src = imageUrl;
    image.onload = () => {
      if (dead) return;
      setStatus('ready');
      callbackRef.current?.();
    };
    image.onerror = () => {
      if (dead) return;
      setStatus('error');
      setError('The selected photo could not be opened.');
    };
    return () => {
      dead = true;
      image.onload = null;
      image.onerror = null;
    };
  }, [imageUrl]);

  return <div className={`viewerShell ${styles.shell}`}>
    <div className={styles.photoStage}>
      <img className={styles.housePhoto} src={imageUrl} alt="3D voxel photo preview of the selected property"/>
      <div className={styles.depthGlow} aria-hidden="true"/>
    </div>
    {status === 'loading' ? <div className={styles.loading}><span>BUILDING 3D VOXEL PHOTO…</span></div> : null}
    {!error ? <>
      <div className={styles.qualityBadge} aria-hidden="true"><span>3D VOXEL PHOTO</span><b>PHOTO-MATCHED</b></div>
      <div className={styles.hint} aria-hidden="true">PHOTO-MATCHED PREVIEW</div>
      <div className={styles.sourceCard} aria-hidden="true"><img src={imageUrl} alt=""/><span>ORIGINAL PHOTO</span></div>
    </> : null}
    {error ? <div className={styles.error} role="status"><img src={imageUrl} alt="Original property reference"/><p>{error} Choose the photo again; you will not be charged again.</p></div> : null}
  </div>;
}
