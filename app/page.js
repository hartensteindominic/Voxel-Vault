import Link from 'next/link';
import styles from './home.module.css';

// Product truth contract:
// - VoxelPop collection purchases are digital collectibles only.
// - $1.99 Property Slice is a sandbox comparison unless a separately verified legal offering exists.
// - 3D models, payments, map markers, passports and NFTs are never treated as deeds or bank deposits.
export default function Home() {
  return <main className={styles.page}>
    <div className={styles.shell}>
      <nav className={styles.top}>
        <Link className={styles.brand} href="/" aria-label="Voxel Vault home">
          <span className={styles.logoMark}><i/><b>+</b></span>
          <span>VOXEL VAULT</span>
        </Link>
        <div className={styles.topLinks}>
          <Link className={styles.slicePill} href="/geo/slice">$1.99</Link>
          <Link href="/property">Create</Link>
          <Link href="/vault">Vault</Link>
        </div>
      </nav>

      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>✦ YOUR 3D PROPERTY + ASSET VAULT</p>
          <h1>Create it.<br/><em>Keep it together.</em></h1>
          <p className={styles.lead}>Turn a real place into a 3D voxel, test a tiny property slice, and keep property, USD, crypto and NFTs organized in one simple home.</p>
          <div className={styles.heroActions}>
            <Link className={styles.primaryAction} href="/property">CREATE A PROPERTY</Link>
            <Link className={styles.secondaryAction} href="/geo/slice">TRY $1.99 SLICE</Link>
          </div>
          <p className={styles.heroFine}>Digital property tools stay separate from legal title, regulated investments, banking and custody until verified providers are actually live.</p>
        </div>

        <div className={styles.heroVisual} aria-label="Voxel Vault property preview">
          <div className={styles.skySparkle}>✦</div>
          <div className={styles.voxelHouse} aria-hidden="true">
            <div className={styles.roof}/><div className={styles.houseBody}><i/><i/><b/></div>
            <div className={styles.lawn}/>
          </div>
          <div className={styles.priceBubble}><small>TEST SLICE</small><strong>$1.99</strong><span>Sandbox</span></div>
          <div className={`${styles.assetChip} ${styles.chipUsd}`}><span>$</span><b>USD</b></div>
          <div className={`${styles.assetChip} ${styles.chipCrypto}`}><span>◆</span><b>CRYPTO</b></div>
          <div className={`${styles.assetChip} ${styles.chipNft}`}><span>◇</span><b>NFT</b></div>
        </div>
      </header>

      <section className={styles.unifiedCard}>
        <div className={styles.sectionIntro}>
          <p>START HERE</p>
          <h2>Choose what you want to do.</h2>
          <span>The main app is now organized around four clear jobs instead of making every screen explain every feature.</span>
        </div>
        <div className={styles.assetGrid}>
          <Link href="/property" className={`${styles.assetTile} ${styles.propertyTile}`}>
            <div className={styles.tileIcon}>+</div><small>CREATE</small><strong>Make a 3D property</strong><span>Authorized photo → 3D → VoxelPop → your World.</span><b>Start creating →</b>
          </Link>
          <Link href="/geo/slice" className={`${styles.assetTile} ${styles.usdTile}`}>
            <div className={styles.tileIcon}>¢</div><small>PROPERTY</small><strong>Try the $1.99 slice</strong><span>Compare small sandbox prices across property reference values.</span><b>Open Slice →</b>
          </Link>
          <Link href="/vault" className={`${styles.assetTile} ${styles.cryptoTile}`}>
            <div className={styles.tileIcon}>◇</div><small>VAULT</small><strong>See your assets</strong><span>Property, saved 3D assets, wallet-linked crypto and optional NFTs.</span><b>Open Vault →</b>
          </Link>
          <Link href="/more" className={`${styles.assetTile} ${styles.nftTile}`}>
            <div className={styles.tileIcon}>•••</div><small>MORE</small><strong>Money + advanced</strong><span>Rentals, investments, verification, marketplace, AI and operator tools.</span><b>See everything →</b>
          </Link>
        </div>
      </section>

      <section className={styles.creationCard}>
        <div className={styles.step}><span>+</span><div><p>THE MAIN JOURNEY</p><h2>PHOTO → 3D → VOXEL → WORLD → VAULT</h2><span>Create first. Financial and blockchain tools stay optional instead of getting in the way of the basic experience.</span></div></div>
        <Link className={styles.startButton} href="/property">START → SIGN IN</Link>
        <div className={styles.microFlow}><b>SIGN IN</b><i>→</i><b>PHOTO</b><i>→</i><b>3D</b><i>→</i><b>VOXEL</b><i>→</i><b>WORLD</b><i>→</i><b>VAULT</b></div>
        <small>A wallet is optional until you intentionally choose a separate mint or wallet-linked feature.</small>
      </section>

      <section className={styles.convertCard}>
        <div className={styles.convertCopy}>
          <p>OPTIONAL ASSET PATH</p>
          <h2>Make an NFT useful without pretending it is cash.</h2>
          <span>Keep the 3D asset, optionally mint it, sell through a supported market, and only treat proceeds as USD after a real provider settles them.</span>
        </div>
        <div className={styles.convertFlow} aria-label="NFT conversion path">
          <FlowIcon icon="◇" label="NFT" note="optional" />
          <i>→</i>
          <FlowIcon icon="▦" label="Market" note="buyer" />
          <i>→</i>
          <FlowIcon icon="$" label="USD" note="settled" />
          <i>→</i>
          <FlowIcon icon="⌂" label="Property" note="goal" />
        </div>
        <Link className={styles.convertAction} href="/geo/slice">TRY THE SANDBOX PATH</Link>
      </section>

      <section className={styles.quickLinks}>
        <Link href="/world"><span>◎</span><div><b>My World</b><small>Your saved 3D property world.</small></div><i>›</i></Link>
        <Link href="/vault/property-drafts"><span>◇</span><div><b>My Collection</b><small>Saved and collected VoxelPop assets.</small></div><i>›</i></Link>
        <Link href="/more"><span>•••</span><div><b>Everything else</b><small>Money, rentals, verification, AI and advanced tools.</small></div><i>›</i></Link>
      </section>

      <footer className={styles.footer}>
        <span>Collecting or minting a voxel does not buy the physical property or create deed/title, rent, occupancy, or investment rights. Live banking, crypto exchange/custody, and real-property interests require separately approved providers and legal rails.</span>
        <Link href="/more">More</Link>
      </footer>
    </div>
  </main>;
}

function FlowIcon({ icon, label, note }) {
  return <div className={styles.flowIcon}><span>{icon}</span><b>{label}</b><small>{note}</small></div>;
}
