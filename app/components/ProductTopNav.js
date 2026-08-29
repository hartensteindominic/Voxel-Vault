'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './ProductTopNav.module.css';

const ITEMS = [
  { href: '/property', label: 'Create' },
  { href: '/vault', label: 'Vault' },
];

function activeFor(pathname, href) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function ProductTopNav({ className = '' }) {
  const pathname = usePathname() || '/';
  return <nav className={`${styles.nav} ${className}`.trim()} aria-label="Voxel Vault product navigation">
    <Link className={styles.brand} href="/" aria-label="Voxel Vault home">
      <span className={styles.mark}>V</span><b>VOXEL VAULT</b>
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
