'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import styles from './VoxelPopExitIntent.module.css';

const STORAGE_KEY = 'voxelpopExitIntentShown';

export default function VoxelPopExitIntent() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isVoxelPopRoute = pathname === '/' || pathname?.startsWith('/studio');

  useEffect(() => {
    if (!isVoxelPopRoute || typeof window === 'undefined') return undefined;
    if (window.sessionStorage.getItem(STORAGE_KEY) === '1') return undefined;
    if (!window.matchMedia('(pointer: fine)').matches) return undefined;

    const onMouseOut = (event) => {
      if (event.clientY > 8 || event.relatedTarget) return;
      window.sessionStorage.setItem(STORAGE_KEY, '1');
      setOpen(true);
    };

    const timer = window.setTimeout(() => document.addEventListener('mouseout', onMouseOut), 8000);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('mouseout', onMouseOut);
    };
  }, [isVoxelPopRoute]);

  if (!isVoxelPopRoute || !open) return null;

  return (
    <div className={styles.backdrop} role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) setOpen(false);
    }}>
      <section className={styles.card} role="dialog" aria-modal="true" aria-label="VoxelPop offer reminder">
        <button className={styles.close} type="button" onClick={() => setOpen(false)} aria-label="Close">×</button>
        <span className={styles.kicker}>✦ BEFORE YOU GO</span>
        <h2>One custom 3D voxel is still just $1.99.</h2>
        <p>GLB model + source image. One payment. No subscription.</p>
        <button className={styles.primary} type="button" onClick={() => {
          setOpen(false);
          document.querySelector('textarea')?.focus();
        }}>
          Keep creating · $1.99
        </button>
        <button className={styles.secondary} type="button" onClick={() => setOpen(false)}>Not now</button>
      </section>
    </div>
  );
}
