'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { isOrganizedUserRoute } from '../../lib/product-map';
import styles from './ProductTopNav.module.css';

const ITEMS = [
  { href: '/property', label: 'Create' },
  { href: '/vault', label: 'Inventory' },
];

function activeFor(pathname, href) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function ProductTopNav({ className = '' }) {
  const pathname = usePathname() || '/';
  const focusedFunnel = pathname === '/' || pathname === '/property';
  const dockedMobile = isOrganizedUserRoute(pathname) && !focusedFunnel;

  return <nav className={`${styles.nav} ${focusedFunnel ? styles.focusedFunnel : ''} ${dockedMobile ? styles.mobileDocked : ''} ${className}`.trim()} aria-label="Voxel Vault product navigation">
    <Link className={styles.brand} href="/" aria-label="Voxel Vault home">
      <span className={styles.mark}>V</span><b>VOXEL VAULT</b>
    </Link>
    <div className={styles.links}>
      {ITEMS.map((item) => {
        const active = activeFor(pathname, item.href);
        return <Link key={item.href} className={active ? styles.active : ''} href={item.href} aria-current={active ? 'page' : undefined}>{item.label}</Link>;
      })}
    </div>
  </nav>;
}
