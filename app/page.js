import Link from 'next/link';
import styles from './home.module.css';

export const metadata = { alternates: { canonical: '/' } };

// One public promise: authorized house photo -> $4.99 digital VoxelPop creation.
// Visitors can inspect a built-in no-login demo before account/payment friction.
// Paid creation remains account-bound and preserves preview -> approval -> voxel -> optional mint.
// Source photos stay device-local in the normal creation flow and no Meshy credits are required.
// A model, map marker, payment, NFT, demo slice, or Property Passport is never a deed.
export default function Home() {
  return <main className={styles.page}>
    <div className={styles.shell}>
      <nav className={styles.top}>
        <Link className={styles.brand} href="/" aria-label="Voxel Vault home"><span className={styles.logoMark}><i/><b>+</b></span><span>VOXEL VAULT</span></Link>
        <div className={styles.topLinks}><Link href="/demo">Demo</Link><Link href="/property">Create</Link><Link href="#pricing">Pricing</Link><Link href="#legal">Legal</Link></div>
      </nav>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>VOXELPOP · HOUSE PHOTO → 3D VOXEL</p>
          <h1>Upload a picture.<br/><em>Turn your house into a voxel.</em></h1>
          <p className={styles.lead}>See the product before you sign in. The public sample shows the same two visual stages used for paid creations: a recognizable textured 3D preview first, then a separate movable voxel.</p>
          <div className={styles.heroActions}><Link className={styles.primaryAction} href="/demo">SEE 3D SAMPLE · NO LOGIN</Link><Link className={styles.secondaryAction} href="/property">START → SIGN IN + UPLOAD PHOTO</Link></div>
          <p className={styles.heroFine}>After sign-in and the $4.99 creation checkout, you inspect the 3D preview, approve it, and only then build the voxel. One VoxelPop creation costs $4.99. Your source photo stays on your device and the normal creation flow works without Meshy credits. No wallet is required to create.</p>
        </div>

        <div className={styles.heroVisual} aria-label="VoxelPop property creation preview">
          <div className={styles.visualBadge}>PHOTO → 3D PREVIEW → VOXEL</div>
          <div className={styles.voxelHouse} aria-hidden="true"><div className={styles.roof}/><div className={styles.houseBody}><i/><i/><b/></div><div className={styles.lawn}/></div>
          <div className={styles.priceBubble}><small>ONE CREATION</small><strong>$4.99</strong><span>preview + voxel</span></div>
          <div className={styles.visualNote}>See it first<br/><b>Voxelize it second</b></div>
        </div>
      </section>

      <section className={styles.flowCard} id="how-it-works" aria-label="VoxelPop creation steps">
        <div className={styles.flowIntro}><p>HOW IT WORKS</p><h2>See it first. Voxelize it second. Mint last.</h2></div>
        <div className={styles.microFlow}><b>UPLOAD</b><i>→</i><b>$4.99 CREATE</b><i>→</i><b>3D</b><i>→</i><b>VOXEL</b><i>→</i><b>MINT</b></div>
        <Link className={styles.startButton} href="/demo">TRY THE PUBLIC SAMPLE →</Link>
        <small>Collection and minting remain separate optional actions. Optional Collect later is a separate digital-item purchase. After the voxel is finished, optional place context can continue through <b>MAP</b> → <b>READY</b>. A one-photo creation preserves what is visible in the source image but does not pretend to reconstruct unseen sides or exact survey-grade dimensions.</small>
      </section>

      <section className={styles.destinationSection}>
        <div className={styles.sectionIntro}><p>SEE THE PRODUCT</p><h2>Useful proof before checkout.</h2><span>No fake testimonials are needed to understand the interaction. The built-in sample uses the same production 3D preview and local voxel viewers, while World and Vault show where a finished creation goes next.</span></div>
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
