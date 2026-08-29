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

  return (
    <>
      <div aria-hidden="true" style={{ height: 'calc(92px + env(safe-area-inset-bottom))' }} />
      <nav aria-label="Voxel Vault primary navigation" style={{ ...styles.nav, gridTemplateColumns: `repeat(${dock.length}, minmax(0, 1fr))`, ...(simple ? styles.simpleNav : {}) }}>
        {dock.map((item) => {
          const selected = item.id === active.id;
          return (
            <Link key={item.id} href={item.href} aria-current={selected ? 'page' : undefined} style={{ ...styles.item, ...(selected ? styles.itemActive : {}) }}>
              <span style={{ ...styles.icon, ...(selected ? styles.iconActive : {}) }}>{item.icon}</span>
              <b style={{ ...styles.label, ...(selected ? styles.labelActive : {}) }}>{item.label}</b>
              {selected ? <i aria-hidden="true" style={styles.dot} /> : null}
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
    width: 'min(600px, calc(100vw - 16px))', display: 'grid', gap: 4, padding: 6, boxSizing: 'border-box',
    border: '1px solid rgba(83,55,102,.13)', borderRadius: 26,
    background: 'linear-gradient(180deg,rgba(255,255,255,.96),rgba(255,249,240,.94))',
    boxShadow: '0 22px 60px rgba(63,39,78,.22),0 1px 0 #fff inset', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
    fontFamily: 'Inter,ui-rounded,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
  },
  simpleNav: { width: 'min(520px, calc(100vw - 16px))' },
  item: {
    position: 'relative', minWidth: 0, minHeight: 57, display: 'grid', placeItems: 'center', alignContent: 'center', gap: 3, padding: '6px 3px 7px',
    borderRadius: 19, color: '#625968', textDecoration: 'none', border: '1px solid transparent', touchAction: 'manipulation', transition: 'transform .16s ease,background .16s ease',
  },
  itemActive: { border: '1px solid rgba(92,48,218,.15)', background: 'linear-gradient(180deg,#8150ff,#6630e9)', boxShadow: '0 5px 0 #4d1bc5,0 10px 22px rgba(103,54,223,.22)', transform: 'translateY(-2px)' },
  icon: { minWidth: 30, height: 28, padding: '0 7px', borderRadius: 10, display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 1000, letterSpacing: '-.04em', color: '#746a79', background: '#f0eaf3' },
  iconActive: { color: '#344b08', background: '#c9ff54', boxShadow: '0 2px 0 #a7d63f' },
  label: { fontSize: 9, lineHeight: 1.05, color: '#756d7a', whiteSpace: 'nowrap' },
  labelActive: { color: '#fff' },
  dot: { position: 'absolute', bottom: 3, width: 3, height: 3, borderRadius: 99, background: '#c9ff54' },
};
