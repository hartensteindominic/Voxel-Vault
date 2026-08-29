'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const VISIBLE_ROOTS = ['/', '/property', '/world', '/vault', '/more', '/privacy', '/terms'];

function shouldShow(pathname) {
  if (pathname === '/') return true;
  return VISIBLE_ROOTS.slice(1).some((root) => pathname === root || pathname.startsWith(`${root}/`));
}

export default function ConsumerFooter() {
  const pathname = usePathname() || '/';
  if (!shouldShow(pathname)) return null;

  return <footer style={styles.footer}>
    <div style={styles.inner}>
      <div style={styles.brandBlock}>
        <Link href="/" style={styles.brand}>VOXEL VAULT</Link>
        <span style={styles.tagline}>Photo → 3D preview → voxel → optional mint.</span>
      </div>
      <nav aria-label="Voxel Vault footer" style={styles.links}>
        <Link href="/property" style={styles.link}>Create</Link>
        <Link href="/world" style={styles.link}>World</Link>
        <Link href="/vault" style={styles.link}>Vault</Link>
        <Link href="/privacy" style={styles.link}>Privacy</Link>
        <Link href="/terms" style={styles.link}>Terms</Link>
      </nav>
      <p style={styles.truth}>VoxelPop creations, map references, purchases, and NFTs are digital records. They do not create deed/title, rent, occupancy, investment, or appreciation rights in physical property.</p>
    </div>
  </footer>;
}

const styles = {
  footer: {
    padding: '18px 12px calc(106px + env(safe-area-inset-bottom))',
    background: '#fffaf0',
    color: '#6f6672',
    fontFamily: 'Inter, ui-rounded, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  inner: {
    width: 'min(1040px, 100%)',
    margin: '0 auto',
    padding: '22px clamp(16px, 3vw, 28px)',
    border: '1px solid rgba(116, 91, 126, .12)',
    borderRadius: 24,
    background: 'rgba(255,255,255,.72)',
    boxShadow: '0 12px 34px rgba(68, 45, 80, .05)',
    display: 'grid',
    gap: 14,
  },
  brandBlock: { display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' },
  brand: { color: '#251b2c', textDecoration: 'none', fontSize: 10, fontWeight: 1000, letterSpacing: '.13em' },
  tagline: { fontSize: 10, fontWeight: 750, color: '#817784' },
  links: { display: 'flex', flexWrap: 'wrap', gap: 7 },
  link: { padding: '8px 10px', borderRadius: 999, background: '#f4effa', color: '#5d3ab7', textDecoration: 'none', fontSize: 9, fontWeight: 900 },
  truth: { margin: 0, maxWidth: 840, fontSize: 8.5, lineHeight: 1.55, color: '#9a9098' },
};
