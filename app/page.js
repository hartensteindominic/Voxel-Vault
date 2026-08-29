import Link from 'next/link';
import ProductTopNav from './components/ProductTopNav';
import HomeProductPreview from './components/HomeProductPreview';
import styles from './home.module.css';

export const metadata = { alternates: { canonical: '/' } };

const RESULTS = [
  {
    step: '01',
    label: 'FIRST RESULT',
    title: '3D Voxel Photo',
    copy: 'Your house photo is rebuilt block-by-block as a recognizable voxelized 3D view. Rotate it, inspect the depth, and approve it first.',
  },
  {
    step: '02',
    label: 'AFTER YOU APPROVE',
    title: 'Movable 3D Voxel',
    copy: 'VoxelPop turns the approved Voxel Photo into the separate movable model you can rotate, save to Vault, and optionally mint later.',
  },
];

export default function Home() {
  return <main className={styles.page}>
    <ProductTopNav/>
    <div className={styles.shell}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <div className={styles.brandLockup}><span className={styles.brandMark}>V</span><p className={styles.kicker}>VOXELPOP</p><span className={styles.brandTag}>PHOTO → VOXEL</span></div>
          <h1>Your house photo.<br/><em>Made Voxel.</em></h1>
          <p className={styles.lead}>Upload one property photo. Get a recognizable <strong>3D Voxel Photo</strong> first. Approve it, then create the separate movable <strong>3D Voxel Model</strong>.</p>
          <div className={styles.heroActions}>
            <Link className={styles.primaryAction} href="/property">Create my VoxelPop <span>$4.99</span></Link>
            <Link className={styles.secondaryAction} href="/demo">Try free demo</Link>
          </div>
          <div className={styles.trustRow} aria-label="VoxelPop creation facts">
            <span><b>✓</b> Preview before model</span>
            <span><b>✓</b> Photo stays on device</span>
            <span><b>✓</b> Minting optional</span>
          </div>
        </div>
        <div className={styles.heroVisual}><HomeProductPreview/></div>
      </section>

      <section className={styles.resultsSection} aria-labelledby="results-title">
        <div className={styles.sectionHeading}>
          <p>ONE PHOTO · TWO VOXEL RESULTS</p>
          <h2 id="results-title">See it before you build it.</h2>
          <span>No confusing jump from a normal photo straight to a finished model. The Voxel Photo is its own approval step.</span>
        </div>
        <div className={styles.resultsGrid}>
          {RESULTS.map((result, index) => <article className={styles.resultCard} key={result.step}>
            <div className={styles.resultTop}><span>{result.step}</span><small>{result.label}</small></div>
            <h3>{result.title}</h3>
            <p>{result.copy}</p>
            <div className={styles.resultStatus}>{index === 0 ? 'ROTATE · CHECK · APPROVE' : 'MOVE · SAVE · OPTIONAL MINT'}</div>
          </article>)}
        </div>
      </section>

      <section className={styles.purchaseCard} aria-labelledby="purchase-title">
        <div className={styles.purchasePrice}><small>ONE VOXELPOP CREATION</small><strong>$4.99</strong></div>
        <div className={styles.purchaseCopy}>
          <h2 id="purchase-title">Simple from start to finish.</h2>
          <p><b>Photo → 3D Voxel Photo → approve → movable 3D Voxel → Vault.</b> Minting comes later only if you choose it.</p>
        </div>
        <Link className={styles.purchaseAction} href="/property">Start with my photo →</Link>
      </section>

      <details className={styles.inclusion}>
        <summary><span><small>GOOD TO KNOW</small><b>Privacy, accuracy & ownership</b></span><i>+</i></summary>
        <div>
          <p>Your source photo stays on your device in the normal creation flow. One photo can recreate the visible view, but it cannot prove hidden sides, the back, or survey-grade dimensions.</p>
          <p><b>VoxelPop is a digital creation product.</b> A Voxel Photo, movable voxel, NFT, map marker, payment, or Property Passport does not create deed/title, rent, occupancy, investment, appreciation, or other rights in the physical property.</p>
        </div>
      </details>

      <footer className={styles.footer}>
        <span>VoxelPop by Voxel Vault · Turn a property photo into a 3D Voxel Photo and movable voxel.</span>
        <span><Link href="/vault">Vault</Link> · <Link href="/world">World</Link> · <Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link></span>
      </footer>
    </div>
  </main>;
}
