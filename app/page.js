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
        <p className={styles.kicker}>HOUSE PHOTO → VOXEL → MINT</p>
        <h1><em>VOXEL VAULT</em></h1>
        <p className={styles.heroLine}>Take a house photo, confirm the address, and Voxel Vault turns it into a collectible 3D voxel.</p>

        <div className={styles.centerMachine}>
          <HomeProductPreview/>
          <Link className={styles.primaryAction} href="/property">Create house voxel</Link>
          <p className={styles.microCopy}>Saved to Inventory · mint when ready</p>
        </div>

        <div className={styles.simpleSteps} aria-label="House voxel steps">
          <div><i>1</i><span><b>Photo</b><small>Take or upload one house shot.</small></span></div>
          <div><i>2</i><span><b>Address</b><small>Confirm the real building.</small></span></div>
          <div><i>3</i><span><b>Voxel</b><small>Built, saved, ready to mint.</small></span></div>
        </div>
      </section>

      <section className={styles.truthCard}>
        <div><b>One property. One collectible.</b><span>Photo → address → voxel image → 3D voxel → Inventory.</span></div>
        <p>The collectible is digital and does not represent deed, title, or physical-property rights.</p>
      </section>

      <footer className={styles.footer}>
        <span>Voxel Vault</span>
        <span><Link href="/demo">Demo</Link> · <Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link></span>
      </footer>
    </div>
  </main>;
}
