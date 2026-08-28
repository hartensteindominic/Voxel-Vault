'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function PropertyClaimShortcut() {
  const pathname = usePathname() || '';
  if (pathname.startsWith('/vault/properties/claim')) return null;

  return (
    <Link
      href="/vault/properties/claim"
      className="fixed left-4 z-[69] rounded-full border border-[#9ff5df]/20 bg-[#07100e]/90 px-4 py-2.5 text-[10px] font-black tracking-[.12em] text-[#bffff0] no-underline shadow-xl backdrop-blur-xl md:left-6"
      style={{ bottom: 'max(82px, calc(env(safe-area-inset-bottom) + 82px))' }}
    >
      CLAIM MY PROPERTY
    </Link>
  );
}
