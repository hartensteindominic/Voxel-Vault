import Link from 'next/link';
import ProductTopNav from './components/ProductTopNav';
import HomeProductPreview from './components/HomeProductPreview';
import styles from './home.module.css';

export const metadata = { alternates: { canonical: '/' } };

export default function Home() {
  return <main className={styles.page}>
    <ProductTopNav/>
    <div className={styles.shell}>
      <section className={styles.hero}>
        <p className={styles.kicker}>VOXELPOP · ONE PHOTO → YOUR VOXEL</p>
        <h1>One photo.<br/><em>One simple flow.</em></h1>
        <p className={styles.heroLine}>Upload a property photo, approve the real 3D voxel photo, and your movable voxel saves automatically.</p>

        <div className={styles.centerMachine}>
          <HomeProductPreview/>
          <div className={styles.heroActions}>
            <Link className={styles.primaryAction} href="/property">Create my VoxelPop · $4.99</Link>
            <Link className={styles.secondaryAction} href="/demo">See a sample first</Link>
          </div>
        </div>

        <div className={styles.trustRow} aria-label="VoxelPop creation facts">
          <span>One photo</span>
          <span>Saved automatically</span>
          <span>No wallet unless you mint</span>
        </div>
      </section>

      <details className={styles.compactDetails}>
        <summary>What do I get?</summary>
        <div className={styles.outputGrid}>
          <article><b>3D voxel photo</b><span>Check the photo-matched voxel look before anything else is built.</span></article>
          <article><b>Movable 3D voxel</b><span>Approve once and VoxelPop builds the separate rotatable voxel automatically.</span></article>
          <article><b>Optional NFT</b><span>Your voxel is already saved. Mint only if you want to.</span></article>
        </div>
        <p className={styles.outputLabel}>VOXELPOP OUTPUT · PHOTO → 3D VOXEL PHOTO → MOVABLE VOXEL → OPTIONAL NFT</p>
      </details>

      <section className={styles.truthCard}>
        <div><b>Simple by default.</b><span>One obvious action per screen. Vault, World, and minting stay out of the way until they matter.</span></div>
        <p>VoxelPop is a digital creation product. A VoxelPop, payment, map marker, or NFT does not create ownership of any physical property or create deed/title, rent, occupancy, investment, appreciation, or other physical-property rights.</p>
      </section>

      <footer className={styles.footer}>
        <span>VoxelPop by Voxel Vault · digital creations only.</span>
        <span><Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link> · <Link href="/about">About</Link></span>
      </footer>
    </div>
  </main>;
}
