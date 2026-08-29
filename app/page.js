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
        <p className={styles.kicker}>VOXELPOP · PHOTO → 3D VOXEL PHOTO → MOVABLE VOXEL → NFT</p>
        <h1><em>VOXELPOP</em></h1>
        <p className={styles.heroLine}>One simple flow: choose a property photo, pay once, approve the 3D voxel photo, and VoxelPop builds the separate movable 3D voxel automatically.</p>

        <div className={styles.centerMachine}>
          <div className={styles.machineLabel}><span>●</span> LIVE VOXEL PHOTO SAMPLE</div>
          <HomeProductPreview/>
          <div className={styles.heroActions}>
            <Link className={styles.primaryAction} href="/property">Start VoxelPop · $4.99</Link>
            <Link className={styles.secondaryAction} href="/demo">Try voxel sample · no login</Link>
          </div>
        </div>

        <div className={styles.trustRow} aria-label="VoxelPop creation facts">
          <span>VOXELPOP OUTPUT</span>
          <span>3D voxel photo first</span>
          <span>Movable 3D voxel second</span>
          <span>Optional NFT</span>
          <span>NFT optional</span>
          <span>No wallet until mint</span>
        </div>
      </section>

      <section className={styles.truthCard}>
        <div><b>That is the whole main product.</b><span>Photo → 3D voxel photo → movable 3D voxel → save or optional mint.</span></div>
        <p>VoxelPop is a digital creation product. A VoxelPop, payment, map marker, or NFT does not create ownership, deed/title, rent, occupancy, investment, appreciation, or other rights in a physical property.</p>
      </section>

      <footer className={styles.footer}>
        <span>VoxelPop by Voxel Vault · digital creations only.</span>
        <span><Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link> · <Link href="/about">About</Link></span>
      </footer>
    </div>
  </main>;
}
