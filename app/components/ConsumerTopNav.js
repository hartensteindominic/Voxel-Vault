'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './consumer-top-nav.module.css';

const core = [
  { href: '/property', label: 'Create', id: 'create' },
  { href: '/world', label: 'World', id: 'world' },
  { href: '/vault', label: 'Vault', id: 'vault' },
  { href: '/more', label: 'More', id: 'more' },
];

function activeId(pathname) {
  if (pathname === '/property' || pathname.startsWith('/property/')) return 'create';
  if (pathname === '/world' || pathname.startsWith('/world/')) return 'world';
  if (pathname === '/vault' || pathname.startsWith('/vault/')) return 'vault';
  if (pathname === '/more' || pathname.startsWith('/more/')) return 'more';
  return '';
}

export default function ConsumerTopNav({ className = '' }) {
  const pathname = usePathname() || '/';
  const active = activeId(pathname);
  return <nav className={`${styles.nav} ${className}`.trim()} aria-label="Voxel Vault page navigation">
    <Link className={styles.brand} href="/" aria-label="Voxel Vault home">
      <span className={styles.mark}>V</span>
      <span className={styles.wordmark}>VOXEL VAULT</span>
    </Link>
    <div className={styles.links}>
      {core.map((item) => <Link key={item.id} href={item.href} aria-current={active === item.id ? 'page' : undefined} className={active === item.id ? styles.active : ''}>{item.label}</Link>)}
    </div>
    <Link className={styles.demo} href="/demo">3D Demo</Link>
  </nav>;
}
