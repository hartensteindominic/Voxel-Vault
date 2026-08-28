'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function VaultPortalNav() {
  const pathname = usePathname();
  const inIncomeCenter = pathname?.startsWith('/vault/income');
  const href = inIncomeCenter ? '/vault' : '/vault/income';
  const label = inIncomeCenter ? 'MY VAULT' : 'INCOME CENTER';
  const detail = inIncomeCenter ? 'Return to spatial portfolio' : 'Open spatial payment history';

  return (
    <Link
      href={href}
      aria-label={`${label}: ${detail}`}
      style={{
        position: 'fixed',
        zIndex: 70,
        right: 16,
        bottom: 'max(16px, env(safe-area-inset-bottom))',
        display: 'grid',
        gap: 2,
        minWidth: 170,
        padding: '11px 14px',
        border: '1px solid rgba(185,255,240,.2)',
        borderRadius: 18,
        background: 'rgba(5,8,10,.86)',
        color: '#fff',
        textDecoration: 'none',
        boxShadow: '0 16px 44px rgba(0,0,0,.34)',
        backdropFilter: 'blur(16px)',
      }}
    >
      <span style={{ fontSize: 9, fontWeight: 950, letterSpacing: '.15em', color: '#9ff5df' }}>{label}</span>
      <span style={{ fontSize: 10, color: 'rgba(255,255,255,.52)' }}>{detail} →</span>
    </Link>
  );
}
