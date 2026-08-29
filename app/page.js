import Link from 'next/link';
import styles from './home.module.css';

// One consumer promise everywhere: authorized house photo -> 3D preview -> movable voxel -> optional mint.
// The public demo is synthetic and requires no account. Real creation requires sign-in and one $4.99 checkout.
// The normal property flow keeps the source photo device-local and does not require Meshy credits.
// A visual model, map record, payment, NFT or wallet record never creates physical-property title or investment rights.
export default function Home() {
  return <main className={styles.page}>
    <div className={styles.shell}>
      <nav className={styles.top}>
        <Link className={styles.brand} href="/" aria-label="Voxel Vault home"><span className={styles.logoMark}><i/><b>+</b></span><span>VOXEL VAULT</span></Link>
        <div className={styles.topLinks}><Link href="/demo">Demo</Link><Link href="/property">Create</Link><Link href="/world">World</Link><Link href="/vault">Vault</Link></div>
      </nav>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>PHOTO → 3D PREVIEW → VOXEL</p>
          <h1>See your house in 3D.<br/><em>Then make the voxel.</em></h1>
          <p className={styles.lead}>Try the sample without an account. When you are ready, sign in, upload a photo you may use, pay $4.99 once, review the 3D preview, and continue to the movable voxel.</p>
          <div className={styles.heroActions}><Link className={styles.primaryAction} href="/demo">TRY 3D DEMO · NO SIGN-IN</Link><Link className={styles.secondaryAction} href="/property">CREATE MINE · $4.99</Link></div>
          <p className={styles.heroFine}>The normal property flow keeps your source photo on your device and does not require Meshy credits. Minting is optional and comes after the digital voxel is ready.</p>
        </div>

        <div className={styles.heroVisual} aria-label="VoxelPop property creation preview">
          <div className={styles.visualBadge}>TRY IT BEFORE YOU PAY</div>
          <div className={styles.voxelHouse} aria-hidden="true"><div className={styles.roof}/><div className={styles.houseBody}><i/><i/><b/></div><div className={styles.lawn}/></div>
          <div className={styles.priceBubble}><small>YOUR CREATION</small><strong>$4.99</strong><span>3D preview + voxel</span></div>
          <div className={styles.visualNote}>Preview first<br/><b>Voxel second</b></div>
        </div>
      </section>

      <section className={styles.flowCard} aria-label="VoxelPop creation steps">
        <div className={styles.flowIntro}><p>HOW IT WORKS</p><h2>One job. Four clear stages.</h2></div>
        <div className={styles.microFlow}><b>1 · PHOTO + $4.99</b><i>→</i><b>2 · SEE 3D</b><i>→</i><b>3 · MAKE VOXEL</b><i>→</i><b>4 · SAVE / OPTIONAL MINT</b></div>
        <Link className={styles.startButton} href="/demo">SEE THE PUBLIC SAMPLE →</Link>
        <small>The sample is synthetic. Your real result is guided by the photo you provide; one photo cannot prove unseen sides, exact dimensions, title, ownership, or property value.</small>
      </section>

      <section className={styles.destinationSection}>
        <div className={styles.sectionIntro}><p>AFTER YOUR VOXEL</p><h2>Everything else has one clear job.</h2><span>World is the map. Vault keeps your digital items. More contains optional, experimental, and provider-gated tools.</span></div>
        <div className={styles.assetGrid}>
          <Link href="/world" className={`${styles.assetTile} ${styles.worldTile}`}><div className={styles.tileIcon}>◎</div><small>WORLD</small><strong>See the mapped place</strong><span>Explore saved creations against source-backed location and building data.</span><b>Open World →</b></Link>
          <Link href="/vault" className={`${styles.assetTile} ${styles.vaultTile}`}><div className={styles.tileIcon}>◇</div><small>VAULT</small><strong>Keep your digital items</strong><span>Saved creations, purchased digital twins and optional minted assets live here.</span><b>Open Vault →</b></Link>
          <Link href="/more" className={`${styles.assetTile} ${styles.moreTile}`}><div className={styles.tileIcon}>•••</div><small>MORE</small><strong>Advanced stays advanced</strong><span>The $1.99 property tool is a demo; regulated financial and title workflows remain separate and gated.</span><b>See More →</b></Link>
        </div>
      </section>

      <section className={styles.truthStrip}>
        <div><small>DIGITAL</small><strong>Photo · 3D preview · voxel · optional NFT</strong></div><span>≠</span><div><small>LEGAL</small><strong>Deed / title / regulated investment rights</strong></div><Link href="/about">How Voxel Vault separates them →</Link>
      </section>

      <footer className={styles.footer}><span>Voxel Vault is not a bank and a VoxelPop item is not a deed. Digital creation or collectible payments do not create title, rent, occupancy, investment or appreciation rights in physical property. <Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link></span><Link href="/about">About + Support</Link></footer>
    </div>
  </main>;
}
