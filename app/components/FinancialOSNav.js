'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './FinancialOSNav.module.css';
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

  // Home and the paid VoxelPop creator have a focused product header. Do not
  // stack a second navigation system underneath those two core surfaces.
  if (pathname === '/' || pathname === '/property') return null;

  const simple = isSimplePropertyRoute(pathname);
  const dock = simple ? SIMPLE_PROPERTY_DOCK.filter((item) => item.id !== 'more') : APP_DOCK;
  const active = simple ? simplePropertyDockItemForPath(pathname) : dockItemForPath(pathname);

  return <>
    <div className={styles.spacer} aria-hidden="true" />
    <nav className={styles.nav} aria-label="Voxel Vault primary navigation" style={{ gridTemplateColumns: `repeat(${dock.length}, minmax(0, 1fr))` }}>
      {dock.map((item) => {
        const selected = item.id === active.id;
        return <Link key={item.id} href={item.href} aria-current={selected ? 'page' : undefined} className={`${styles.item} ${selected ? styles.itemActive : ''}`}>
          <span className={`${styles.icon} ${selected ? styles.iconActive : ''}`}>{item.icon}</span>
          <b className={`${styles.label} ${selected ? styles.labelActive : ''}`}>{item.label}</b>
        </Link>;
      })}
    </nav>
  </>;
}
