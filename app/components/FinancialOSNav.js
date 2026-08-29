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

  const simple = isSimplePropertyRoute(pathname);
  const dock = simple ? SIMPLE_PROPERTY_DOCK : APP_DOCK;
  const active = simple ? simplePropertyDockItemForPath(pathname) : dockItemForPath(pathname);

  return <>
    <div aria-hidden="true" style={{ height: 'calc(72px + env(safe-area-inset-bottom))' }} />
    <nav aria-label="Voxel Vault primary navigation" style={{ ...styles.nav, gridTemplateColumns: `repeat(${dock.length}, minmax(0, 1fr))` }}>
      {dock.map((item) => {
        const selected = item.id === active.id;
        return <Link key={item.id} href={item.href} aria-current={selected ? 'page' : undefined} style={{ ...styles.item, ...(selected ? styles.itemActive : {}) }}>
          <span style={{ ...styles.icon, ...(selected ? styles.iconActive : {}) }}>{item.icon}</span>
          <b style={{ ...styles.label, ...(selected ? styles.labelActive : {}) }}>{item.label}</b>
        </Link>;
      })}
    </nav>
  </>;
}

const styles = {
  nav: {
    position: 'fixed',
    zIndex: 90,
    left: '50%',
    bottom: 'max(8px, env(safe-area-inset-bottom))',
    transform: 'translateX(-50%)',
    width: 'min(490px, calc(100vw - 18px))',
    display: 'grid',
    gap: 3,
    padding: 6,
    boxSizing: 'border-box',
    border: '1px solid rgba(92,73,101,.10)',
    borderRadius: 22,
    background: 'rgba(255,252,247,.92)',
    boxShadow: '0 16px 44px rgba(53,38,62,.16), 0 1px 0 rgba(255,255,255,.96) inset',
    backdropFilter: 'blur(28px)',
    WebkitBackdropFilter: 'blur(28px)',
    fontFamily: 'Inter, ui-rounded, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
  },
  item: {
    minWidth: 0,
    minHeight: 52,
    display: 'grid',
    placeItems: 'center',
    alignContent: 'center',
    gap: 3,
    padding: '5px 3px',
    borderRadius: 16,
    color: '#6f6675',
    textDecoration: 'none',
    border: '1px solid transparent',
    touchAction: 'manipulation',
    transition: 'background .16s ease, color .16s ease, transform .16s ease',
  },
  itemActive: {
    border: '1px solid rgba(111,61,244,.13)',
    background: 'linear-gradient(180deg,rgba(119,70,244,.13),rgba(119,70,244,.08))',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,.8)',
  },
  icon: {
    minWidth: 28,
    height: 25,
    padding: '0 5px',
    borderRadius: 9,
    display: 'grid',
    placeItems: 'center',
    fontSize: 11,
    fontWeight: 1000,
    letterSpacing: '-.04em',
    color: '#796f7d',
    background: 'rgba(105,78,118,.055)',
  },
  iconActive: {
    color: '#3b5211',
    background: '#c9ff54',
    boxShadow: '0 2px 0 rgba(94,128,24,.18)',
  },
  label: { fontSize: 8.5, lineHeight: 1.05, color: '#756d7a', fontWeight: 900 },
  labelActive: { color: '#5e36c8' },
};
