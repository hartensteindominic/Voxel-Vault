import Link from 'next/link';
import ConsumerTopNav from './components/ConsumerTopNav';
import HeroProductProof from './HeroProductProof';
import styles from './home.module.css';
import polish from './home-polish.module.css';

export const metadata = { alternates: { canonical: '/' } };

// One public promise: authorized house photo -> $4.99 digital VoxelPop creation.
// Visitors can inspect the real viewer interaction before account/payment friction.
// Paid creation remains account-bound and preserves preview -> approval -> voxel -> optional mint.
// Source photos stay device-local in the normal creation flow and no Meshy credits are required.
// A model, map marker, payment, NFT, demo slice, or Property Passport is never a deed.
export default function Home() {
  return <main className={styles.page}>
    <ConsumerTopNav/>
    <div className={styles.shell}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>VOXELPOP · HOUSE PHOTO → 3D VOXEL</p>
          <h1>Upload a picture.<br/><em>See your house in 3D.</em></h1>
          <p className={styles.lead}>Your photo becomes a recognizable 3D preview first. Approve it, then build the separate movable voxel.</p>
          <div className={styles.heroActions}>
            <Link className={styles.primaryAction} href="/property" data-flow-label="START → SIGN IN + UPLOAD PHOTO">Create my voxel · $4.99</Link>
            <Link className={styles.secondaryAction} href="/demo">See the 3D demo</Link>
          </div>
          <div className={polish.quickFacts} aria-label="VoxelPop creation facts">
            <span><b>1</b> photo</span><span><b>$4.99</b> once</span><span><b>No wallet</b> to create</span>
          </div>
          <details className={polish.heroDetails}>
            <summary>What’s included · privacy + accuracy</summary>
            <p>After sign-in and the $4.99 creation checkout, you inspect the textured 3D preview, approve it, and only then build the voxel. One VoxelPop creation costs $4.99. Your source photo stays on your device and the normal creation flow works without Meshy credits. No wallet is required to create. One photo cannot prove hidden sides or exact survey-grade dimensions.</p>
          </details>
        </div>

        <HeroProductProof/>
      </section>

      <section className={styles.flowCard} id="how-it-works" aria-label="VoxelPop creation steps">
        <div className={styles.flowIntro}><p>HOW IT WORKS</p><h2>See it first. Voxelize it second. Mint last.</h2></div>
        <div className={styles.microFlow}><b>UPLOAD</b><i>→</i><b>$4.99 CREATE</b><i>→</i><b>3D</b><i>→</i><b>VOXEL</b><i>→</i><b>MINT</b></div>
        <Link className={styles.startButton} href="/property">CREATE MY VOXEL →</Link>
        <small>Collection and minting remain separate optional actions. Optional Collect later is a separate digital-item purchase. After the voxel is finished, optional place context can continue through <b>MAP</b> → <b>READY</b>.</small>
      </section>

      <section className={styles.destinationSection}>
        <div className={styles.sectionIntro}><p>WHERE IT GOES</p><h2>One creation. Clear next steps.</h2><span>Try the real viewer interaction, place a finished creation in World, or keep it organized in Vault.</span></div>
        <div className={styles.assetGrid}>
          <Link href="/demo" className={`${styles.assetTile} ${styles.vaultTile}`}><div className={styles.tileIcon}>3D</div><small>PUBLIC DEMO</small><strong>Rotate the sample</strong><span>Switch between textured 3D preview and the separate voxel without Google sign-in.</span><b>See sample →</b></Link>
          <Link href="/world" className={`${styles.assetTile} ${styles.worldTile}`}><div className={styles.tileIcon}>◎</div><small>WORLD</small><strong>Place it in context</strong><span>Finished creations can be paired with source-backed place and building context.</span><b>Open World →</b></Link>
          <Link href="/vault" className={`${styles.assetTile} ${styles.moreTile}`}><div className={styles.tileIcon}>◇</div><small>VAULT</small><strong>Keep the finished voxel</strong><span>Saved property sources and VoxelPop creations stay organized in one understandable collection.</span><b>Open Vault →</b></Link>
        </div>
      </section>

      <section className={styles.truthStrip} id="pricing">
        <div><small>PRICE</small><strong>$4.99 · one digital VoxelPop creation</strong></div><span>+</span><div><small>INCLUDED</small><strong>3D preview → approval → movable voxel</strong></div><Link href="/property">Create mine →</Link>
      </section>

      <section className={styles.truthStrip} id="legal">
        <div><small>DIGITAL</small><strong>Photo → 3D preview → voxel → optional NFT</strong></div><span>≠</span><div><small>PHYSICAL PROPERTY</small><strong>Deed / title / rent / regulated investment rights</strong></div><Link href="/terms">Read terms →</Link>
      </section>

      <footer className={styles.footer}><span>Voxel Vault is a digital creation product. Voxel Vault is not a bank, broker, exchange, custodian, escrow service, or deed registry, and a VoxelPop item is not a deed. The $1.99 property comparison is a sandbox; financial products remain provider-gated.</span><span><Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link> · <Link href="/about">About + contact</Link> · <Link href="/more">More</Link></span></footer>
    </div>
  </main>;
}
