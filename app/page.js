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
          <p className={styles.kicker}>VOXELPOP · HOUSE PHOTO → 3D VOXEL</p>
          <h1>See your house.<br/><em>Then voxelize it.</em></h1>
          <p className={styles.lead}>Try the real 3D interaction first. When you create your own, VoxelPop shows a textured 3D preview from your photo before it builds the separate movable voxel.</p>
          <div className={styles.heroActions}>
            <Link className={styles.primaryAction} href="/property">Create yours · $4.99</Link>
            <Link className={styles.secondaryAction} href="/demo">Try 3D demo</Link>
          </div>
          <div className={styles.trustRow} aria-label="VoxelPop creation facts">
            <span>No login for demo</span><span>Photo stays on device</span><span>No Meshy credits</span>
          </div>
        </div>
        <div className={styles.heroVisual}><HomeProductPreview/></div>
      </section>

      <section className={styles.flowCard} id="how-it-works" aria-label="VoxelPop creation steps">
        <div className={styles.flowIntro}><p>THE CREATION</p><h2>Preview first. Approve. Voxelize.</h2></div>
        <div className={styles.microFlow}><b>PHOTO</b><i>→</i><b>$4.99</b><i>→</i><b>3D PREVIEW</b><i>→</i><b>APPROVE</b><i>→</i><b>VOXEL</b><i>→</i><b>OPTIONAL MINT</b></div>
        <Link className={styles.startButton} href="/property">Create my house voxel →</Link>
      </section>

      <section className={styles.destinationSection}>
        <div className={styles.sectionIntro}><p>AFTER CREATION</p><h2>Your voxel has somewhere to go.</h2><span>World gives it place context. Vault keeps the finished digital item. More keeps secondary tools out of the main journey.</span></div>
        <div className={styles.assetGrid}>
          <Link href="/world" className={`${styles.assetTile} ${styles.worldTile}`}><div className={styles.tileIcon}>◎</div><small>WORLD</small><strong>See it in context</strong><span>Pair a finished voxel with source-backed place and building context.</span><b>Open World →</b></Link>
          <Link href="/vault" className={`${styles.assetTile} ${styles.vaultTile}`}><div className={styles.tileIcon}>◇</div><small>VAULT</small><strong>Keep the result</strong><span>Reopen saved properties, finished voxels, and optional mint actions.</span><b>Open Vault →</b></Link>
          <Link href="/more" className={`${styles.assetTile} ${styles.moreTile}`}><div className={styles.tileIcon}>•••</div><small>MORE</small><strong>Advanced stays separate</strong><span>Sandbox, marketplace, verification, and provider-gated tools live here.</span><b>Open More →</b></Link>
        </div>
      </section>

      <details className={styles.inclusion}>
        <summary><span><small>WHAT'S INCLUDED / WHAT'S NOT</small><b>Clear boundaries without cluttering the hero</b></span><i>+</i></summary>
        <div>
          <p><b>START → SIGN IN + UPLOAD PHOTO.</b> Upload a picture. Nothing is charged or uploaded before account verification.</p>
          <p>After sign-in and the $4.99 creation checkout, VoxelPop shows the textured 3D preview before it builds the separate voxel. <b>One VoxelPop creation costs $4.99.</b></p>
          <p>The source photo stays on your device and the normal creation runs without Meshy credits. Collection and minting remain separate optional actions. No wallet is required to create.</p>
          <p>Optional Collect later is a separate digital-item purchase. A one-photo model does not claim to reconstruct unseen sides or survey-grade dimensions.</p>
          <p><b>Voxel Vault is not a bank.</b> A VoxelPop item is not a deed. The $1.99 property comparison is a sandbox; financial products remain provider-gated. A voxel, NFT, map marker, payment, or Property Passport does not create physical-property ownership, rent, occupancy, investment, or appreciation rights.</p>
        </div>
      </details>

      <footer className={styles.footer}><span>Voxel Vault is a digital creation product. Regulated financial and physical-property rights remain separate provider/legal workflows.</span><span><Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link> · <Link href="/about">About</Link> · <Link href="/demo">3D demo</Link></span></footer>
    </div>
  </main>;
}
