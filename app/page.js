import Link from 'next/link';
import styles from './home.module.css';

// Public product truth:
// - The live property product creates a digital VoxelPop preview, a source-backed 3D map reference, and an optional digital collectible.
// - The $1.99 Property Demo is sandbox math only.
// - Real-estate securities and financial rails require approved providers and eligibility.
// - Real-property ownership changes only through the normal legal closing/title process.
export default function Home() {
  return <main className={styles.page}>
    <div className={styles.shell}>
      <nav className={styles.top}>
        <Link className={styles.brand} href="/" aria-label="Voxel Vault home">
          <span className={styles.logoMark}><i/><b>+</b></span>
          <span>VOXEL VAULT</span>
        </Link>
        <div className={styles.topLinks}>
          <Link href="/property">Create</Link>
          <Link href="/world">World</Link>
          <Link href="/vault">Vault</Link>
        </div>
      </nav>

      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>LIVE DIGITAL PROPERTY EXPERIENCE</p>
          <h1>Turn a real place into<br/><em>a digital voxel.</em></h1>
          <p className={styles.lead}>Use a photo to make a local VoxelPop preview, map the address in source-backed 3D, place it in your World, and optionally collect the digital voxel.</p>
          <div className={styles.heroActions}>
            <Link className={styles.primaryAction} href="/property">CREATE A VOXEL</Link>
            <Link className={styles.secondaryAction} href="/world">EXPLORE WORLD</Link>
          </div>
          <p className={styles.heroFine}>Collecting the digital voxel does not buy the house, land, deed, rent, equity, or investment rights.</p>
        </div>

        <div className={styles.heroVisual} aria-label="Voxel Vault digital property preview">
          <div className={styles.skySparkle}>✦</div>
          <div className={styles.voxelHouse} aria-hidden="true">
            <div className={styles.roof}/><div className={styles.houseBody}><i/><i/><b/></div>
            <div className={styles.lawn}/>
          </div>
          <div className={styles.priceBubble}><small>PROPERTY DEMO</small><strong>$1.99</strong><span>Sandbox only</span></div>
          <div className={`${styles.assetChip} ${styles.chipUsd}`}><span>✓</span><b>LIVE DIGITAL</b></div>
          <div className={`${styles.assetChip} ${styles.chipCrypto}`}><span>○</span><b>DEMO</b></div>
          <div className={`${styles.assetChip} ${styles.chipNft}`}><span>→</span><b>PARTNER</b></div>
        </div>
      </header>

      <section className={styles.unifiedCard}>
        <div className={styles.sectionIntro}>
          <p>KNOW THE STATUS</p>
          <h2>One app. Four clear meanings.</h2>
          <span>Nothing should look more legally or financially live than it really is.</span>
        </div>
        <div className={styles.assetGrid}>
          <Link href="/property" className={`${styles.assetTile} ${styles.propertyTile}`}>
            <div className={styles.tileIcon}>✓</div><small>LIVE DIGITAL</small><strong>Create + collect</strong><span>Local voxel preview, source-backed 3D map, World placement, and optional digital collectible checkout.</span><b>Create →</b>
          </Link>
          <Link href="/geo/slice" className={`${styles.assetTile} ${styles.usdTile}`}>
            <div className={styles.tileIcon}>¢</div><small>DEMO</small><strong>$1.99 Property Demo</strong><span>Fake demo USD and proportional property math. No real money or property rights.</span><b>Try demo →</b>
          </Link>
          <Link href="/real-estate/reits" className={`${styles.assetTile} ${styles.cryptoTile}`}>
            <div className={styles.tileIcon}>→</div><small>PARTNER REQUIRED</small><strong>Property investments</strong><span>Only live when an approved provider supports the exact asset, user, and transaction.</span><b>View status →</b>
          </Link>
          <Link href="/real-estate/acquire" className={`${styles.assetTile} ${styles.nftTile}`}>
            <div className={styles.tileIcon}>⌂</div><small>TITLE REQUIRED</small><strong>Real ownership</strong><span>Real property changes hands through diligence, closing, and recorded title—not an NFT or map marker.</span><b>See ownership path →</b>
          </Link>
        </div>
      </section>

      <section className={styles.creationCard}>
        <div className={styles.step}><span>+</span><div><p>HOW VOXELPOP PROPERTY WORKS</p><h2>PHOTO → VOXEL → 3D MAP → WORLD → COLLECT</h2><span>The preview is made on your device. The interactive 3D uses mapped source data. Collection is optional and purchases the digital voxel only.</span></div></div>
        <Link className={styles.startButton} href="/property">START → SIGN IN</Link>
        <div className={styles.microFlow}><b>SIGN IN</b><i>→</i><b>PHOTO</b><i>→</i><b>VOXEL</b><i>→</i><b>3D MAP</b><i>→</i><b>WORLD</b><i>→</i><b>COLLECT</b></div>
        <small>No Meshy credits or generation checkout are required for creation. A wallet is optional. Payment only appears if you choose to collect an eligible digital voxel.</small>
      </section>

      <section className={styles.quickLinks}>
        <Link href="/property"><span>+</span><div><b>Create</b><small>Make a VoxelPop property preview and map it in 3D.</small></div><i>›</i></Link>
        <Link href="/world"><span>◎</span><div><b>My World</b><small>See your private saved property voxels and shared map items.</small></div><i>›</i></Link>
        <Link href="/vault"><span>◇</span><div><b>My Vault</b><small>Keep digital assets and separately verified positions organized.</small></div><i>›</i></Link>
        <Link href="/more"><span>•••</span><div><b>More</b><small>Property demos, rentals, investments, verification, AI, and advanced tools.</small></div><i>›</i></Link>
      </section>

      <footer className={styles.footer}>
        <span>Voxel Vault is a digital property and asset interface. It is not itself a bank, broker, exchange, custodian, or deed registry. Features that require those regulated roles stay provider-gated until the required legal and operational rails exist.</span>
        <Link href="/more">Product status</Link>
      </footer>
    </div>
  </main>;
}
