'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './FinancialOSNav.module.css';
import { isOrganizedUserRoute } from '../../lib/product-map';

const DOCK = [
  { id: 'home', href: '/', icon: '⌂', label: 'Home' },
  { id: 'create', href: '/property', icon: 'V', label: 'VoxelPop' },
  { id: 'vault', href: '/vault', icon: '▣', label: 'Vault' },
];

function activeDockItem(pathname) {
  if (pathname === '/property' || pathname.startsWith('/property/')) return 'create';
  if (pathname === '/vault' || pathname.startsWith('/vault/') || pathname === '/world' || pathname.startsWith('/world/')) return 'vault';
  return 'home';
}

function usesPropertyStudioNavigation(pathname) {
  return pathname === '/'
    || pathname === '/property'
    || pathname.startsWith('/property/')
    || pathname === '/vault/property-drafts'
    || pathname.startsWith('/vault/property-drafts/');
}

export default function FinancialOSNav() {
  const pathname = usePathname() || '/';
  if (!isOrganizedUserRoute(pathname)) return null;

  // The focused property studio, mint and inventory pages provide their own consistent navigation.
  if (usesPropertyStudioNavigation(pathname)) return null;

  const active = activeDockItem(pathname);

  return <>
    <div className={styles.spacer} aria-hidden="true" />
    <nav className={styles.nav} aria-label="VoxelPop primary navigation" style={{ gridTemplateColumns: `repeat(${DOCK.length}, minmax(0, 1fr))` }}>
      {DOCK.map((item) => {
        const selected = item.id === active;
        const voxelPop = item.id === 'create';
        return <Link
          key={item.id}
          href={item.href}
          aria-label={voxelPop ? 'Create a VoxelPop' : undefined}
          aria-current={selected ? 'page' : undefined}
          className={`${styles.item} ${voxelPop ? styles.voxelPopItem : ''} ${selected ? styles.itemActive : ''}`}
        >
          <span className={`${styles.icon} ${voxelPop ? styles.voxelPopIcon : ''} ${selected ? styles.iconActive : ''}`}>{item.icon}</span>
          <b className={`${styles.label} ${voxelPop ? styles.voxelPopLabel : ''} ${selected ? styles.labelActive : ''}`}>{item.label}</b>
        </Link>;
      })}
    </nav>
  </>;
}
