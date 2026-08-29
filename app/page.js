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
        <p className={styles.kicker}>VOXELPOP · ONE PHOTO · ONE SIMPLE FLOW</p>
        <h1><em>HOUSE → VOXEL.</em></h1>
        <p className={styles.heroLine}>Choose a photo. Pay once. Approve the 3D voxel photo. Your movable voxel is built and saved automatically.</p>

        <div className={styles.centerMachine}>
          <div className={styles.machineLabel}><span>●</span> VOXELPOP</div>
          <HomeProductPreview/>
          <div className={styles.heroActions}>
            <Link className={styles.primaryAction} href="/property">Create my VoxelPop · $4.99</Link>
            <Link className={styles.secondaryAction} href="/demo">See the 3D sample</Link>
          </div>
        </div>

        <div className={styles.trustRow} aria-label="VoxelPop creation facts">
          <span>1 photo</span>
          <span>$4.99 once</span>
          <span>Saved automatically</span>
          <span>Mint optional</span>
        </div>
      </section>

      <section className={styles.flowCard} id="how-it-works" aria-label="How VoxelPop works">
        <div className={styles.flowHeading}>
          <p>ONE SIMPLE FLOW</p>
          <h2>Photo → approve → done.</h2>
          <span>VoxelPop keeps the technical steps in the background so each screen has one obvious next action.</span>
        </div>
        <div className={styles.flowSteps} style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <div><i>1</i><b>Choose photo</b><small>Use a clear house photo.</small></div>
          <div><i>2</i><b>Approve voxel photo</b><small>Confirm the photo-matched 3D voxel view looks right.</small></div>
          <div><i>3</i><b>Done</b><small>Your movable 3D voxel is built and saved to Vault. Mint only if you want.</small></div>
        </div>
        <Link className={styles.startButton} href="/property">Start →</Link>
      </section>

      <section className={styles.truthCard}>
        <div><b>One photo. One purchase. One finished voxel.</b><span>3D voxel photo approval stays separate from the final movable voxel so you can check the likeness first.</span></div>
        <p>VoxelPop is a digital creation product. A VoxelPop, payment, map marker, or NFT does not create ownership or other rights in a physical property.</p>
      </section>

      <footer className={styles.footer}>
        <span>VoxelPop by Voxel Vault · digital creations only.</span>
        <span><Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link> · <Link href="/about">About</Link></span>
      </footer>
    </div>
  </main>;
}
