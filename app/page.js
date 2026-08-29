import Link from 'next/link';
import ProductTopNav from './components/ProductTopNav';
import HomeProductPreview from './components/HomeProductPreview';
import styles from './home.module.css';

export const metadata = { alternates: { canonical: '/' } };

const STEPS = [
  ['01', 'PHOTO', 'Choose one clear house photo.'],
  ['02', 'VOXEL PHOTO', 'Inspect the photo rebuilt from real 3D voxels.'],
  ['03', 'MOVABLE VOXEL', 'Approve the look, then build the movable model.'],
  ['04', 'MINT · OPTIONAL', 'Save it first. Mint only when you want to.'],
];

export default function Home() {
  return <main className={styles.page}>
    <ProductTopNav/>
    <div className={styles.shell}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>VOXELPOP · ONE HOUSE PHOTO → VOXEL</p>
          <h1>Your house.<br/><em>Built from voxels.</em></h1>
          <p className={styles.lead}>Upload one photo. First see a real 3D voxel photo made from that image. Approve it. Then create the separate movable 3D voxel. Minting stays optional.</p>
          <div className={styles.heroActions}>
            <Link className={styles.primaryAction} href="/property">Create my VoxelPop · $4.99</Link>
            <Link className={styles.secondaryAction} href="/demo">Open free sample</Link>
          </div>
          <div className={styles.promiseGrid} aria-label="VoxelPop creation facts">
            <span><b>NO WALLET</b><small>needed to create</small></span>
            <span><b>DEVICE-LOCAL</b><small>source photo</small></span>
            <span><b>YOU APPROVE</b><small>before the model</small></span>
          </div>
          <p className={styles.priceNote}>One digital VoxelPop creation costs $4.99. No Meshy credits are required for this creation flow.</p>
        </div>
        <div className={styles.heroVisual}>
          <div className={styles.previewLabel}><span>LIVE PRODUCT SAMPLE</span><b>Drag it. Compare both stages.</b></div>
          <HomeProductPreview/>
        </div>
      </section>

      <section className={styles.journey} id="how-it-works" aria-label="How VoxelPop works">
        <div className={styles.journeyHeading}>
          <p>THE FLOW</p>
          <h2>Nothing hidden. Nothing out of order.</h2>
          <span>Photo → voxel photo → movable voxel → optional mint.</span>
        </div>
        <div className={styles.stepGrid}>
          {STEPS.map(([number, label, copy]) => <article key={number}>
            <span>{number}</span><b>{label}</b><p>{copy}</p>
          </article>)}
        </div>
        <Link className={styles.startButton} href="/property">Start with my house photo →</Link>
      </section>

      <section className={styles.afterBar} aria-label="After VoxelPop creation">
        <div><small>AFTER CREATION</small><b>Your voxel stays useful even if you never mint it.</b></div>
        <nav aria-label="VoxelPop destinations">
          <Link href="/vault">Vault</Link>
          <Link href="/world">World</Link>
          <Link href="/more">More</Link>
        </nav>
      </section>

      <details className={styles.disclosure}>
        <summary><span>What exactly am I buying?</span><i>+</i></summary>
        <div>
          <p>You are buying one digital VoxelPop creation for $4.99. Your source photo stays on your device in the normal creation flow, and no wallet is required to create.</p>
          <p>A single photo can represent the visible view, but it cannot prove hidden sides or survey-grade dimensions. The movable voxel is a digital interpretation of the approved visible photo.</p>
          <p><b>Voxel Vault is not a bank, brokerage, title company, or real-estate marketplace.</b> A VoxelPop item or NFT is not a deed and does not create physical-property ownership, rent, occupancy, investment, or appreciation rights.</p>
        </div>
      </details>

      <footer className={styles.footer}>
        <span>VoxelPop is a digital creation product by Voxel Vault.</span>
        <span><Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link> · <Link href="/about">About</Link></span>
      </footer>
    </div>
  </main>;
}
