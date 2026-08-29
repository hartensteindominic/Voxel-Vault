import Link from 'next/link';
import styles from './home.module.css';

// Product truth: the interface may unify 3D assets, property, USD and crypto visually, while the legal/provider rails remain separate.
// A voxel/NFT is never presented as a deed. Estimated asset value is never presented as settled cash.
export default function Home() {
  return <main className={styles.page}>
    <div className={styles.shell}>
      <nav className={styles.top}>
        <Link className={styles.brand} href="/" aria-label="Voxel Vault home">
          <span className={styles.logoMark}><i/><b>+</b></span><span>VOXEL VAULT</span>
        </Link>
        <div className={styles.topLinks}>
          <Link className={styles.slicePill} href="/geo/slice">Try $1.99</Link>
          <Link href="/property">Create</Link>
          <Link href="/vault">My Vault</Link>
        </div>
      </nav>

      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>✦ YOUR 3D MONEY + ASSET WORLD ✦</p>
          <h1>Build it.<br/><em>Keep it in your Vault.</em></h1>
          <p className={styles.lead}>A cute spatial home for your voxel creations, digital property, NFTs, connected crypto and provider-backed USD tools—without making the complicated parts feel complicated.</p>
          <div className={styles.heroActions}>
            <Link className={styles.primaryAction} href="/property">+ CREATE A VOXEL</Link>
            <Link className={styles.secondaryAction} href="/world">EXPLORE MY WORLD</Link>
          </div>
          <p className={styles.heroFine}>Create first. Minting and wallet connection stay optional. Real money and real-property rights only appear when the required provider and legal rails are actually available.</p>
        </div>

        <div className={styles.heroVisual} aria-label="Voxel Vault spatial wallet preview">
          <div className={styles.skySparkle}>✦</div>
          <div className={styles.voxelHouse} aria-hidden="true"><div className={styles.roof}/><div className={styles.houseBody}><i/><i/><b/></div><div className={styles.lawn}/></div>
          <div className={styles.priceBubble}><small>START SMALL</small><strong>$1.99</strong><span>property sandbox</span></div>
          <div className={`${styles.assetChip} ${styles.chipUsd}`}><span>$</span><b>USD</b></div>
          <div className={`${styles.assetChip} ${styles.chipCrypto}`}><span>◆</span><b>CRYPTO</b></div>
          <div className={`${styles.assetChip} ${styles.chipNft}`}><span>◇</span><b>NFT</b></div>
        </div>
      </header>

      <section className={styles.unifiedCard}>
        <div className={styles.sectionIntro}>
          <p>MY VAULT</p><h2>Everything has its own pocket.</h2>
          <span>One simple view, with the important boundaries preserved underneath.</span>
        </div>
        <div className={styles.assetGrid}>
          <Link href="/world" className={`${styles.assetTile} ${styles.propertyTile}`}><div className={styles.tileIcon}>⌂</div><small>3D WORLD</small><strong>My places</strong><span>See saved property voxels and explore your spatial world.</span><b>Open World →</b></Link>
          <Link href="/vault" className={`${styles.assetTile} ${styles.usdTile}`}><div className={styles.tileIcon}>$</div><small>USD</small><strong>Cash pocket</strong><span>Provider-settled USD belongs here when supported.</span><b>Open Vault →</b></Link>
          <Link href="/vault" className={`${styles.assetTile} ${styles.cryptoTile}`}><div className={styles.tileIcon}>◆</div><small>CRYPTO</small><strong>Wallet pocket</strong><span>Connect a wallet when you want one. It is not required to create.</span><b>Wallet tools →</b></Link>
          <Link href="/vault" className={`${styles.assetTile} ${styles.nftTile}`}><div className={styles.tileIcon}>◇</div><small>VOXELS + NFTs</small><strong>Collection</strong><span>Keep creations as digital assets and optionally mint eligible items later.</span><b>See Collection →</b></Link>
        </div>
      </section>

      <section className={styles.creationCard}>
        <div className={styles.step}><span>+</span><div><p>VOXELPOP CREATOR</p><h2>One photo. One adorable 3D asset.</h2><span>See the image first, then the interactive 3D. Save it to your World and Vault. If a paid 3D provider is unavailable, completed work should remain visible instead of disappearing.</span></div></div>
        <Link className={styles.startButton} href="/property">CREATE MY FIRST VOXEL →</Link>
        <div className={styles.microFlow}><b>PHOTO</b><i>→</i><b>PREVIEW</b><i>→</i><b>3D</b><i>→</i><b>WORLD</b><i>→</i><b>VAULT</b><i>→</i><b>OPTIONAL MINT</b></div>
        <small>Generation, checkout, minting and wallet actions remain explicit. Nothing should silently spend credits or move money.</small>
      </section>

      <section className={styles.convertCard}>
        <div className={styles.convertCopy}><p>USEFUL DIGITAL ASSETS</p><h2>Collect → sell → settle → use.</h2><span>Keep estimated NFT/crypto value separate from real spendable USD until an actual supported market or off-ramp settles the transaction.</span></div>
        <div className={styles.convertFlow} aria-label="Digital asset conversion path"><FlowIcon icon="◇" label="Asset" note="yours"/><i>→</i><FlowIcon icon="▦" label="Market" note="supported"/><i>→</i><FlowIcon icon="$" label="USD" note="settled"/><i>→</i><FlowIcon icon="⌂" label="Goal" note="next"/></div>
        <Link className={styles.convertAction} href="/geo/slice">TRY THE $1.99 PROPERTY SANDBOX</Link>
      </section>

      <section className={styles.quickLinks}>
        <Link href="/world"><span>◎</span><div><b>My World</b><small>Explore your saved 3D places.</small></div><i>›</i></Link>
        <Link href="/vault"><span>◇</span><div><b>My Vault</b><small>Assets, collection and connected money tools.</small></div><i>›</i></Link>
        <Link href="/more"><span>•••</span><div><b>More</b><small>Marketplace, property, rentals, AI and advanced tools.</small></div><i>›</i></Link>
      </section>

      <footer className={styles.footer}><span>Voxel Vault can organize digital assets and provider-backed financial tools in one interface. A voxel or NFT does not itself create deed/title, rent, occupancy, investment rights, a bank deposit, or spendable cash.</span><Link href="/more">More tools</Link></footer>
    </div>
  </main>;
}

function FlowIcon({ icon, label, note }) { return <div className={styles.flowIcon}><span>{icon}</span><b>{label}</b><small>{note}</small></div>; }
