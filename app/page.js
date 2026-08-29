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
        <p className={styles.kicker}>PHOTO → VOXEL · $4.99</p>
        <h1><em>VOXELPOP</em></h1>
        <p className={styles.heroLine}>Photo in. Voxel out. Approve the 3D match, then rotate your voxel.</p>

        <div className={styles.centerMachine}>
          <HomeProductPreview/>
          <Link className={styles.primaryAction} href="/property">Create · $4.99</Link>
          <p className={styles.microCopy}>Saved to Vault · mint optional</p>
        </div>

        <div className={styles.simpleSteps} aria-label="VoxelPop steps">
          <div><i>1</i><span><b>Photo</b><small>One clear house shot.</small></span></div>
          <div><i>2</i><span><b>Approve</b><small>Check the 3D voxel photo.</small></span></div>
          <div><i>3</i><span><b>Done</b><small>Rotate. Saved to Vault.</small></span></div>
        </div>
      </section>

      <section className={styles.truthCard}>
        <div><b>Digital only.</b><span>Photo → review → voxel → Vault.</span></div>
        <p>No deed, title, or physical-property rights.</p>
      </section>

      <footer className={styles.footer}>
        <span>VoxelPop</span>
        <span><Link href="/demo">Demo</Link> · <Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link></span>
      </footer>
    </div>
  </main>;
}
