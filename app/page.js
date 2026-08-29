import Link from 'next/link';
import styles from './home.module.css';

// Product truth: the consumer front door describes only what the current flow actually does.
// Photo -> local voxel preview -> source-backed 3D map -> World -> optional digital collection/mint.
// A voxel/NFT is not a deed. Estimated asset value is not settled cash. Regulated money/property rails stay separate.
export default function Home() {
  return <main className={styles.page}>
    <div className={styles.shell}>
      <nav className={styles.top}>
        <Link className={styles.brand} href="/" aria-label="Voxel Vault home">
          <span className={styles.logoMark}><i/><b>+</b></span><span>VOXEL VAULT</span>
        </Link>
        <div className={styles.topLinks}>
          <Link href="/property">Create</Link>
          <Link href="/world">World</Link>
          <Link href="/vault">Vault</Link>
        </div>
      </nav>

      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>✦ CREATE · MAP · COLLECT ✦</p>
          <h1>Turn a real place<br/><em>into a VoxelPop.</em></h1>
          <p className={styles.lead}>Choose a photo, make a voxel-style preview on your device, verify the address, then explore a source-backed interactive 3D map. Save it to your World and optionally collect or mint the digital asset.</p>
          <div className={styles.heroActions}>
            <Link className={styles.primaryAction} href="/property">START → SIGN IN + CREATE</Link>
            <Link className={styles.secondaryAction} href="/world">OPEN MY WORLD</Link>
          </div>
          <p className={styles.heroFine}>No Meshy credits are required for the normal property flow. A wallet is optional. Collection and minting are separate choices.</p>
        </div>

        <div className={styles.heroVisual} aria-label="VoxelPop property flow preview">
          <div className={styles.skySparkle}>✦</div>
          <div className={styles.voxelHouse} aria-hidden="true"><div className={styles.roof}/><div className={styles.houseBody}><i/><i/><b/></div><div className={styles.lawn}/></div>
          <div className={styles.priceBubble}><small>NORMAL CREATE</small><strong>0</strong><span>Meshy credits</span></div>
          <div className={`${styles.assetChip} ${styles.chipUsd}`}><span>▣</span><b>PHOTO</b></div>
          <div className={`${styles.assetChip} ${styles.chipCrypto}`}><span>◎</span><b>3D MAP</b></div>
          <div className={`${styles.assetChip} ${styles.chipNft}`}><span>◇</span><b>VAULT</b></div>
        </div>
      </header>

      <section className={styles.unifiedCard}>
        <div className={styles.sectionIntro}>
          <p>ONE SIMPLE APP</p><h2>Four places. That’s it.</h2>
          <span>The advanced tools still exist, but the main experience stays easy to understand.</span>
        </div>
        <div className={styles.assetGrid}>
          <Link href="/property" className={`${styles.assetTile} ${styles.propertyTile}`}><div className={styles.tileIcon}>+</div><small>CREATE</small><strong>Make a VoxelPop</strong><span>Photo preview plus source-backed mapped 3D.</span><b>Create →</b></Link>
          <Link href="/world" className={`${styles.assetTile} ${styles.usdTile}`}><div className={styles.tileIcon}>◎</div><small>WORLD</small><strong>Explore places</strong><span>See your saved voxels in their mapped locations.</span><b>Open World →</b></Link>
          <Link href="/vault" className={`${styles.assetTile} ${styles.cryptoTile}`}><div className={styles.tileIcon}>◇</div><small>VAULT</small><strong>Your collection</strong><span>Keep saved and collected digital assets together.</span><b>Open Vault →</b></Link>
          <Link href="/more" className={`${styles.assetTile} ${styles.nftTile}`}><div className={styles.tileIcon}>•••</div><small>MORE</small><strong>Optional tools</strong><span>Sandbox property, wallets, investments, rentals, AI and verification.</span><b>See More →</b></Link>
        </div>
      </section>

      <section className={styles.creationCard}>
        <div className={styles.step}><span>+</span><div><p>HOW IT WORKS</p><h2>Photo → voxel → mapped 3D.</h2><span>The photo creates a stylized local preview. The interactive 3D comes from source-backed map geometry, so the app does not pretend one photo reveals unseen sides or exact dimensions.</span></div></div>
        <Link className={styles.startButton} href="/property">START → SIGN IN + CREATE MY VOXEL</Link>
        <div className={styles.microFlow}><b>PHOTO</b><i>→</i><b>VOXEL</b><i>→</i><b>3D</b><i>→</i><b>WORLD</b><i>→</i><b>OPTIONAL COLLECT + VAULT</b></div>
        <small>A wallet is optional. Generation, checkout, collection, minting, trading and money movement remain explicit actions—nothing silently spends credits or moves funds.</small>
      </section>

      <section className={styles.convertCard}>
        <div className={styles.convertCopy}>
          <p>CLEAR BOUNDARIES</p>
          <h2>Digital asset ≠ physical property.</h2>
          <span>Sandbox comparisons, provider-backed financial tools, legal property ownership and optional NFTs stay separate underneath one interface.</span>
        </div>
        <div className={styles.convertFlow} aria-label="Voxel Vault product boundaries">
          <FlowIcon icon="¢" label="Sandbox" note="demo"/><i>→</i>
          <FlowIcon icon="$" label="Provider" note="when live"/><i>→</i>
          <FlowIcon icon="⌂" label="Title" note="legal rail"/><i>→</i>
          <FlowIcon icon="◇" label="NFT" note="digital"/>
        </div>
        <Link className={styles.convertAction} href="/more">OPEN OPTIONAL + ADVANCED TOOLS</Link>
      </section>

      <footer className={styles.footer}>
        <span>Collecting or minting a voxel does not buy the physical property or create deed/title, rent, occupancy, or investment rights. Voxel Vault is not presenting an NFT as a deed, a demo balance as money, or an estimate as spendable cash.</span>
        <Link href="/more">More tools</Link>
      </footer>
    </div>
  </main>;
}

function FlowIcon({ icon, label, note }) { return <div className={styles.flowIcon}><span>{icon}</span><b>{label}</b><small>{note}</small></div>; }
