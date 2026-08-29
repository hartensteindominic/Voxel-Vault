import Link from 'next/link';
import ProductTopNav from './components/ProductTopNav';
import HomeProductPreview from './components/HomeProductPreview';
import styles from './home.module.css';

export const metadata = { alternates: { canonical: '/' } };

const STEPS = [
  ['01', 'Choose your photo', 'Use a clear front or three-quarter house photo. iPhone photos are supported.'],
  ['02', 'Approve the voxel photo', 'After the $4.99 creation payment, inspect the block-by-block 3D voxel photo first.'],
  ['03', 'Build the movable voxel', 'Only after you approve the voxel photo does VoxelPop build the separate movable 3D voxel.'],
  ['04', 'Save it or mint it', 'The finished voxel goes to your Vault. Minting is optional and comes last.'],
];

export default function Home() {
  return <main className={styles.page}>
    <ProductTopNav/>
    <div className={styles.shell}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>VOXELPOP · ONE PHOTO · ONE CLEAR FLOW</p>
          <h1>Your house,<br/><em>voxelized.</em></h1>
          <p className={styles.lead}>Upload a house photo, approve the 3D voxel photo, then create the separate movable 3D voxel. No confusing property purchase. No wallet required to create.</p>
          <div className={styles.heroActions}>
            <Link className={styles.primaryAction} href="/property">Create mine · $4.99</Link>
            <Link className={styles.secondaryAction} href="/demo">Try the free demo</Link>
          </div>
          <div className={styles.trustRow} aria-label="VoxelPop creation facts">
            <span>Voxel photo first</span><span>Photo stays on device</span><span>Minting optional</span>
          </div>
        </div>
        <div className={styles.heroVisual}><HomeProductPreview/></div>
      </section>

      <section className={styles.steps} id="how-it-works" aria-label="How VoxelPop works">
        <div className={styles.sectionHeading}>
          <p>HOW IT WORKS</p>
          <h2>Nothing hidden. Nothing out of order.</h2>
          <span>The photo, voxel photo, movable voxel, and optional mint are separate steps on purpose.</span>
        </div>
        <div className={styles.stepGrid}>
          {STEPS.map(([number, title, copy]) => <article key={number} className={styles.stepCard}>
            <small>{number}</small><b>{title}</b><p>{copy}</p>
          </article>)}
        </div>
      </section>

      <section className={styles.clarityCard}>
        <div>
          <small>WHAT $4.99 BUYS</small>
          <h2>One digital VoxelPop creation.</h2>
          <p>It does not buy the physical house, deed, rent, occupancy, an investment, or guaranteed value. The source photo represents the visible view; one image cannot prove hidden sides or exact survey dimensions.</p>
        </div>
        <Link href="/property">Start with my photo →</Link>
      </section>

      <footer className={styles.footer}>
        <span>Voxel Vault · digital VoxelPop creation</span>
        <span><Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link> · <Link href="/about">About</Link></span>
      </footer>
    </div>
  </main>;
}
