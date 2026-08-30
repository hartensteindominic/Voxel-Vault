'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './dashboard-account-state.module.css';

const stageCopy = {
  'demo-only': {
    tone: 'demo',
    icon: '✦',
    eyebrow: 'DEMO MODE',
    title: 'Illustrative money',
    detail: 'No provider-backed account is active. Real money stays locked.',
  },
  'sandbox-owner-bound': {
    tone: 'sandbox',
    icon: '✓',
    eyebrow: 'INCREASE SANDBOX',
    title: 'Test account bound',
    detail: 'Provider-backed test balance · pretend money only.',
  },
  'infrastructure-setup-required': {
    tone: 'warn',
    icon: '!',
    eyebrow: 'SETUP REQUIRED',
    title: 'Account setup needs attention',
    detail: 'Trusted binding infrastructure must be ready before provider data is treated as yours.',
  },
  'signed-out': {
    tone: 'demo',
    icon: '◉',
    eyebrow: 'SIGN IN REQUIRED',
    title: 'Account state unavailable',
    detail: 'Sign in to load your server-derived Galactic Trust account state.',
  },
};

const demoLifecycle = {
  stage: 'demo-only',
  canMoveRealMoney: false,
  sandbox: { ownerBindingReady: false, bindingStorageReady: true, canMoveRealMoney: false },
  production: { customerMoneyMovementSupported: false, canMoveRealMoney: false },
};

function copyFor(stage, failed) {
  if (failed) {
    return {
      tone: 'warn',
      icon: '!',
      eyebrow: 'STATUS CHECK',
      title: 'Account state needs a refresh',
      detail: 'The secure lifecycle check could not complete. No real-money capability was enabled.',
    };
  }
  return stageCopy[stage] || stageCopy['demo-only'];
}

export default function GalacticDashboardAccountState({ accessToken = '', demoAccess = false }) {
  const [target, setTarget] = useState(null);
  const [lifecycle, setLifecycle] = useState(demoLifecycle);
  const [loading, setLoading] = useState(Boolean(accessToken));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let frame;
    const findTarget = () => {
      const hero = document.querySelector('.gt-balance-hero');
      if (hero) setTarget(hero);
      else frame = requestAnimationFrame(findTarget);
    };
    findTarget();
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    let active = true;
    if (!accessToken || demoAccess) {
      setLifecycle(demoLifecycle);
      setLoading(false);
      setFailed(false);
      return () => { active = false; };
    }

    setLoading(true);
    setFailed(false);
    fetch('/api/bank/lifecycle', {
      cache: 'no-store',
      headers: { Authorization: `Bearer ${accessToken}` },
    }).then(async (response) => {
      const payload = await response.json().catch(() => ({}));
      if (!active) return;
      if (payload?.lifecycle) setLifecycle(payload.lifecycle);
      if (!response.ok) setFailed(true);
    }).catch(() => {
      if (active) setFailed(true);
    }).finally(() => {
      if (active) setLoading(false);
    });

    return () => { active = false; };
  }, [accessToken, demoAccess]);

  const copy = useMemo(() => copyFor(lifecycle?.stage, failed), [failed, lifecycle?.stage]);
  const productionLocked = lifecycle?.canMoveRealMoney !== true
    && lifecycle?.production?.customerMoneyMovementSupported !== true
    && lifecycle?.production?.canMoveRealMoney !== true;

  if (!target) return null;

  return createPortal(
    <section className={`${styles.card} ${styles[copy.tone]}`} aria-label="Galactic Trust account state" aria-live="polite">
      <div className={styles.topline}>
        <span className={styles.icon}>{loading ? '◌' : copy.icon}</span>
        <span className={styles.eyebrow}>{loading ? 'CHECKING ACCOUNT STATE' : copy.eyebrow}</span>
      </div>
      <strong>{loading ? 'Verifying your account…' : copy.title}</strong>
      <p>{loading ? 'Reading your secure server-derived lifecycle.' : copy.detail}</p>
      <div className={styles.footer}>
        <span className={productionLocked ? styles.locked : styles.review}>{productionLocked ? '🔒 REAL MONEY LOCKED' : '! REVIEW REQUIRED'}</span>
        <Link href="/bank/status">View status →</Link>
      </div>
    </section>,
    target
  );
}
