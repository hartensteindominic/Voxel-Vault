'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { APP_DOCK, dockItemForPath, isOrganizedUserRoute } from '../../lib/product-map';

export default function FinancialOSNav() {
  const pathname = usePathname() || '/';
  if (!isOrganizedUserRoute(pathname)) return null;
  const active = dockItemForPath(pathname);

  return (
    <>
      <div aria-hidden="true" style={{ height: 'calc(82px + env(safe-area-inset-bottom))' }} />
      <nav aria-label="Voxel Vault primary navigation" style={styles.nav}>
        {APP_DOCK.map((item) => {
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
    gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
    gap: 4,
    padding: 6,
    boxSizing: 'border-box',
    border: '1px solid rgba(171,235,212,.17)',
    borderRadius: 22,
    background: 'rgba(5,9,8,.93)',
    boxShadow: '0 18px 50px rgba(0,0,0,.38)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
  },
  item: {
    minWidth: 0,
    minHeight: 50,
    display: 'grid',
    placeItems: 'center',
    alignContent: 'center',
    gap: 3,
    padding: '6px 4px',
    borderRadius: 16,
    color: '#fff',
    textDecoration: 'none',
    border: '1px solid transparent',
    touchAction: 'manipulation',
  },
  itemActive: {
    border: '1px solid rgba(159,245,223,.18)',
    background: 'linear-gradient(180deg, rgba(159,245,223,.11), rgba(159,245,223,.045))',
  },
  icon: {
    minWidth: 26,
    height: 25,
    padding: '0 5px',
    borderRadius: 9,
    display: 'grid',
    placeItems: 'center',
    fontSize: 10,
    fontWeight: 950,
    letterSpacing: '-.04em',
    color: 'rgba(255,255,255,.54)',
    background: 'rgba(255,255,255,.045)',
  },
  iconActive: { color: '#07110e', background: '#9ff5df' },
  label: { fontSize: 9, lineHeight: 1.05, color: 'rgba(255,255,255,.58)' },
  labelActive: { color: '#eafff9' },
};
