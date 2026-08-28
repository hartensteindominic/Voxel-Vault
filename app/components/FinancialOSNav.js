'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const PRIMARY = [
  { href: '/', label: 'Home', icon: 'V', detail: 'Overview' },
  { href: '/geo', label: 'Explore', icon: '◎', detail: 'Real places' },
  { href: '/real-estate/reits', label: 'Invest', icon: '$', detail: 'Provider assets' },
  { href: '/vault', label: 'Vault', icon: '◇', detail: 'My assets' },
  { href: '/vault/income', label: 'Income', icon: '↗', detail: 'Observed payments' },
];

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

export default function FinancialOSNav({ compact = false }) {
  const pathname = usePathname() || '/';

  return (
    <>
      <div aria-label="Voxel Vault financial app status" style={styles.statusRail}>
        <span style={styles.statusBrand}><span style={styles.statusDot} />VOXEL VAULT FINANCIAL OS</span>
        <span style={styles.statusText}>SOURCE-BACKED · PROVIDER-GATED · FAIL-CLOSED</span>
        <Link href="/real-estate/acquire" style={styles.planLink}>Plan direct ownership →</Link>
      </div>

      <nav aria-label="Voxel Vault financial navigation" style={{ ...styles.nav, ...(compact ? styles.compactNav : {}) }}>
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
              <span style={styles.itemText}>
                <b style={{ ...styles.label, ...(active ? styles.labelActive : {}) }}>{item.label}</b>
                <small style={styles.detail}>{item.detail}</small>
              </span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}

const styles = {
  statusRail: {
    position: 'fixed',
    zIndex: 85,
    top: 'max(10px, env(safe-area-inset-top))',
    left: '50%',
    transform: 'translateX(-50%)',
    width: 'min(1100px, calc(100vw - 24px))',
    minHeight: 38,
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '8px 12px',
    border: '1px solid rgba(171,235,212,.14)',
    borderRadius: 16,
    background: 'rgba(7,12,11,.82)',
    color: '#f4f1e8',
    boxShadow: '0 12px 34px rgba(0,0,0,.22)',
    backdropFilter: 'blur(18px)',
    WebkitBackdropFilter: 'blur(18px)',
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
  },
  statusBrand: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    fontSize: 9,
    fontWeight: 950,
    letterSpacing: '.13em',
    whiteSpace: 'nowrap',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    background: '#9ff5df',
    boxShadow: '0 0 16px rgba(159,245,223,.62)',
  },
  statusText: {
    fontSize: 8,
    fontWeight: 900,
    letterSpacing: '.11em',
    color: 'rgba(244,241,232,.48)',
    textAlign: 'center',
  },
  planLink: {
    color: '#dffcf3',
    textDecoration: 'none',
    fontSize: 9,
    fontWeight: 900,
    whiteSpace: 'nowrap',
  },
  nav: {
    position: 'fixed',
    zIndex: 90,
    left: '50%',
    bottom: 'max(12px, env(safe-area-inset-bottom))',
    transform: 'translateX(-50%)',
    width: 'min(620px, calc(100vw - 20px))',
    display: 'grid',
    gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
    gap: 4,
    padding: 6,
    boxSizing: 'border-box',
    border: '1px solid rgba(171,235,212,.16)',
    borderRadius: 22,
    background: 'rgba(5,9,8,.9)',
    boxShadow: '0 18px 50px rgba(0,0,0,.38)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
  },
  compactNav: { width: 'min(560px, calc(100vw - 20px))' },
  item: {
    minWidth: 0,
    minHeight: 50,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    padding: '7px 8px',
    borderRadius: 16,
    color: '#fff',
    textDecoration: 'none',
    border: '1px solid transparent',
  },
  itemActive: {
    border: '1px solid rgba(159,245,223,.18)',
    background: 'linear-gradient(180deg, rgba(159,245,223,.1), rgba(159,245,223,.045))',
  },
  icon: {
    width: 25,
    height: 25,
    flex: '0 0 25px',
    borderRadius: 9,
    display: 'grid',
    placeItems: 'center',
    fontSize: 11,
    fontWeight: 950,
    color: 'rgba(255,255,255,.55)',
    background: 'rgba(255,255,255,.045)',
  },
  iconActive: { color: '#07110e', background: '#9ff5df' },
  itemText: { minWidth: 0, display: 'grid', gap: 1 },
  label: { fontSize: 10, lineHeight: 1.1, color: 'rgba(255,255,255,.72)' },
  labelActive: { color: '#eafff9' },
  detail: { fontSize: 7, lineHeight: 1.15, color: 'rgba(255,255,255,.32)', whiteSpace: 'nowrap' },
};
