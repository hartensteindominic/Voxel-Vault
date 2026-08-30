'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './header-center.module.css';

const demoLifecycle = {
  stage: 'demo-only',
  canMoveRealMoney: false,
  sandbox: { ownerBindingReady: false, bindingStorageReady: true },
  production: { customerMoneyMovementSupported: false, implementationReady: false },
};

function anchorPosition(node) {
  if (!node || typeof window === 'undefined') return {};
  const rect = node.getBoundingClientRect();
  const width = Math.min(360, Math.max(280, window.innerWidth - 24));
  const right = Math.max(12, window.innerWidth - rect.right);
  return {
    top: Math.min(window.innerHeight - 20, rect.bottom + 10),
    right,
    width,
  };
}

function accountNotification(lifecycle, failed) {
  if (failed) {
    return {
      tone: 'warn',
      icon: '!',
      title: 'Account status needs a refresh',
      detail: 'The secure lifecycle check did not complete. No real-money capability was enabled.',
      href: '/bank/status',
      action: 'Review status',
    };
  }
  if (lifecycle?.stage === 'sandbox-owner-bound') {
    return {
      tone: 'good',
      icon: '✓',
      title: 'Increase sandbox test account connected',
      detail: 'Provider-backed test data is scoped to your signed-in account. The money is pretend.',
      href: '/bank/status',
      action: 'View account',
    };
  }
  if (lifecycle?.stage === 'infrastructure-setup-required') {
    return {
      tone: 'warn',
      icon: '!',
      title: 'Account setup needs attention',
      detail: 'Trusted provider-binding infrastructure must be ready before provider data is treated as yours.',
      href: '/bank/status',
      action: 'See next step',
    };
  }
  return {
    tone: 'neutral',
    icon: '✦',
    title: 'Demo mode is active',
    detail: 'Balances and transfers are illustrative unless your signed-in account is explicitly bound to an Increase sandbox test account.',
    href: '/bank/status',
    action: 'View status',
  };
}

function NotificationItem({ item }) {
  return (
    <article className={styles.notificationItem}>
      <span className={`${styles.itemIcon} ${styles[item.tone]}`}>{item.icon}</span>
      <div><b>{item.title}</b><p>{item.detail}</p>{item.href && <Link href={item.href}>{item.action || 'Open'} →</Link>}</div>
    </article>
  );
}

export default function GalacticHeaderCenter({ accessToken = '', demoAccess = false, accountLabel = 'Galactic member', onSignOut }) {
  const [bell, setBell] = useState(null);
  const [profile, setProfile] = useState(null);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationAnchor, setNotificationAnchor] = useState({});
  const [profileAnchor, setProfileAnchor] = useState({});
  const [lifecycle, setLifecycle] = useState(demoLifecycle);
  const [lifecycleFailed, setLifecycleFailed] = useState(false);

  useEffect(() => {
    let frame;
    const find = () => {
      const nextBell = document.querySelector('.gt-notification');
      const nextProfile = document.querySelector('.gt-profile');
      if (nextBell && nextProfile) {
        setBell(nextBell);
        setProfile(nextProfile);
      } else {
        frame = requestAnimationFrame(find);
      }
    };
    find();
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    let active = true;
    if (!accessToken || demoAccess) {
      setLifecycle(demoLifecycle);
      setLifecycleFailed(false);
      return () => { active = false; };
    }
    fetch('/api/bank/lifecycle', {
      cache: 'no-store',
      headers: { Authorization: `Bearer ${accessToken}` },
    }).then(async (response) => {
      const payload = await response.json().catch(() => ({}));
      if (!active) return;
      if (payload?.lifecycle) setLifecycle(payload.lifecycle);
      setLifecycleFailed(!response.ok);
    }).catch(() => {
      if (active) setLifecycleFailed(true);
    });
    return () => { active = false; };
  }, [accessToken, demoAccess]);

  const notifications = useMemo(() => {
    const productionLocked = lifecycle?.canMoveRealMoney !== true
      && lifecycle?.production?.customerMoneyMovementSupported !== true;
    return [
      accountNotification(lifecycle, lifecycleFailed),
      {
        tone: productionLocked ? 'locked' : 'warn',
        icon: '🔒',
        title: productionLocked ? 'Production banking is locked' : 'Production state requires review',
        detail: productionLocked
          ? 'No production account opening or real-money movement is enabled in this build.'
          : 'An unexpected production-capable lifecycle was detected.',
        href: '/bank/readiness',
        action: 'Launch readiness',
      },
      {
        tone: 'neutral',
        icon: '◈',
        title: 'Crypto is practice-only',
        detail: 'The crypto portfolio uses isolated demo cash and illustrative reference prices. It never touches bank or Increase balances.',
        href: null,
      },
    ];
  }, [lifecycle, lifecycleFailed]);

  useEffect(() => {
    if (!bell || !profile) return undefined;

    const bellClick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      setNotificationAnchor(anchorPosition(bell));
      setNotificationOpen((value) => !value);
      setProfileOpen(false);
    };
    const profileClick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      setProfileAnchor(anchorPosition(profile));
      setProfileOpen((value) => !value);
      setNotificationOpen(false);
    };

    bell.addEventListener('click', bellClick, true);
    profile.addEventListener('click', profileClick, true);
    bell.setAttribute('aria-haspopup', 'dialog');
    profile.setAttribute('aria-haspopup', 'menu');

    const badge = bell.querySelector('i');
    if (badge) badge.textContent = String(notifications.length);

    return () => {
      bell.removeEventListener('click', bellClick, true);
      profile.removeEventListener('click', profileClick, true);
    };
  }, [bell, notifications.length, profile]);

  useEffect(() => {
    if (!bell || !profile) return undefined;
    bell.setAttribute('aria-expanded', notificationOpen ? 'true' : 'false');
    profile.setAttribute('aria-expanded', profileOpen ? 'true' : 'false');

    const reposition = () => {
      if (notificationOpen) setNotificationAnchor(anchorPosition(bell));
      if (profileOpen) setProfileAnchor(anchorPosition(profile));
    };
    const keydown = (event) => {
      if (event.key === 'Escape') {
        setNotificationOpen(false);
        setProfileOpen(false);
      }
    };
    const pointer = (event) => {
      const insidePanel = event.target?.closest?.('[data-galactic-header-panel]');
      if (insidePanel || bell.contains(event.target) || profile.contains(event.target)) return;
      setNotificationOpen(false);
      setProfileOpen(false);
    };

    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('keydown', keydown);
    document.addEventListener('pointerdown', pointer);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('keydown', keydown);
      document.removeEventListener('pointerdown', pointer);
    };
  }, [bell, notificationOpen, profile, profileOpen]);

  if (!bell || !profile) return null;

  const displayLabel = String(accountLabel || 'Galactic member').trim().slice(0, 80) || 'Galactic member';
  const first = displayLabel.charAt(0).toUpperCase() || 'G';

  return createPortal(
    <>
      {notificationOpen && (
        <section data-galactic-header-panel className={styles.panel} style={notificationAnchor} role="dialog" aria-label="Galactic Trust notifications">
          <header className={styles.panelHeader}>
            <div><span>GALACTIC TRUST</span><h2>Notifications</h2></div>
            <button type="button" onClick={() => setNotificationOpen(false)} aria-label="Close notifications">×</button>
          </header>
          <div className={styles.notificationList}>{notifications.map((item) => <NotificationItem item={item} key={item.title} />)}</div>
          <footer className={styles.panelFooter}><span>Safe account summaries only</span><Link href="/bank/status">Account status →</Link></footer>
        </section>
      )}

      {profileOpen && (
        <section data-galactic-header-panel className={`${styles.panel} ${styles.profilePanel}`} style={profileAnchor} role="menu" aria-label="Galactic Trust profile menu">
          <div className={styles.profileIdentity}>
            <span>{first}</span>
            <div><b>{displayLabel}</b><small>{demoAccess ? 'Demo Explorer' : 'Signed-in Galactic Trust account'}</small></div>
          </div>
          <nav className={styles.profileLinks}>
            <Link role="menuitem" href="/bank/status"><span>◉</span><p><b>My account status</b><small>See exactly what your account can do</small></p></Link>
            <Link role="menuitem" href="/privacy"><span>✓</span><p><b>Privacy Center</b><small>Review data and security boundaries</small></p></Link>
            <Link role="menuitem" href="/bank/readiness"><span>🔒</span><p><b>Launch readiness</b><small>See why live banking remains gated</small></p></Link>
          </nav>
          <button className={styles.signOut} type="button" role="menuitem" onClick={() => { setProfileOpen(false); onSignOut?.(); }}><span>↪</span>{demoAccess ? 'Exit demo' : 'Log out securely'}</button>
          <p className={styles.profileBoundary}>Galactic Trust is a financial technology product, not a bank. No real-money capability is enabled by this menu.</p>
        </section>
      )}
    </>,
    document.body
  );
}
