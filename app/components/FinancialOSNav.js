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
  // The property maker intentionally mirrors the ultra-condensed VoxelPop screen.
  // Its own large actions are the navigation; a second fixed dock would duplicate controls.
  if (pathname === '/property') return null;
  const simple = isSimplePropertyRoute(pathname);
  const dock = simple ? SIMPLE_PROPERTY_DOCK : APP_DOCK;
  const active = simple ? simplePropertyDockItemForPath(pathname) : dockItemForPath(pathname);

  return (
    <>
      <div aria-hidden="true" style={{ height: 'calc(82px + env(safe-area-inset-bottom))' }} />
      <nav aria-label="Voxel Vault primary navigation" style={{ ...styles.nav, gridTemplateColumns: `repeat(${dock.length}, minmax(0, 1fr))`, ...(simple ? styles.simpleNav : {}) }}>
        {dock.map((item) => {
          const selected = item.id === active.id;
          return (
            <Link
              key={item.id}
              href={item.href}
              aria-current={selected ? 'page' : undefined}
              style={{ ...styles.item, ...(selected ? styles.itemActive : {}) }}
            >
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
    bottom: 'max(10px, env(safe-area-inset-bottom))',
    transform: 'translateX(-50%)',
    width: 'min(590px, calc(100vw - 18px))',
    display: 'grid',
    gap: 4,
    padding: 6,
    boxSizing: 'border-box',
    border: '1px solid rgba(72,48,85,.12)',
    borderRadius: 23,
    background: 'rgba(255,251,244,.94)',
    boxShadow: '0 18px 52px rgba(48,31,57,.2), 0 1px 0 rgba(255,255,255,.85) inset',
    backdropFilter: 'blur(22px)',
    WebkitBackdropFilter: 'blur(22px)',
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
  },
  simpleNav: {
    width: 'min(430px, calc(100vw - 18px))',
  },
  item: {
    minWidth: 0,
    minHeight: 52,
    display: 'grid',
    placeItems: 'center',
    alignContent: 'center',
    gap: 3,
    padding: '6px 4px',
    borderRadius: 17,
    color: '#2a2030',
    textDecoration: 'none',
    border: '1px solid transparent',
    touchAction: 'manipulation',
  },
  itemActive: {
    border: '1px solid rgba(92,48,218,.2)',
    background: 'linear-gradient(180deg, #7d42ff, #6630e9)',
    boxShadow: '0 4px 0 #4d1bc5, 0 8px 18px rgba(103,54,223,.2)',
  },
  icon: {
    minWidth: 28,
    height: 26,
    padding: '0 6px',
    borderRadius: 9,
    display: 'grid',
    placeItems: 'center',
    fontSize: 10,
    fontWeight: 950,
    letterSpacing: '-.04em',
    color: '#766d7c',
    background: 'rgba(105,78,118,.07)',
  },
  iconActive: { color: '#2e400c', background: '#c9ff54' },
  label: { fontSize: 9, lineHeight: 1.05, color: '#756d7a' },
  labelActive: { color: '#fff' },
};
