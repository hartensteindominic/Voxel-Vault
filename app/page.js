import Link from 'next/link';
import ProductTopNav from './components/ProductTopNav';
import HomeProductPreview from './components/HomeProductPreview';
import styles from './home.module.css';

export const metadata = { alternates: { canonical: '/' } };

const STEPS = [
  ['01', 'Choose a photo', 'Use a clear front or three-quarter view of the house.'],
  ['02', 'Review the 3D voxel photo', 'Your photo becomes a block-by-block 3D voxel view you can inspect first.'],
  ['03', 'Create the movable voxel', 'Approve the voxel photo, then build the separate movable 3D voxel.'],
  ['04', 'Save it. Mint only if you want.', 'Your finished voxel goes to Vault. NFT minting stays optional.'],
];

export default function Home() {
  return <main className={styles.page}>
    <ProductTopNav/>

    <div className={styles.shell}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <div className={styles.eyebrow}><span/>VOXELPOP</div>
          <h1>Your house.<br/><em>Rebuilt in voxels.</em></h1>
          <p className={styles.lead}>Upload one house photo. Pay $4.99 once. Review a <b>3D voxel photo that still looks like your house</b>, then approve the separate movable voxel.</p>

          <div className={styles.heroActions}>
            <Link className={styles.primaryAction} href="/property">Create my house <span>→</span></Link>
            <Link className={styles.secondaryAction} href="/demo">Try the free demo</Link>
          </div>

          <div className={styles.facts} aria-label="VoxelPop creation facts">
            <span><b>$4.99</b> one creation</span>
            <span><b>Private</b> source photo stays on device</span>
            <span><b>Optional</b> mint after creation</span>
          </div>
        </div>

        <div className={styles.heroVisual}>
          <HomeProductPreview/>
        </div>
      </section>

      <section className={styles.steps} aria-labelledby="how-title">
        <div className={styles.sectionHeading}>
          <p>HOW IT WORKS</p>
          <h2 id="how-title">One simple creation flow.</h2>
          <span>No map, wallet, or NFT is required to make your voxel.</span>
        </div>
        <div className={styles.stepGrid}>
          {STEPS.map(([number, title, copy]) => <article key={number} className={styles.stepCard}>
            <span>{number}</span>
            <div><h3>{title}</h3><p>{copy}</p></div>
          </article>)}
        </div>
      </section>

      <section className={styles.resultCard}>
        <div>
          <p className={styles.resultKicker}>WHAT YOU GET</p>
          <h2>A finished VoxelPop you can reopen anytime.</h2>
          <p>Your movable voxel is saved to Vault first. From there, you can keep it digital, place it in World, or choose to mint the finished voxel later.</p>
        </div>
        <div className={styles.resultActions}>
          <Link href="/property">Start creating →</Link>
          <Link href="/vault">Open Vault</Link>
        </div>
      </section>

      <footer className={styles.footer}>
        <p>VoxelPop is a digital creation product. A VoxelPop, map marker, payment, or NFT does not create ownership or financial rights in a physical property.</p>
        <span><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/about">About</Link></span>
      </footer>
    </div>
  </main>;
}
