'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  APP_DOCK,
  dockItemForPath,
  isOrganizedUserRoute,
  isSimplePropertyRoute,
} from '../../lib/product-map';

const CUTE_CORE_DOCK = Object.freeze([
  { id: 'home', href: '/', label: 'Home', icon: 'V' },
  { id: 'create', href: '/property', label: 'Create', icon: '+' },
  { id: 'world', href: '/world', label: 'World', icon: '◎' },
  { id: 'vault', href: '/vault', label: 'Vault', icon: '◇' },
  { id: 'more', href: '/more', label: 'More', icon: '•••' },
]);

function cuteDockItemForPath(pathname = '/') {
  const path = String(pathname || '/');
  if (path === '/property' || path.startsWith('/property/')) return CUTE_CORE_DOCK[1];
  if (path === '/world' || path.startsWith('/world/') || path.startsWith('/geo/')) return CUTE_CORE_DOCK[2];
  if (path === '/vault' || path.startsWith('/vault/') || path.startsWith('/purchases/') || path.startsWith('/asset/')) return CUTE_CORE_DOCK[3];
  if (path === '/more' || path.startsWith('/more/') || path.startsWith('/real-estate/') || path.startsWith('/marketplace/') || path.startsWith('/ai/') || path.startsWith('/forge/')) return CUTE_CORE_DOCK[4];
  return CUTE_CORE_DOCK[0];
}

export default function FinancialOSNav() {
  const pathname = usePathname() || '/';
  if (!isOrganizedUserRoute(pathname)) return null;

  const simple = isSimplePropertyRoute(pathname);
  const dock = simple ? CUTE_CORE_DOCK : APP_DOCK;
  const active = simple ? cuteDockItemForPath(pathname) : dockItemForPath(pathname);

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
    position: 'fixed', zIndex: 90, left: '50%', bottom: 'max(9px, env(safe-area-inset-bottom))', transform: 'translateX(-50%)',
    width: 'min(590px, calc(100vw - 16px))', display: 'grid', gap: 5, padding: 7, boxSizing: 'border-box',
    border: '1px solid rgba(88,63,102,.11)', borderRadius: 25,
    background: 'rgba(255,252,247,.96)', boxShadow: '0 20px 55px rgba(57,39,67,.18), 0 1px 0 rgba(255,255,255,.9) inset',
    backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
    fontFamily: 'Inter, ui-rounded, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
  },
  simpleNav: { width: 'min(455px, calc(100vw - 16px))' },
  item: {
    minWidth: 0, minHeight: 55, display: 'grid', placeItems: 'center', alignContent: 'center', gap: 3, padding: '6px 4px', borderRadius: 18,
    color: '#2a2030', textDecoration: 'none', border: '1px solid transparent', touchAction: 'manipulation', transition: 'transform .15s ease, background .15s ease',
  },
  itemActive: {
    border: '1px solid rgba(92,48,218,.15)', background: 'linear-gradient(180deg,#8250ff,#6934e8)',
    boxShadow: '0 4px 0 #5022c5, 0 9px 20px rgba(103,54,223,.22)', transform: 'translateY(-1px)',
  },
  icon: {
    minWidth: 29, height: 27, padding: '0 6px', borderRadius: 10, display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 950,
    letterSpacing: '-.04em', color: '#766d7c', background: 'rgba(105,78,118,.065)',
  },
  iconActive: { color: '#30420d', background: '#c9ff54', boxShadow: '0 2px 0 rgba(94,128,24,.25)' },
  label: { fontSize: 9, lineHeight: 1.05, color: '#756d7a', fontWeight: 900 },
  labelActive: { color: '#fff' },
};
