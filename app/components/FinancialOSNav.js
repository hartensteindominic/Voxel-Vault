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
  if (pathname === '/property') return null;

  const simple = isSimplePropertyRoute(pathname);
  const dock = simple ? SIMPLE_PROPERTY_DOCK : APP_DOCK;
  const active = simple ? simplePropertyDockItemForPath(pathname) : dockItemForPath(pathname);

  return (
    <>
      <div aria-hidden="true" style={{ height: 'calc(92px + env(safe-area-inset-bottom))' }} />
      <nav
        aria-label="Voxel Vault primary navigation"
        style={{
          ...styles.nav,
          gridTemplateColumns: `repeat(${dock.length}, minmax(0, 1fr))`,
          ...(simple ? styles.simpleNav : {}),
        }}
      >
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
    bottom: 'max(9px, env(safe-area-inset-bottom))',
    transform: 'translateX(-50%)',
    width: 'min(560px, calc(100vw - 18px))',
    display: 'grid',
    gap: 3,
    padding: 6,
    boxSizing: 'border-box',
    border: '1px solid rgba(78,61,91,.12)',
    borderRadius: 25,
    background: 'rgba(255,252,246,.96)',
    boxShadow: '0 20px 56px rgba(50,35,63,.18), 0 1px 0 rgba(255,255,255,.96) inset',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    fontFamily: 'Inter, ui-rounded, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  simpleNav: {
    width: 'min(500px, calc(100vw - 18px))',
  },
  item: {
    minWidth: 0,
    minHeight: 56,
    display: 'grid',
    placeItems: 'center',
    alignContent: 'center',
    gap: 4,
    padding: '6px 3px',
    borderRadius: 19,
    color: '#302537',
    textDecoration: 'none',
    border: '1px solid transparent',
    touchAction: 'manipulation',
  },
  itemActive: {
    border: '1px solid rgba(92,48,218,.16)',
    background: 'linear-gradient(180deg, #7b43f2, #6835df)',
    boxShadow: '0 4px 0 #5428c7, 0 9px 20px rgba(103,54,223,.22)',
  },
  icon: {
    minWidth: 30,
    height: 28,
    padding: '0 7px',
    borderRadius: 10,
    display: 'grid',
    placeItems: 'center',
    fontSize: 11,
    fontWeight: 950,
    letterSpacing: '-.04em',
    color: '#756b79',
    background: 'rgba(105,78,118,.065)',
  },
  iconActive: {
    color: '#2d3c0d',
    background: '#c9ff54',
  },
  label: {
    maxWidth: '100%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: 9,
    lineHeight: 1.05,
    color: '#756d7a',
    fontWeight: 850,
  },
  labelActive: { color: '#fff' },
};
