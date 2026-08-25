'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import styles from './VoxelPopExitIntent.module.css';

const STORAGE_KEY = 'voxelpopExitIntentShown';
const FLOW_KEY = 'voxelpopFlowId';

function flowId() {
  let id = window.sessionStorage.getItem(FLOW_KEY) || '';
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    id = crypto.randomUUID();
    window.sessionStorage.setItem(FLOW_KEY, id);
  }
  return id;
}

function attribution() {
  const params = new URLSearchParams(window.location.search);
  return {
    source: params.get('utm_source') || '',
    medium: params.get('utm_medium') || '',
    campaign: params.get('utm_campaign') || '',
    content: params.get('utm_content') || '',
  };
}

function track(eventName) {
  fetch('/api/creator-pack/analytics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventName, flowId: flowId(), attribution: attribution() }),
    keepalive: true,
  }).catch(() => {});
}

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
      track('exit_intent_shown');
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
          track('exit_intent_cta');
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
