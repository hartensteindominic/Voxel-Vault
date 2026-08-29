import Link from 'next/link';
import styles from './home.module.css';

// Product truth:
// - $4.99 unlocks one local VoxelPop image + interactive 3D creation.
// - The authorized source photo stays on the user's device; normal creation does not spend Meshy credits.
// - Source-backed map geometry is a separate place-data layer, not a reconstruction of unseen photo details.
// - Optional Collect is a separate digital-item purchase; minting stays optional and downstream.
// - A digital model, map record, payment, NFT or Property Passport is never a deed.
export default function Home() {
  return <main className={styles.page}>
    <div className={styles.shell}>
      <nav className={styles.top}>
        <Link className={styles.brand} href="/" aria-label="Voxel Vault home"><span className={styles.logoMark}><i/><b>+</b></span><span>VOXEL VAULT</span></Link>
        <div className={styles.topLinks}><Link href="/property">Create</Link><Link href="/world">World</Link><Link href="/vault">Vault</Link><Link href="/more">More</Link></div>
      </nav>

      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>✦ CREATE · MAP · COLLECT ✦</p>
          <h1>Turn a real place<br/><em>into a VoxelPop.</em></h1>
          <p className={styles.lead}>Use an authorized property photo to create a VoxelPop image and movable 3D model, verify the address with source-backed map data, then keep the digital item in your World and Vault.</p>
          <div className={styles.heroActions}><Link className={styles.primaryAction} href="/property">CREATE A PROPERTY</Link><Link className={styles.secondaryAction} href="/world">OPEN MY WORLD</Link></div>
          <p className={styles.heroFine}>One VoxelPop creation costs $4.99. Your source photo stays on your device, and the VoxelPop image + interactive 3D are built locally without Meshy credits. Optional Collect later is a separate digital-item purchase.</p>
        </div>

        <div className={styles.heroVisual} aria-label="VoxelPop property flow preview">
          <div className={styles.skySparkle}>✦</div>
          <div className={styles.voxelHouse} aria-hidden="true"><div className={styles.roof}/><div className={styles.houseBody}><i/><i/><b/></div><div className={styles.lawn}/></div>
          <div className={styles.priceBubble}><small>CREATE 3D</small><strong>$4.99</strong><span>Local engine</span></div>
          <div className={`${styles.assetChip} ${styles.chipUsd}`}><span>▣</span><b>VOXELPOP</b></div>
          <div className={`${styles.assetChip} ${styles.chipCrypto}`}><span>◎</span><b>3D MAP</b></div>
          <div className={`${styles.assetChip} ${styles.chipNft}`}><span>◇</span><b>VAULT</b></div>
        </div>
      </header>

      <section className={styles.unifiedCard}>
        <div className={styles.sectionIntro}><p>ONE SIMPLE APP</p><h2>Four places. That’s it.</h2><span>The advanced tools still exist, but the main experience stays easy to understand.</span></div>
        <div className={styles.assetGrid}>
          <Link href="/property" className={`${styles.assetTile} ${styles.propertyTile}`}><div className={styles.tileIcon}>+</div><small>CREATE</small><strong>$4.99 local VoxelPop</strong><span>Photo → VoxelPop image → movable 3D. The source photo stays on your device.</span><b>Create →</b></Link>
          <Link href="/world" className={`${styles.assetTile} ${styles.usdTile}`}><div className={styles.tileIcon}>◎</div><small>WORLD</small><strong>Explore places</strong><span>Verify and view source-backed mapped building context.</span><b>Open World →</b></Link>
          <Link href="/vault" className={`${styles.assetTile} ${styles.cryptoTile}`}><div className={styles.tileIcon}>◇</div><small>VAULT</small><strong>Your digital items</strong><span>Keep saved and collected digital assets together.</span><b>Open Vault →</b></Link>
          <Link href="/more" className={`${styles.assetTile} ${styles.nftTile}`}><div className={styles.tileIcon}>•••</div><small>MORE</small><strong>Optional tools</strong><span>Sandbox property, wallets, provider-gated investments, AI and verification.</span><b>See More →</b></Link>
        </div>
      </section>

      <section className={styles.creationCard}>
        <div className={styles.step}><span>+</span><div><p>ONE PROPERTY FLOW</p><h2>PHOTO → CREATE 3D → MAP → WORLD → COLLECT</h2><span>Pay $4.99 for one local digital creation, verify the place with source-backed map data, review it in your World, then optionally collect the digital voxel through a separate checkout.</span></div></div>
        <Link className={styles.startButton} href="/property">CREATE A PROPERTY</Link>
        <div className={styles.microFlow}><b>PHOTO</b><i>→</i><b>CREATE 3D</b><i>→</i><b>MAP</b><i>→</i><b>WORLD</b><i>→</i><b>OPTIONAL COLLECT</b></div>
        <small>A wallet is optional. Generation, collection, minting, trading and money movement remain explicit actions—nothing silently spends credits or moves funds.</small>
      </section>

      <section className={styles.convertCard}>
        <div className={styles.convertCopy}><p>CLEAR BOUNDARIES</p><h2>Digital asset ≠ physical property.</h2><span>The $1.99 property comparison is a sandbox. Financial products are provider-gated. A digital VoxelPop or NFT does not transfer physical-property ownership.</span></div>
        <div className={styles.convertFlow} aria-label="Voxel Vault product boundaries"><FlowIcon icon="¢" label="Sandbox" note="demo only"/><i>→</i><FlowIcon icon="$" label="Provider" note="when active"/><i>→</i><FlowIcon icon="⌂" label="Title" note="legal rail"/><i>≠</i><FlowIcon icon="◇" label="NFT" note="digital"/></div>
        <Link className={styles.convertAction} href="/more">SEE SANDBOX + PROVIDER TOOLS</Link>
      </section>

      <footer className={styles.footer}><span>Voxel Vault is not a bank and a VoxelPop item is not a deed. Digital creation or collectible payments do not create title, rent, occupancy, investment or appreciation rights in physical property. Banking, exchange, custody, securities and real-property transactions require their own verified providers and legal rails.</span><Link href="/more">More tools</Link></footer>
    </div>
  </main>;
}

function FlowIcon({ icon, label, note }) { return <div className={styles.flowIcon}><span>{icon}</span><b>{label}</b><small>{note}</small></div>; }
