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

const DOCK_ORDER = ['home', 'world', 'create', 'vault', 'more'];

function centerVoxelPop(items) {
  return [...items].sort((a, b) => DOCK_ORDER.indexOf(a.id) - DOCK_ORDER.indexOf(b.id));
}

export default function FinancialOSNav() {
  const pathname = usePathname() || '/';
  if (!isOrganizedUserRoute(pathname)) return null;

  // Home and the paid VoxelPop creator have a focused product header. Do not
  // stack a second navigation system underneath those two core surfaces.
  if (pathname === '/' || pathname === '/property') return null;

  const simple = isSimplePropertyRoute(pathname);
  const sourceDock = simple ? SIMPLE_PROPERTY_DOCK.filter((item) => item.id !== 'more') : APP_DOCK;
  const dock = centerVoxelPop(sourceDock);
  const active = simple ? simplePropertyDockItemForPath(pathname) : dockItemForPath(pathname);

  return <>
    <div className={styles.spacer} aria-hidden="true" />
    <nav className={styles.nav} aria-label="Voxel Vault primary navigation" style={{ gridTemplateColumns: `repeat(${dock.length}, minmax(0, 1fr))` }}>
      {dock.map((item) => {
        const selected = item.id === active.id;
        const voxelPop = item.id === 'create';
        const label = voxelPop ? 'VoxelPop' : item.label;
        return <Link
          key={item.id}
          href={item.href}
          aria-label={voxelPop ? 'VoxelPop 3D voxel and optional NFT creator' : undefined}
          aria-current={selected ? 'page' : undefined}
          className={`${styles.item} ${voxelPop ? styles.voxelPopItem : ''} ${selected ? styles.itemActive : ''}`}
        >
          <span className={`${styles.icon} ${voxelPop ? styles.voxelPopIcon : ''} ${selected ? styles.iconActive : ''}`}>{voxelPop ? 'V' : item.icon}</span>
          <b className={`${styles.label} ${voxelPop ? styles.voxelPopLabel : ''} ${selected ? styles.labelActive : ''}`}>{label}</b>
        </Link>;
      })}
    </nav>
  </>;
}
