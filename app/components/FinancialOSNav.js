'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const PRIMARY = [
  { href: '/', label: 'Home', icon: 'V' },
  { href: '/geo', label: 'Explore', icon: '◎' },
  { href: '/real-estate/reits', label: 'Invest', icon: '$' },
  { href: '/vault', label: 'Vault', icon: '◇' },
  { href: '/vault/income', label: 'Income', icon: '↗' },
];

const FINANCIAL_PREFIXES = ['/geo', '/real-estate', '/vault', '/admin/digital-reits'];

function activeFor(pathname, href) {
  if (href === '/') return pathname === '/';
  if (href === '/real-estate/reits') {
    return pathname.startsWith('/real-estate/reits') || pathname.startsWith('/real-estate/invest');
  }
  if (href === '/vault') {
    return pathname === '/vault' || pathname.startsWith('/vault/properties') || pathname.startsWith('/vault/estates');
  }
  return pathname.startsWith(href);
}

export default function FinancialOSNav() {
  const pathname = usePathname() || '/';
  const financialRoute = pathname === '/' || FINANCIAL_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  if (!financialRoute) return null;

  return (
    <>
      <div aria-hidden="true" style={{height:'calc(82px + env(safe-area-inset-bottom))'}} />
      <nav aria-label="Voxel Vault financial navigation" style={styles.nav}>
        {PRIMARY.map((item) => {
          const active = activeFor(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              style={{ ...styles.item, ...(active ? styles.itemActive : {}) }}
            >
              <span style={{ ...styles.icon, ...(active ? styles.iconActive : {}) }}>{item.icon}</span>
              <b style={{ ...styles.label, ...(active ? styles.labelActive : {}) }}>{item.label}</b>
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
    background: 'rgba(5,9,8,.92)',
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
    width: 25,
    height: 25,
    borderRadius: 9,
    display: 'grid',
    placeItems: 'center',
    fontSize: 11,
    fontWeight: 950,
    color: 'rgba(255,255,255,.54)',
    background: 'rgba(255,255,255,.045)',
  },
  iconActive: { color: '#07110e', background: '#9ff5df' },
  label: { fontSize: 9, lineHeight: 1.05, color: 'rgba(255,255,255,.58)' },
  labelActive: { color: '#eafff9' },
};
