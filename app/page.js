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
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>VOXELPOP · ONE HOUSE PHOTO → 3D VOXEL PHOTO</p>
          <h1>Your house.<br/><em>Voxelized.</em></h1>
          <p className={styles.lead}>Upload one house photo. VoxelPop turns the visible view into a block-by-block 3D voxel photo you can inspect. Approve it, then build the separate movable voxel.</p>
          <div className={styles.heroActions}>
            <Link className={styles.primaryAction} href="/property">Create mine · $4.99</Link>
            <Link className={styles.secondaryAction} href="/demo">See the free sample</Link>
          </div>
          <div className={styles.trustRow} aria-label="VoxelPop creation facts">
            <span>No wallet to create</span><span>Source photo stays on device</span><span>Minting is optional</span>
          </div>
        </div>
        <div className={styles.heroVisual}><HomeProductPreview/></div>
      </section>

      <section className={styles.flowCard} id="how-it-works" aria-label="VoxelPop creation steps">
        <div className={styles.flowIntro}><p>HOW IT WORKS</p><h2>One photo. Two voxel outputs.</h2></div>
        <div className={styles.microFlow}><b>1 · PHOTO</b><i>→</i><b>2 · 3D VOXEL PHOTO</b><i>→</i><b>3 · APPROVE</b><i>→</i><b>4 · MOVABLE VOXEL</b></div>
        <Link className={styles.startButton} href="/property">Start my VoxelPop →</Link>
      </section>

      <details className={styles.inclusion}>
        <summary><span><small>WHAT YOU GET</small><b>A voxel photo first. A movable voxel after approval.</b></span><i>+</i></summary>
        <div className={styles.afterCreate}>
          <p><b>3D voxel photo:</b> a block-by-block version of the visible house photo with depth you can inspect before continuing.</p>
          <p><b>Movable 3D voxel:</b> the separate model you can rotate, save to Vault, pair with optional World context, or mint later.</p>
          <div className={styles.afterLinks}><Link href="/demo">See the sample →</Link><Link href="/vault">Open Vault →</Link><Link href="/world">Open World →</Link></div>
        </div>
      </details>

      <details className={styles.inclusion}>
        <summary><span><small>IMPORTANT</small><b>$4.99 buys one digital VoxelPop creation</b></span><i>+</i></summary>
        <div>
          <p>Your source photo stays on your device in the normal creation flow. One photo can represent the visible view, but it cannot reconstruct unseen sides or prove survey-grade dimensions.</p>
          <p><b>Voxel Vault is a digital creation product—not a bank, brokerage, title company, or real-estate marketplace.</b> A VoxelPop item, NFT, map marker, payment, or Property Passport does not create physical-property ownership, rent, occupancy, investment, or appreciation rights.</p>
        </div>
      </details>

      <footer className={styles.footer}><span>Voxel Vault makes digital VoxelPop creations from authorized house photos.</span><span><Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link> · <Link href="/about">About</Link></span></footer>
    </div>
  </main>;
}
