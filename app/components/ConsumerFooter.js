'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const VISIBLE_ROOTS = ['/property', '/world', '/vault', '/more'];

function shouldShow(pathname) {
  return VISIBLE_ROOTS.some((root) => pathname === root || pathname.startsWith(`${root}/`));
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
        <Link href="/about" style={styles.link}>About</Link>
      </nav>
      <p style={styles.truth}>VoxelPop creations, map references, purchases, and NFTs are digital records. They do not create deed/title, rent, occupancy, investment, or appreciation rights in physical property.</p>
    </div>
  </footer>;
}

const styles = {
  footer: {
    padding: '16px 10px calc(88px + env(safe-area-inset-bottom))',
    background: '#fffaf0',
    color: '#6f6672',
    fontFamily: 'Inter, ui-rounded, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  inner: {
    width: 'min(1040px, 100%)',
    margin: '0 auto',
    padding: '18px clamp(14px, 3vw, 24px)',
    border: '1px solid rgba(116,91,126,.11)',
    borderRadius: 21,
    background: 'rgba(255,255,255,.68)',
    boxShadow: '0 10px 28px rgba(68,45,80,.045)',
    display: 'grid',
    gap: 11,
  },
  brandBlock: { display: 'flex', gap: 9, alignItems: 'baseline', flexWrap: 'wrap' },
  brand: { color: '#251b2c', textDecoration: 'none', fontSize: 9, fontWeight: 1000, letterSpacing: '.13em' },
  tagline: { fontSize: 9, fontWeight: 750, color: '#817784' },
  links: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  link: { padding: '7px 9px', borderRadius: 999, background: '#f4effa', color: '#5d3ab7', textDecoration: 'none', fontSize: 8, fontWeight: 900 },
  truth: { margin: 0, maxWidth: 840, fontSize: 7.8, lineHeight: 1.55, color: '#9a9098' },
};
