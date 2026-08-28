'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const destinations = [
  { href: '/vault', label: 'MY VAULT', detail: 'Portfolio' },
  { href: '/vault/earth', label: 'EARTH', detail: 'Real Properties' },
  { href: '/vault/estates/mine', label: 'TWINS', detail: 'My Backups' },
  { href: '/vault/income', label: 'INCOME', detail: 'Payments' },
  { href: '/vault/acquisitions', label: 'ACQUIRE', detail: 'Research' },
];

export default function VaultPortalNav() {
  const pathname = usePathname() || '/vault';

  return (
    <nav
      aria-label="Spatial Vault rooms"
      style={{
        position: 'fixed',
        zIndex: 70,
        right: 16,
        bottom: 'max(16px, env(safe-area-inset-bottom))',
        display: 'flex',
        gap: 5,
        padding: 6,
        maxWidth: 'calc(100vw - 32px)',
        overflowX: 'auto',
        border: '1px solid rgba(185,255,240,.16)',
        borderRadius: 20,
        background: 'rgba(5,8,10,.88)',
        boxShadow: '0 16px 44px rgba(0,0,0,.34)',
        backdropFilter: 'blur(16px)',
      }}
    >
      {destinations.map((destination) => {
        const active = destination.href === '/vault'
          ? pathname === '/vault'
          : pathname.startsWith(destination.href);
        return (
          <Link
            key={destination.href}
            href={destination.href}
            aria-current={active ? 'page' : undefined}
            style={{
              display: 'grid',
              flex: '0 0 auto',
              gap: 1,
              minWidth: 72,
              padding: '8px 10px',
              border: active ? '1px solid rgba(185,255,240,.24)' : '1px solid transparent',
              borderRadius: 14,
              background: active ? 'rgba(159,245,223,.09)' : 'transparent',
              color: '#fff',
              textDecoration: 'none',
            }}
          >
            <span style={{ fontSize: 8, fontWeight: 950, letterSpacing: '.11em', color: active ? '#9ff5df' : 'rgba(255,255,255,.55)' }}>{destination.label}</span>
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,.34)' }}>{destination.detail}</span>
          </Link>
        );
      })}
    </nav>
  );
}
