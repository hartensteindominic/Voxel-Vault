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
        <p className={styles.kicker}>✦ TRY THE $1.99 PROPERTY DEMO ✦</p>
        <h1>Buy a little<br/><em>digital property.</em></h1>
        <p className={styles.lead}>Start with your property value. Pick one property. Tap Buy. That’s it.</p>
        <a className={styles.heroStart} href="#start">START TEST BUY →</a>
        <p className={styles.heroHint}>Uses demo money only.</p>
      </header>

      <div id="start">
        <UnifiedVault />
      </div>

      <section className={styles.previewSection}>
        <div className={styles.previewCopy}>
          <span>AFTER YOU BUY</span>
          <h2>See it as a 3D VoxelPop property.</h2>
          <p>Your digital property can live in the Vault and World first. Minting stays optional.</p>
        </div>
        <section className={styles.previewCard}>
          <PropertyTwinCanvas style={{ width: '100%', height: '100%' }} />
          <span className={styles.previewBadge}>3D PROPERTY</span>
          <div className={styles.previewPrice}><small>DEMO STARTING PRICE</small><b>$1.99</b></div>
        </section>
      </section>

      <footer className={styles.footer}>
        <span>This demo buys a digital property unit, not the physical property or a deed. Live banking, crypto conversion and real investment rights require separate verified providers.</span>
        <Link href="/real-estate/launch">Advanced</Link>
      </footer>
    </main>
  );
}
