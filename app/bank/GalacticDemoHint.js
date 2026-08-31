'use client';

import { useEffect, useState } from 'react';
import styles from './demo-hint.module.css';

const DISMISSED_KEY = 'galactic-trust-demo-hint-dismissed-v1';

export default function GalacticDemoHint() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      setVisible(window.localStorage.getItem(DISMISSED_KEY) !== '1');
    } catch {
      setVisible(true);
    }
  }, []);

  function dismiss() {
    try {
      window.localStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      // The hint remains dismissible for this page load even if storage is unavailable.
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <aside className={styles.hint} role="note" aria-label="Galactic Trust demo mode notice">
      <span className={styles.icon} aria-hidden="true">✦</span>
      <div className={styles.copy}>
        <strong>Demo and sandbox mode</strong>
        <p>Balances, cards, crypto, and transfers are simulated or use Increase sandbox pretend money. No real deposits or real crypto move in this build.</p>
      </div>
      <button className={styles.dismiss} type="button" onClick={dismiss} aria-label="Dismiss demo mode notice">Got it</button>
    </aside>
  );
}
