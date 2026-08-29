'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ROOTS = ['/', '/demo', '/property', '/world', '/vault', '/more', '/about', '/privacy', '/terms'];

function visibleOn(pathname) {
  if (pathname === '/') return true;
  return ROOTS.slice(1).some((root) => pathname === root || pathname.startsWith(`${root}/`));
}

function activeFor(pathname, href) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function ConsumerHeader() {
  const pathname = usePathname() || '/';
  if (!visibleOn(pathname)) return null;

  const core = [
    { href: '/', label: 'Home' },
    { href: '/property', label: 'Create' },
    { href: '/world', label: 'World' },
    { href: '/vault', label: 'Vault' },
    { href: '/more', label: 'More' },
  ];

  return <header className="vvConsumerHeader">
    <div className="vvConsumerHeaderInner">
      <Link className="vvConsumerBrand" href="/" aria-label="Voxel Vault home">
        <span className="vvConsumerBrandMark" aria-hidden="true">V</span>
        <span>VOXEL VAULT</span>
      </Link>
      <nav className="vvConsumerHeaderLinks" aria-label="Voxel Vault primary navigation">
        {core.map((item) => <Link key={item.href} href={item.href} aria-current={activeFor(pathname, item.href) ? 'page' : undefined}>{item.label}</Link>)}
      </nav>
      <Link className="vvConsumerDemoLink" href="/demo" aria-current={activeFor(pathname, '/demo') ? 'page' : undefined}>Try 3D demo</Link>
    </div>
  </header>;
}
