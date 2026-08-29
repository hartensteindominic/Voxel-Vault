import Link from 'next/link';
import styles from './home.module.css';

// Public product truth:
// - VoxelPop Property creation is a $4.99 digital creation purchase.
// - The source photo stays device-local; the voxel image/model is built locally without Meshy credits.
// - Mapping and optional digital collectible checkout are separate from the creation payment.
// - The $1.99 Property Demo is sandbox math only.
// - Real-estate securities and real-property ownership remain separately provider/title gated.
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
          <p className={styles.lead}>Choose an authorized photo, pay $4.99 for one VoxelPop creation, build the voxel locally on your device, map the address in source-backed 3D, and place it in your World.</p>
          <div className={styles.heroActions}>
            <Link className={styles.primaryAction} href="/property">CREATE FOR $4.99</Link>
            <Link className={styles.secondaryAction} href="/world">EXPLORE WORLD</Link>
          </div>
          <p className={styles.heroFine}>The $4.99 purchase is for the digital creation. Collecting an eligible mapped digital voxel is optional and separate. Neither purchase buys the house, land, deed, rent, equity, or investment rights.</p>
        </div>

        <div className={styles.heroVisual} aria-label="Voxel Vault digital property preview">
          <div className={styles.skySparkle}>✦</div>
          <div className={styles.voxelHouse} aria-hidden="true">
            <div className={styles.roof}/><div className={styles.houseBody}><i/><i/><b/></div>
            <div className={styles.lawn}/>
          </div>
          <div className={styles.priceBubble}><small>VOXELPOP CREATE</small><strong>$4.99</strong><span>Digital creation</span></div>
          <div className={`${styles.assetChip} ${styles.chipUsd}`}><span>✓</span><b>LIVE DIGITAL</b></div>
          <div className={`${styles.assetChip} ${styles.chipCrypto}`}><span>¢</span><b>$1.99 DEMO</b></div>
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
            <div className={styles.tileIcon}>✓</div><small>LIVE DIGITAL</small><strong>VoxelPop · $4.99</strong><span>Paid digital creation with device-local source photo and local voxel generation. No Meshy credits.</span><b>Create →</b>
          </Link>
          <Link href="/geo/slice" className={`${styles.assetTile} ${styles.usdTile}`}>
            <div className={styles.tileIcon}>¢</div><small>DEMO</small><strong>$1.99 Property Demo</strong><span>Fake demo USD and proportional property math. No real money or property rights.</span><b>Try demo →</b>
          </Link>
          <Link href="/real-estate/reits" className={`${styles.assetTile} ${styles.cryptoTile}`}>
            <div className={styles.tileIcon}>→</div><small>PARTNER REQUIRED</small><strong>Property investments</strong><span>Only live when an approved provider supports the exact asset, user, eligibility, and transaction.</span><b>View status →</b>
          </Link>
          <Link href="/real-estate/acquire" className={`${styles.assetTile} ${styles.nftTile}`}>
            <div className={styles.tileIcon}>⌂</div><small>TITLE REQUIRED</small><strong>Real ownership</strong><span>Real property changes hands through diligence, closing, and recorded title—not an NFT or map marker.</span><b>See ownership path →</b>
          </Link>
        </div>
      </section>

      <section className={styles.creationCard}>
        <div className={styles.step}><span>+</span><div><p>HOW VOXELPOP PROPERTY WORKS</p><h2>PHOTO → $4.99 → LOCAL 3D → MAP → WORLD</h2><span>Your source photo stays on the device. After payment is verified, Voxel Vault builds the voxel locally, then you add the address for source-backed 3D map context.</span></div></div>
        <Link className={styles.startButton} href="/property">START → SIGN IN</Link>
        <div className={styles.microFlow}><b>SIGN IN</b><i>→</i><b>PHOTO</b><i>→</i><b>$4.99</b><i>→</i><b>VOXEL 3D</b><i>→</i><b>WORLD</b><i>→</i><b>OPTIONAL COLLECT</b></div>
        <small>The creation fee is $4.99. No Meshy credits are used. A wallet is optional. If you later choose to collect an eligible mapped digital voxel, that is a separate digital-collectible checkout.</small>
      </section>

      <section className={styles.quickLinks}>
        <Link href="/property"><span>+</span><div><b>Create</b><small>Make a paid VoxelPop property creation and map it in 3D.</small></div><i>›</i></Link>
        <Link href="/world"><span>◎</span><div><b>My World</b><small>See your private saved property voxels and shared map items.</small></div><i>›</i></Link>
        <Link href="/vault"><span>◇</span><div><b>My Vault</b><small>Keep digital assets and separately verified positions organized.</small></div><i>›</i></Link>
        <Link href="/more"><span>•••</span><div><b>More</b><small>Property demos, rentals, investments, verification, AI, and advanced tools.</small></div><i>›</i></Link>
      </section>

      <footer className={styles.footer}>
        <span>Voxel Vault is a digital property and asset interface. It is not itself a bank, broker, exchange, custodian, escrow service, or deed registry. Features that require those regulated or legal roles stay provider- or title-gated until the exact required rails exist.</span>
        <Link href="/more">Product status</Link>
      </footer>
    </div>
  </main>;
}
