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
          <p className={styles.kicker}>VOXELPOP · ONE HOUSE PHOTO · $4.99</p>
          <h1>Your house photo.<br/><em>Now make it voxel.</em></h1>
          <p className={styles.lead}>Upload one house photo. First, VoxelPop gives you a 3D voxel photo to inspect. Approve it, then build the separate movable 3D voxel. One creation is $4.99.</p>
          <div className={styles.heroActions}>
            <Link className={styles.primaryAction} href="/property">Create my VoxelPop · $4.99</Link>
            <Link className={styles.secondaryAction} href="/demo">Try the sample · no login</Link>
          </div>
          <div className={styles.trustRow} aria-label="VoxelPop creation facts">
            <span>Photo stays on your device</span>
            <span>Review voxel photo first</span>
            <span>No wallet to create</span>
          </div>
        </div>
        <div className={styles.heroVisual}><HomeProductPreview/></div>
      </section>

      <section className={styles.flowCard} id="how-it-works" aria-label="How VoxelPop works">
        <div className={styles.flowHeading}>
          <p>HOW IT WORKS</p>
          <h2>One photo. Four clear steps.</h2>
          <span>You approve the voxel photo before the movable model is created.</span>
        </div>
        <div className={styles.flowSteps}>
          <div><i>1</i><b>Upload photo</b><small>Choose a clear front or three-quarter view.</small></div>
          <div><i>2</i><b>See voxel photo</b><small>Inspect the block-by-block 3D voxel view.</small></div>
          <div><i>3</i><b>Create movable voxel</b><small>Approve the voxel photo, then build the model.</small></div>
          <div><i>4</i><b>SAVE / OPTIONAL MINT</b><small>Keep it in Vault. Mint only if you want.</small></div>
        </div>
        <Link className={styles.startButton} href="/property">Start with my photo →</Link>
      </section>

      <section className={styles.valueSection} aria-label="What you get">
        <div className={styles.sectionTitle}><p>WHAT YOU GET</p><h2>The useful parts, without the clutter.</h2></div>
        <div className={styles.valueGrid}>
          <article><span>01</span><b>3D voxel photo</b><p>A voxelized view tied to the house photo you chose, shown before the final model.</p></article>
          <article><span>02</span><b>Movable 3D voxel</b><p>A separate interactive voxel model you can rotate, save, and reopen.</p></article>
          <article><span>03</span><b>Your Vault</b><p>Your finished creation stays organized in your account. Mint only when you choose to.</p></article>
        </div>
      </section>

      <section className={styles.truthCard}>
        <div><b>Simple on purpose.</b><span>Photo → voxel photo → movable voxel → save.</span></div>
        <p>VoxelPop is a digital creation product. A VoxelPop, map marker, payment, or NFT does not create ownership or financial rights in a physical property, deed, rent, occupancy, investment, or appreciation.</p>
      </section>

      <footer className={styles.footer}>
        <span>VoxelPop by Voxel Vault · digital creations only.</span>
        <span><Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link> · <Link href="/about">About</Link></span>
      </footer>
    </div>
  </main>;
}
