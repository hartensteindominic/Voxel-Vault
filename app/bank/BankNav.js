'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './section.module.css';

const ITEMS = [
  ['/bank', 'Overview'],
  ['/bank/cards', 'Cards'],
  ['/bank/transfers', 'Transfers'],
  ['/bank/bills', 'Bills'],
  ['/bank/security', 'Security'],
];

export default function BankNav() {
  const pathname = usePathname() || '/bank';
  return <div className={styles.bankNav}>
    <Link href="/bank" className={styles.bankBrand}><span>✦</span><b>GALACTIC TRUST</b><small>DEMO</small></Link>
    <div className={styles.bankLinks}>{ITEMS.map(([href,label]) => <Link key={href} className={pathname === href ? styles.active : ''} href={href}>{label}</Link>)}</div>
  </div>;
}
