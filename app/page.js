import Link from 'next/link';
import ProductTopNav from './components/ProductTopNav';
import HomeProductPreview from './components/HomeProductPreview';
import styles from './home.module.css';

export const metadata = { alternates: { canonical: '/' } };

const STEPS = [
  ['1', 'Add photo', 'Choose a clear front or three-quarter view of the property.'],
  ['2', 'Create · $4.99', 'Sign in, confirm permission, and unlock one VoxelPop creation.'],
  ['3', 'Review in 3D', 'See the recognizable 3D picture first and approve it before voxelizing.'],
  ['4', 'Build voxel', 'Turn the approved view into a separate movable 3D voxel.'],
  ['5', 'Save or mint', 'Keep it in Vault. Minting is optional and can happen later.'],
];

export default function Home() {
  return <main className={styles.page}>
    <ProductTopNav/>
    <div className={styles.shell}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>VOXELPOP · PHOTO TO 3D</p>
          <h1>Turn your house<br/><em>into a 3D voxel.</em></h1>
          <p className={styles.lead}>Start with one photo. See a recognizable 3D preview first. Approve it, then create the separate movable voxel.</p>
          <div className={styles.heroActions}>
            <Link className={styles.primaryAction} href="/property">Create mine · $4.99</Link>
            <Link className={styles.secondaryAction} href="/demo">Try the free 3D demo</Link>
          </div>
          <div className={styles.trustRow} aria-label="VoxelPop creation facts">
            <span>Preview before voxel</span><span>Photo kept on your device</span><span>Minting optional</span>
          </div>
        </div>
        <div className={styles.heroVisual}><HomeProductPreview/></div>
      </section>

      <section className={styles.flowCard} id="how-it-works" aria-labelledby="creation-title">
        <div className={styles.flowIntro}><p>HOW IT WORKS</p><h2 id="creation-title">One clear creation flow.</h2><span>No surprise mint. No property-ownership claim. You approve the 3D preview before the voxel is built.</span></div>
        <div className={styles.stepGrid}>
          {STEPS.map(([number, title, copy]) => <div className={styles.step} key={number}><b>{number}</b><div><strong>{title}</strong><span>{copy}</span></div></div>)}
        </div>
        <Link className={styles.startButton} href="/property">Start with my photo →</Link>
      </section>

      <section className={styles.destinationSection}>
        <div className={styles.sectionIntro}><p>AFTER YOU CREATE</p><h2>Your finished voxel stays useful.</h2><span>Save it first. Add place context or mint only when you want to.</span></div>
        <div className={styles.assetGrid}>
          <Link href="/vault" className={`${styles.assetTile} ${styles.vaultTile}`}><div className={styles.tileIcon}>◇</div><small>VAULT</small><strong>Save your voxel</strong><span>Reopen finished creations and choose optional minting later.</span><b>Open Vault →</b></Link>
          <Link href="/world" className={`${styles.assetTile} ${styles.worldTile}`}><div className={styles.tileIcon}>◎</div><small>WORLD</small><strong>Add place context</strong><span>Pair a finished voxel with mapped building and location context.</span><b>Open World →</b></Link>
          <Link href="/more" className={`${styles.assetTile} ${styles.moreTile}`}><div className={styles.tileIcon}>•••</div><small>MORE</small><strong>Explore extra tools</strong><span>Advanced, sandbox, marketplace, and verification features stay out of the creation flow.</span><b>See More →</b></Link>
        </div>
      </section>

      <details className={styles.inclusion}>
        <summary><span><small>IMPORTANT DETAILS</small><b>What the $4.99 creation includes</b></span><i>+</i></summary>
        <div>
          <p><b>One $4.99 payment unlocks one digital VoxelPop creation:</b> photo → 3D preview → approval → movable voxel. You can save the finished voxel without minting it.</p>
          <p>Your source photo is retained on your device for the normal creation flow. A single-photo result is a visual digital creation and cannot reconstruct hidden sides or prove survey-grade dimensions.</p>
          <p><b>A VoxelPop creation is not the physical property.</b> A voxel, NFT, map marker, payment, or Property Passport does not create deed/title, rent, occupancy, investment, appreciation, or other rights in real property.</p>
        </div>
      </details>

      <footer className={styles.footer}><span>Voxel Vault creates digital 3D items. Physical-property and regulated financial rights remain separate legal/provider workflows.</span><span><Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link> · <Link href="/about">About</Link> · <Link href="/demo">3D demo</Link></span></footer>
    </div>
  </main>;
}
