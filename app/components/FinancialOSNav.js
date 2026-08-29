'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  APP_DOCK,
  SIMPLE_PROPERTY_DOCK,
  dockItemForPath,
  isOrganizedUserRoute,
  isSimplePropertyRoute,
  simplePropertyDockItemForPath,
} from '../../lib/product-map';

export default function FinancialOSNav() {
  const pathname = usePathname() || '/';
  if (!isOrganizedUserRoute(pathname)) return null;
  // The bare property maker keeps its own ultra-condensed VoxelPop controls.
  if (pathname === '/property') return null;
  const simple = isSimplePropertyRoute(pathname);
  const dock = simple ? SIMPLE_PROPERTY_DOCK : APP_DOCK;
  const active = simple ? simplePropertyDockItemForPath(pathname) : dockItemForPath(pathname);

  return (
    <>
      <div aria-hidden="true" style={{ height: 'calc(86px + env(safe-area-inset-bottom))' }} />
      <nav aria-label="Voxel Vault primary navigation" style={{ ...styles.nav, gridTemplateColumns: `repeat(${dock.length}, minmax(0, 1fr))`, ...(simple ? styles.simpleNav : {}) }}>
        {dock.map((item) => {
          const selected = item.id === active.id;
          return (
            <Link key={item.id} href={item.href} aria-current={selected ? 'page' : undefined} style={{ ...styles.item, ...(selected ? styles.itemActive : {}) }}>
              <span style={{ ...styles.icon, ...(selected ? styles.iconActive : {}) }}>{item.icon}</span>
              <b style={{ ...styles.label, ...(selected ? styles.labelActive : {}) }}>{item.label}</b>
            </Link>
          );
        })}
      </nav>
    </>
  );
}

const styles = {
  nav: {
    position: 'fixed',
    zIndex: 90,
    left: '50%',
    bottom: 'max(8px, env(safe-area-inset-bottom))',
    transform: 'translateX(-50%)',
    width: 'min(590px, calc(100vw - 16px))',
    display: 'grid',
    gap: 5,
    padding: 7,
    boxSizing: 'border-box',
    border: '1px solid rgba(84,64,75,.12)',
    borderRadius: 25,
    background: 'rgba(255,252,246,.96)',
    boxShadow: '0 18px 48px rgba(63,42,76,.16), 0 1px 0 rgba(255,255,255,.95) inset',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    fontFamily: 'Inter, ui-rounded, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  simpleNav: { width: 'min(470px, calc(100vw - 16px))' },
  item: {
    minWidth: 0,
    minHeight: 54,
    display: 'grid',
    placeItems: 'center',
    alignContent: 'center',
    gap: 3,
    padding: '5px 3px',
    borderRadius: 18,
    color: '#4b424c',
    textDecoration: 'none',
    border: '1px solid transparent',
    touchAction: 'manipulation',
    transition: 'transform .12s ease, background .12s ease, box-shadow .12s ease',
  },
  itemActive: {
    border: '1px solid rgba(49,145,113,.22)',
    background: 'linear-gradient(180deg,#efffd5,#dcf7cb)',
    boxShadow: '0 4px 0 #b7db87, 0 8px 20px rgba(77,125,60,.12)',
    transform: 'translateY(-1px)',
  },
  icon: {
    minWidth: 30,
    height: 28,
    padding: '0 7px',
    borderRadius: 10,
    display: 'grid',
    placeItems: 'center',
    fontSize: 12,
    fontWeight: 1000,
    letterSpacing: '-.04em',
    color: '#776d78',
    background: 'rgba(112,87,119,.07)',
  },
  iconActive: { color: '#1e7052', background: '#a9e7c8', boxShadow: 'inset 0 -3px 0 rgba(43,131,99,.16)' },
  label: { fontSize: 9, lineHeight: 1.05, color: '#746b75', fontWeight: 850 },
  labelActive: { color: '#265d48' },
};
