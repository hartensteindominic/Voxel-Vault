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
        <p className={styles.kicker}>HOUSE PHOTO → VOXEL → 3D · $4.99</p>
        <h1><em>VOXELPOP</em></h1>
        <p className={styles.heroLine}>Upload a house. Confirm the address. Get a voxel image, then a mintable 3D voxel.</p>

        <div className={styles.centerMachine}>
          <HomeProductPreview/>
          <Link className={styles.primaryAction} href="/property">Create house voxel · $4.99</Link>
          <p className={styles.microCopy}>Saved to your Voxel Vault · mint when you want</p>
        </div>

        <div className={styles.simpleSteps} aria-label="VoxelPop steps">
          <div><i>1</i><span><b>Photo</b><small>Add one clear house photo.</small></span></div>
          <div><i>2</i><span><b>Address</b><small>Confirm the property once.</small></span></div>
          <div><i>3</i><span><b>Voxel</b><small>Voxel image → movable 3D → Vault.</small></span></div>
        </div>
      </section>

      <section className={styles.truthCard}>
        <div><b>One property. One collectible.</b><span>Duplicate purchase and duplicate mint are blocked.</span></div>
        <p>Digital collectible only. No deed, title, or physical-property rights.</p>
      </section>

      <footer className={styles.footer}>
        <span>VoxelPop</span>
        <span><Link href="/demo">Demo</Link> · <Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link></span>
      </footer>
    </div>
  </main>;
}
