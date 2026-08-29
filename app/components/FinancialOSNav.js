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
      <div aria-hidden="true" style={{ height: 'calc(86px + env(safe-area-inset-bottom))' }} />
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
    width: 'min(600px, calc(100vw - 18px))',
    display: 'grid',
    gap: 5,
    padding: 7,
    boxSizing: 'border-box',
    border: '1px solid #e4dfea',
    borderRadius: 24,
    background: 'rgba(255,250,240,.94)',
    boxShadow: '0 18px 54px rgba(83,55,123,.18)',
    backdropFilter: 'blur(22px)',
    WebkitBackdropFilter: 'blur(22px)',
    fontFamily: 'Inter, ui-rounded, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
  },
  simpleNav: {
    width: 'min(440px, calc(100vw - 18px))',
  },
  item: {
    minWidth: 0,
    minHeight: 52,
    display: 'grid',
    placeItems: 'center',
    alignContent: 'center',
    gap: 4,
    padding: '6px 4px',
    borderRadius: 17,
    color: '#655e6b',
    textDecoration: 'none',
    border: '1px solid transparent',
    touchAction: 'manipulation',
  },
  itemActive: {
    border: '1px solid #d9cdfa',
    background: 'linear-gradient(180deg, #f2edff, #eee8ff)',
    boxShadow: 'inset 0 -2px 0 rgba(113,56,245,.07)',
  },
  icon: {
    minWidth: 28,
    height: 27,
    padding: '0 6px',
    borderRadius: 10,
    display: 'grid',
    placeItems: 'center',
    fontSize: 11,
    fontWeight: 1000,
    letterSpacing: '-.04em',
    color: '#817887',
    background: '#ffffffaa',
  },
  iconActive: { color: '#fff', background: 'linear-gradient(#7d42ff,#6630e9)', boxShadow: '0 4px 0 #4d1bc5' },
  label: { fontSize: 9, lineHeight: 1.05, color: '#827a88' },
  labelActive: { color: '#5a2bd4' },
};
