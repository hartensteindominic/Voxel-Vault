'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './ProductTopNav.module.css';

const ITEMS = [
  { href: '/property', label: 'Create · $4.99', featured: true },
  { href: '/demo', label: 'Demo' },
  { href: '/vault', label: 'Vault' },
  { href: '/world', label: 'World' },
];

function activeFor(pathname, href) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function ProductTopNav({ className = '' }) {
  const pathname = usePathname() || '/';
  return <nav className={`${styles.nav} ${className}`.trim()} aria-label="Voxel Vault navigation">
    <Link className={styles.brand} href="/" aria-label="Voxel Vault home">
      <span className={styles.mark}>V</span>
      <span className={styles.brandCopy}><b>VOXEL VAULT</b><small>VOXELPOP</small></span>
    </Link>
    <div className={styles.links}>
      {ITEMS.map((item) => {
        const active = activeFor(pathname, item.href);
        const classes = [active ? styles.active : '', item.featured ? styles.featured : ''].filter(Boolean).join(' ');
        return <Link key={item.href} className={classes} href={item.href} aria-current={active ? 'page' : undefined}>{item.label}</Link>;
      })}
    </div>
  </nav>;
}
