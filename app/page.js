import Link from 'next/link';
import styles from './home.module.css';

// Safety contract: Collecting in the guided property flow buys the generated digital VoxelPop collectible only.
// The $1.99 Property Slice is a sandbox comparison/goal tool unless a separately verified legal offering is available.
// Real-property investment or purchase controls only activate when a verified provider/offering and required legal path exist.
// A 3D model, payment, map marker, Property Passport, or NFT is not a deed and does not create rent, occupancy, investment, or appreciation rights.
// Creation flow contract: SIGN IN -> PHOTO -> AUTO 3D -> AUTO VOXEL -> MY WORLD PREVIEW -> COLLECT -> VAULT -> OPTIONAL VERIFIED MINT.
// Canonical property minting remains a separate parcel-verification step and address text is never treated as deed/title proof.
export default function Home() {
  return <main className={styles.page}>
    <div className={styles.shell}>
      <nav className={styles.top}>
        <Link className={styles.brand} href="/" aria-label="Voxel Vault home">
          <span className={styles.logoMark}><i/><b>+</b></span>
          <span>VOXEL VAULT</span>
        </Link>
        <div className={styles.topLinks}>
          <Link className={styles.slicePill} href="/geo/slice">$1.99 Slice</Link>
          <Link href="/property">Create</Link>
          <Link href="/vault">Vault</Link>
        </div>
      </nav>

      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>✦ PROPERTY · CASH · CRYPTO · NFT ✦</p>
          <h1>Your property world.<br/><em>One simple Vault.</em></h1>
          <p className={styles.lead}>Create a real-place 3D voxel, test a tiny $1.99 property slice, keep digital assets together, and follow clear paths between NFTs, crypto and settled USD.</p>
          <div className={styles.heroActions}>
            <Link className={styles.primaryAction} href="/geo/slice">TRY THE $1.99 SLICE</Link>
            <Link className={styles.secondaryAction} href="/property">START → SIGN IN</Link>
          </div>
          <p className={styles.heroFine}>The $1.99 slice is a sandbox comparison—not deed ownership, a security purchase, or a funds transfer.</p>
        </div>

        <div className={styles.heroVisual} aria-label="Unified Voxel Vault preview">
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
          <p>ONE ACCOUNT VIEW</p>
          <h2>Four things. One organized home.</h2>
          <span>The interface can feel unified while custody, settlement and legal ownership stay correctly separated underneath.</span>
        </div>
        <div className={styles.assetGrid}>
          <Link href="/geo/slice" className={`${styles.assetTile} ${styles.propertyTile}`}>
            <div className={styles.tileIcon}>⌂</div><small>PROPERTY</small><strong>$1.99 test</strong><span>Compare tiny slices across property reference values.</span><b>Open Slice →</b>
          </Link>
          <Link href="/vault" className={`${styles.assetTile} ${styles.usdTile}`}>
            <div className={styles.tileIcon}>$</div><small>USD</small><strong>Settled cash</strong><span>Only provider-settled USD is treated as spendable money.</span><b>Open Vault →</b>
          </Link>
          <Link href="/vault" className={`${styles.assetTile} ${styles.cryptoTile}`}>
            <div className={styles.tileIcon}>◆</div><small>CRYPTO</small><strong>Wallet linked</strong><span>Connect a wallet without making wallet custody mandatory.</span><b>Connect in Vault →</b>
          </Link>
          <Link href="/vault" className={`${styles.assetTile} ${styles.nftTile}`}>
            <div className={styles.tileIcon}>◇</div><small>NFTs</small><strong>Useful assets</strong><span>Create, hold, optionally mint, sell through supported markets, then settle proceeds.</span><b>See collection →</b>
          </Link>
        </div>
      </section>

      <section className={styles.convertCard}>
        <div className={styles.convertCopy}>
          <p>MAKE NFTs USEFUL</p>
          <h2>Asset → market → settled money → next goal.</h2>
          <span>An NFT or crypto estimate is not cash. The Vault only upgrades value to spendable USD after a real provider-backed sale/off-ramp settles.</span>
        </div>
        <div className={styles.convertFlow} aria-label="NFT conversion path">
          <FlowIcon icon="◇" label="NFT" note="asset" />
          <i>→</i>
          <FlowIcon icon="▦" label="Market" note="buyer" />
          <i>→</i>
          <FlowIcon icon="$" label="USD" note="settled" />
          <i>→</i>
          <FlowIcon icon="⌂" label="Property" note="goal" />
        </div>
        <Link className={styles.convertAction} href="/geo/slice">PREVIEW THE CONVERSION PATH</Link>
      </section>

      <section className={styles.creationCard}>
        <div className={styles.step}><span>+</span><div><p>VOXELPOP PROPERTY CREATOR</p><h2>PHOTO → 3D → VOXEL → YOUR WORLD</h2><span>Start with an authorized photo. The app builds the first 3D, applies the VoxelPop look, creates the final movable voxel, then places it in your private World before collection.</span></div></div>
        <Link className={styles.startButton} href="/property">START → SIGN IN</Link>
        <div className={styles.microFlow}><b>SIGN IN</b><i>→</i><b>PHOTO</b><i>→</i><b>3D</b><i>→</i><b>VOXEL</b><i>→</i><b>WORLD</b><i>→</i><b>COLLECT + VAULT</b></div>
        <small>Nothing is uploaded, generated, or charged before sign-in. A wallet is optional until you choose the separate Verify &amp; Mint step later.</small>
      </section>

      <section className={styles.quickLinks}>
        <Link href="/world"><span>◎</span><div><b>My World</b><small>Your private saved voxels plus anything you choose to share.</small></div><i>›</i></Link>
        <Link href="/vault/property-drafts"><span>◇</span><div><b>My Collection</b><small>Saved and collected VoxelPop property assets.</small></div><i>›</i></Link>
        <Link href="/more"><span>•••</span><div><b>Everything else</b><small>Investments, verification, rentals, AI and advanced tools.</small></div><i>›</i></Link>
      </section>

      <footer className={styles.footer}>
        <span>Collecting or minting a voxel does not buy the physical property or create deed/title, rent, occupancy, or investment rights. Live banking, crypto exchange/custody, and real-property interests require separately approved providers and legal rails.</span>
        <Link href="/more">Advanced</Link>
      </footer>
    </div>
  </main>;
}

function FlowIcon({ icon, label, note }) {
  return <div className={styles.flowIcon}><span>{icon}</span><b>{label}</b><small>{note}</small></div>;
}
