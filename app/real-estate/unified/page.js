import Link from 'next/link';
import PropertyTwinCanvas from '../PropertyTwinCanvas';
import UnifiedVault from './UnifiedVault';
import styles from './unified.module.css';

export const metadata = {
  title: 'Little Property Vault | Voxel Vault',
  description: 'VoxelPop-style sandbox for digital property units, USD, crypto and optional NFTs.',
};

export default function UnifiedPropertyWalletPage() {
  return (
    <main className={styles.page}>
      <nav className={styles.top}>
        <Link className={styles.brand} href="/">VOXEL VAULT</Link>
        <div className={styles.topLinks}>
          <Link href="/property">Create</Link>
          <Link href="/vault">Vault</Link>
          <Link href="/world">World</Link>
        </div>
      </nav>

      <header className={styles.hero}>
        <p className={styles.kicker}>✦ PROPERTY → $1.99 → YOUR VAULT ✦</p>
        <h1>One property.<br/><em>One little vault.</em></h1>
        <p className={styles.lead}>Pick a property, test-buy its digital Voxel for a tiny price, then keep property, dollars, crypto and optional NFTs together.</p>
      </header>

      <section className={styles.previewCard}>
        <PropertyTwinCanvas style={{ width: '100%', height: '100%' }} />
        <span className={styles.previewBadge}>3D PROPERTY</span>
        <div className={styles.previewPrice}><small>STARTING TEST PRICE</small><b>$1.99</b></div>
      </section>

      <UnifiedVault />

      <footer className={styles.footer}>
        <span>This is a sandbox digital-property experience. A digital unit or NFT is not a deed, rent right, bank deposit or real-estate investment by itself.</span>
        <Link href="/real-estate/launch">Advanced</Link>
      </footer>
    </main>
  );
}
