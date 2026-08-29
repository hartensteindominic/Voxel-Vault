'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const VISIBLE_ROOTS = ['/property', '/world', '/vault', '/more', '/demo', '/privacy', '/terms', '/about'];

function shouldShow(pathname) {
  return VISIBLE_ROOTS.some((root) => pathname === root || pathname.startsWith(`${root}/`));
}

export default function ConsumerFooter() {
  const pathname = usePathname() || '/';
  if (!shouldShow(pathname)) return null;

  return <footer className="vvConsumerFooter">
    <div className="vvConsumerFooterInner">
      <div className="vvConsumerFooterBrand">
        <Link href="/">VOXEL VAULT</Link>
        <span>House photo → 3D voxel photo → movable voxel → save or optionally mint.</span>
      </div>
      <nav aria-label="Voxel Vault footer" className="vvConsumerFooterLinks">
        <Link href="/property">Create</Link>
        <Link href="/demo">Demo</Link>
        <Link href="/vault">Vault</Link>
        <Link href="/world">World</Link>
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
        <Link href="/about">About</Link>
      </nav>
      <p className="vvConsumerFooterTruth">VoxelPop creations and NFTs are digital items. They do not create deed/title, rent, occupancy, investment, appreciation, banking, or other rights in physical property.</p>
    </div>
  </footer>;
}
