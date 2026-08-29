import Link from 'next/link';
import styles from './home.module.css';

// Product truth: one photo is the starting point.
// The $4.99 creation checkout unlocks the photo-based local 3D, mapping and saved digital creation.
// No second collection checkout is required in the normal property flow.
// Real-property investment or purchase controls only activate when a verified provider/offering and required legal path exist.
// A 3D model, payment, map marker, Property Passport, or NFT is not a deed and does not create rent, occupancy, investment, or appreciation rights.
export default function Home() {
  return <main className={styles.page}>
    <div className={styles.shell}>
      <nav className={styles.top}>
        <Link className={styles.brand} href="/" aria-label="Voxel Vault home"><span className={styles.logoMark}><i/><b>+</b></span><span>VOXEL VAULT</span></Link>
        <div className={styles.topLinks}><Link href="/property">Create</Link><Link href="/world">World</Link><Link href="/vault">Vault</Link></div>
      </nav>

      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>✦ ONE PHOTO → YOUR VOXEL WORLD ✦</p>
          <h1>Upload a picture.<br/><em>VoxelPop does the rest.</em></h1>
          <p className={styles.lead}>Sign in, choose a property photo, then pay <strong>$4.99 once</strong>. VoxelPop keeps the photo on your device while it creates a recognizable photo-based 3D. Add the address to connect it to source-backed map context and save the finished digital creation.</p>
          <div className={styles.heroActions}><Link className={styles.primaryAction} href="/property">START → SIGN IN + UPLOAD PHOTO</Link><Link className={styles.secondaryAction} href="/world">OPEN MY WORLD</Link></div>
          <p className={styles.heroFine}>$4.99 includes the local 3D, map placement and saved digital creation. No Meshy credits. No second collection checkout. Wallet and minting stay optional.</p>
        </div>

        <div className={styles.heroVisual} aria-label="Upload one photo and VoxelPop guides the rest">
          <div className={styles.skySparkle}>✦</div>
          <div className={styles.voxelHouse} aria-hidden="true"><div className={styles.roof}/><div className={styles.houseBody}><i/><i/><b/></div><div className={styles.lawn}/></div>
          <div className={styles.priceBubble}><small>ONE CREATION</small><strong>$4.99</strong><span>paid once</span></div>
          <div className={`${styles.assetChip} ${styles.chipUsd}`}><span>1</span><b>UPLOAD</b></div>
          <div className={`${styles.assetChip} ${styles.chipCrypto}`}><span>2</span><b>PHOTO → 3D</b></div>
          <div className={`${styles.assetChip} ${styles.chipNft}`}><span>3</span><b>MAP + SAVE</b></div>
        </div>
      </header>

      <section className={styles.creationCard}>
        <div className={styles.step}><span>+</span><div><p>THE EXPERIENCE</p><h2>Pay once. Create the 3D. Save it.</h2><span>The same creation screen goes from your photo to a movable photo-based 3D, then to the property map and saved Vault item. Background account sync never blocks the paid creation.</span></div></div>
        <Link className={styles.startButton} href="/property">START → SIGN IN + CHOOSE PHOTO</Link>
        <div className={styles.microFlow}><b>PHOTO</b><i>→</i><b>$4.99</b><i>→</i><b>3D</b><i>→</i><b>MAP</b><i>→</i><b>SAVED</b></div>
        <small>The visible façade and silhouette come from your photo. One photo cannot reveal unseen sides or exact dimensions, so hidden geometry is never presented as verified fact.</small>
      </section>

      <section className={styles.unifiedCard}>
        <div className={styles.sectionIntro}><p>AFTER CREATION</p><h2>Everything has a clear home.</h2><span>Create is the front door. World shows mapped context. Vault keeps your saved digital 3D. Advanced financial and legal tools stay separate.</span></div>
        <div className={styles.assetGrid}>
          <Link href="/property" className={`${styles.assetTile} ${styles.propertyTile}`}><div className={styles.tileIcon}>+</div><small>CREATE</small><strong>Photo → 3D for $4.99</strong><span>One paid creation, then map and save.</span><b>Choose photo →</b></Link>
          <Link href="/world" className={`${styles.assetTile} ${styles.usdTile}`}><div className={styles.tileIcon}>◎</div><small>WORLD</small><strong>See mapped context</strong><span>Explore saved VoxelPop places on source-backed maps.</span><b>Open World →</b></Link>
          <Link href="/vault" className={`${styles.assetTile} ${styles.cryptoTile}`}><div className={styles.tileIcon}>◇</div><small>VAULT</small><strong>Keep your 3D creations</strong><span>Saved digital VoxelPop items live here.</span><b>Open Vault →</b></Link>
          <Link href="/more" className={`${styles.assetTile} ${styles.nftTile}`}><div className={styles.tileIcon}>•••</div><small>MORE</small><strong>Optional tools</strong><span>Sandbox, wallets, verified provider rails, AI and property tools.</span><b>See More →</b></Link>
        </div>
      </section>

      <section className={styles.convertCard}>
        <div className={styles.convertCopy}><p>CLEAR + LEGIT</p><h2>The digital voxel is not the deed.</h2><span>The photo creates the digital VoxelPop 3D; source-backed map data supplies mapped building context. Physical-property rights remain separate and require the normal verified legal path.</span></div>
        <div className={styles.convertFlow} aria-label="VoxelPop guided flow"><FlowIcon icon="▣" label="Photo" note="yours"/><i>→</i><FlowIcon icon="◆" label="3D" note="photo-based"/><i>→</i><FlowIcon icon="◎" label="Map" note="source-backed"/><i>→</i><FlowIcon icon="◇" label="Vault" note="saved"/></div>
        <Link className={styles.convertAction} href="/property">START WITH A PHOTO</Link>
      </section>

      <footer className={styles.footer}><span>Paying for, saving, or optionally minting a VoxelPop 3D does not buy the physical property or create deed/title, rent, occupancy, or investment rights. A single photo also cannot verify unseen architecture or exact dimensions.</span><Link href="/more">More tools</Link></footer>
    </div>
  </main>;
}

function FlowIcon({ icon, label, note }) { return <div className={styles.flowIcon}><span>{icon}</span><b>{label}</b><small>{note}</small></div>; }
