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
        <span>Photo → 3D voxel photo → movable voxel → optional mint.</span>
      </div>
      <nav aria-label="Voxel Vault footer" className="vvConsumerFooterLinks">
        <Link href="/property">Create</Link>
        <Link href="/world">World</Link>
        <Link href="/vault">Vault</Link>
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
        <Link href="/about">About</Link>
      </nav>
      <p className="vvConsumerFooterTruth">VoxelPop creations, map references, purchases, and NFTs are digital records. They do not create deed/title, rent, occupancy, investment, or appreciation rights in physical property.</p>
    </div>
  </footer>;
}
