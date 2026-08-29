'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { isOrganizedUserRoute } from '../../lib/product-map';
import styles from './ProductTopNav.module.css';

const ITEMS = [
  { href: '/property', label: 'Create' },
  { href: '/world', label: 'World' },
  { href: '/vault', label: 'Vault' },
  { href: '/more', label: 'More' },
];

function activeFor(pathname, href) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function ProductTopNav({ className = '' }) {
  const pathname = usePathname() || '/';
  const dockedMobile = isOrganizedUserRoute(pathname);
  return <nav className={`${styles.nav} ${dockedMobile ? styles.mobileDocked : ''} ${className}`.trim()} aria-label="Voxel Vault product navigation">
    <Link className={styles.brand} href="/" aria-label="Voxel Vault home">
      <span className={styles.mark}>V</span>
      <span className={styles.brandText}><b>VOXEL VAULT</b><small>VOXELPOP CREATOR</small></span>
    </Link>
    <div className={styles.links}>
      {ITEMS.map((item) => {
        const active = activeFor(pathname, item.href);
        return <Link key={item.href} className={active ? styles.active : ''} href={item.href} aria-current={active ? 'page' : undefined}>{item.label}</Link>;
      })}
      <Link className={styles.demo} href="/demo" aria-current={pathname === '/demo' ? 'page' : undefined}>Free demo</Link>
    </div>
  </nav>;
}
