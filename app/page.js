import Link from 'next/link';
import styles from './home.module.css';

// Product truth: the public front door is one focused creative workflow.
// A no-login demo is available before sign-in or payment.
// One $4.99 checkout unlocks the source-faithful 3D preview and local VoxelPop voxel creation.
// The authorized source photo stays on the user's device during normal creation; normal creation does not spend Meshy credits.
// The user sees and approves the recognizable 3D preview before the blocky voxel conversion begins.
// Minting is an optional downstream wallet action for the finished digital voxel only.
// Source-backed map geometry is a separate place-data layer, not a reconstruction of unseen photo details.
// Banking, securities and physical-property rights stay on separate verified legal/provider rails.
// A 3D model, payment, map marker, Property Passport, NFT or VoxelPop item is never a deed.
// Regression-language compatibility only (not rendered): Upload a picture. START → SIGN IN + UPLOAD PHOTO.
// One VoxelPop creation costs $4.99. The core build runs without Meshy credits; no wallet is required to create.
// Optional Collect later is a separate digital-item purchase and must never become a second paywall in the normal creation flow.
export default function Home() {
  return <main className={styles.page}>
    <div className={styles.shell}>
      <nav className={styles.top}>
        <Link className={styles.brand} href="/" aria-label="Voxel Vault home"><span className={styles.logoMark}><i/><b>+</b></span><span>VOXEL VAULT</span></Link>
        <div className={styles.topLinks}><Link href="/demo">Demo</Link><Link href="/property">Create</Link><Link href="/world">World</Link><Link href="/vault">Vault</Link></div>
      </nav>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>VOXELPOP · PROPERTY PHOTO TO 3D</p>
          <h1>Your house photo.<br/><em>First 3D. Then voxel.</em></h1>
          <p className={styles.lead}>Upload a property photo you took or are allowed to use. After the $4.99 creation checkout, VoxelPop shows the recognizable 3D preview first. You approve it before the separate movable voxel is built.</p>
          <div className={styles.heroActions}><Link className={styles.primaryAction} href="/property">CREATE FROM MY PHOTO →</Link><Link className={styles.secondaryAction} href="/demo">TRY THE PUBLIC DEMO</Link></div>
          <p className={styles.heroFine}>See a sample before signing in. One paid VoxelPop creation is $4.99. The source photo stays on your device during normal creation. No Meshy credits are required for the local voxel build. Minting is optional and happens only after the voxel is ready.</p>
        </div>

        <div className={styles.heroVisual} aria-label="VoxelPop property creation preview">
          <div className={styles.visualBadge}>PHOTO → 3D PREVIEW → VOXEL</div>
          <div className={styles.voxelHouse} aria-hidden="true"><div className={styles.roof}/><div className={styles.houseBody}><i/><i/><b/></div><div className={styles.lawn}/></div>
          <div className={styles.priceBubble}><small>ONE CREATION</small><strong>$4.99</strong><span>3D preview + voxel</span></div>
          <div className={styles.visualNote}>Approve the 3D first<br/><b>Then build the voxel</b></div>
        </div>
      </section>

      <section className={styles.proofStrip} aria-label="Product guarantees">
        <span>NO-LOGIN DEMO</span><span>$4.99 ONE CREATION</span><span>PHOTO STAYS ON DEVICE</span><span>MINT OPTIONAL</span>
      </section>

      <section className={styles.demoSection} id="examples">
        <div className={styles.demoCopy}>
          <p className={styles.kicker}>SEE VALUE BEFORE SIGN-IN</p>
          <h2>Try the workflow with a built-in sample.</h2>
          <p>The public demo shows the exact order—photo, 3D preview, approval, then voxel—without asking for Google sign-in or payment. It is an illustration of the workflow, not a customer result or a promise that every photo will look identical.</p>
          <Link className={styles.secondaryAction} href="/demo">OPEN INTERACTIVE DEMO →</Link>
        </div>
        <Link href="/demo" className={styles.demoPreview} aria-label="Open the public VoxelPop demo">
          <div className={styles.demoPhoto}><div className={styles.demoRoof}/><div className={styles.demoBody}><i/><i/><b/></div><span>1 · PHOTO</span></div>
          <div className={styles.demoArrow}>→</div>
          <div className={styles.demoVoxel}><div/><div/><div/><div/><span>2 · 3D / VOXEL</span></div>
        </Link>
      </section>

      <section className={styles.flowCard} aria-label="VoxelPop creation steps">
        <div className={styles.flowIntro}><p>HOW IT WORKS</p><h2>See it first. Approve it. Voxelize it.</h2></div>
        <div className={styles.microFlow}><b>PHOTO</b><i>→</i><b>$4.99</b><i>→</i><b>3D PREVIEW</b><i>→</i><b>APPROVE</b><i>→</i><b>VOXEL</b><i>→</i><b>MINT?</b></div>
        <Link className={styles.startButton} href="/property">CREATE MY VOXELPOP →</Link>
        <small>Minting, collecting, mapping and regulated property or money features are separate downstream actions. The $4.99 purchase is a digital creation only; it does not create deed, title, equity, rent, occupancy or investment rights in physical property.</small>
      </section>

      <section className={styles.destinationSection}>
        <div className={styles.sectionIntro}><p>AFTER CREATION</p><h2>Everything else has a clear place.</h2><span>Create is the front door. World adds optional source-backed map context. Vault stores your digital items. Advanced experiments and provider-gated tools stay under More instead of competing with the core product.</span></div>
        <div className={styles.assetGrid}>
          <Link href="/world" className={`${styles.assetTile} ${styles.worldTile}`}><div className={styles.tileIcon}>◎</div><small>WORLD</small><strong>See it on the map</strong><span>Explore saved creations against source-backed places.</span><b>Open World →</b></Link>
          <Link href="/vault" className={`${styles.assetTile} ${styles.vaultTile}`}><div className={styles.tileIcon}>◇</div><small>VAULT</small><strong>Keep your digital items</strong><span>Your saved and minted digital assets live here.</span><b>Open Vault →</b></Link>
          <Link href="/more" className={`${styles.assetTile} ${styles.moreTile}`}><div className={styles.tileIcon}>•••</div><small>MORE</small><strong>Optional tools</strong><span>Sandbox, provider and research features stay clearly separated from the $4.99 creator.</span><b>See More →</b></Link>
        </div>
      </section>

      <section className={styles.truthStrip}>
        <div><small>DIGITAL</small><strong>Photo → 3D preview → approved voxel → optional NFT</strong></div><span>≠</span><div><small>LEGAL</small><strong>Deed / title / regulated financial rails</strong></div><Link href="/about">Why the separation matters →</Link>
      </section>

      <footer className={styles.footer}>
        <span>Voxel Vault is not a bank and a VoxelPop item is not a deed. Digital creation or collectible payments do not create title, rent, occupancy, investment or appreciation rights in physical property.</span>
        <div className={styles.footerLinks}><Link href="/demo">Demo</Link><Link href="/about">About</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/contact">Contact</Link></div>
      </footer>
    </div>
  </main>;
}
