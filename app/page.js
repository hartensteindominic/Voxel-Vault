import Link from 'next/link';
import styles from './home.module.css';

// Product truth: upload is the single consumer starting point.
// Nothing is uploaded, generated, or charged before sign-in.
// After an authorized photo is chosen, $4.99 buys one digital VoxelPop creation built locally without Meshy credits.
// Mapping, optional digital collection/minting, provider investments, and real-property title are separate actions and legal rails.
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
          <p className={styles.lead}>Start with one property photo. After sign-in, permission confirmation, and a $4.99 digital creation checkout, VoxelPop keeps that photo on your device while it builds the local voxel-style image and movable 3D. Then you add the address for source-backed map context.</p>
          <div className={styles.heroActions}><Link className={styles.primaryAction} href="/property">＋ UPLOAD A PROPERTY PHOTO</Link><Link className={styles.secondaryAction} href="/world">OPEN MY WORLD</Link></div>
          <p className={styles.heroFine}>Creation is $4.99. No Meshy credits are used. No wallet is required to create. Collection and minting are separate optional actions.</p>
        </div>

        <div className={styles.heroVisual} aria-label="Upload one photo and VoxelPop guides the rest">
          <div className={styles.skySparkle}>✦</div>
          <div className={styles.voxelHouse} aria-hidden="true"><div className={styles.roof}/><div className={styles.houseBody}><i/><i/><b/></div><div className={styles.lawn}/></div>
          <div className={styles.priceBubble}><small>VOXELPOP CREATE</small><strong>$4.99</strong><span>digital creation</span></div>
          <div className={`${styles.assetChip} ${styles.chipUsd}`}><span>1</span><b>UPLOAD</b></div>
          <div className={`${styles.assetChip} ${styles.chipCrypto}`}><span>2</span><b>CREATE + 3D</b></div>
          <div className={`${styles.assetChip} ${styles.chipNft}`}><span>3</span><b>MAP + WORLD</b></div>
        </div>
      </header>

      <section className={styles.creationCard}>
        <div className={styles.step}><span>+</span><div><p>THE EXPERIENCE</p><h2>One photo → $4.99 creation → 3D → map.</h2><span>Pick the picture first. After the paid creation is verified, the same screen progresses from your photo to the VoxelPop image, movable local 3D, address mapping, and finished World preview.</span></div></div>
        <Link className={styles.startButton} href="/property">＋ CHOOSE MY PHOTO</Link>
        <div className={styles.microFlow}><b>UPLOAD</b><i>→</i><b>$4.99</b><i>→</i><b>CREATING</b><i>→</i><b>3D</b><i>→</i><b>MAP</b><i>→</i><b>READY</b></div>
        <small>Your source photo stays on-device through creation. The address is requested when the 3D is ready to map. The $4.99 creation payment, optional collectible purchase, minting, trading, and money movement remain separate explicit actions.</small>
      </section>

      <section className={styles.unifiedCard}>
        <div className={styles.sectionIntro}><p>AFTER CREATION</p><h2>Everything has a clear home.</h2><span>Create is the front door. World and Vault are where the finished result goes. Advanced features stay out of the way.</span></div>
        <div className={styles.assetGrid}>
          <Link href="/property" className={`${styles.assetTile} ${styles.propertyTile}`}><div className={styles.tileIcon}>+</div><small>CREATE · $4.99</small><strong>Upload one photo</strong><span>Paid local VoxelPop creation. No Meshy credits.</span><b>Choose photo →</b></Link>
          <Link href="/world" className={`${styles.assetTile} ${styles.usdTile}`}><div className={styles.tileIcon}>◎</div><small>WORLD</small><strong>See it on the map</strong><span>Explore mapped saved VoxelPop places.</span><b>Open World →</b></Link>
          <Link href="/vault" className={`${styles.assetTile} ${styles.cryptoTile}`}><div className={styles.tileIcon}>◇</div><small>VAULT</small><strong>Keep your collection</strong><span>Saved and collected digital assets live here.</span><b>Open Vault →</b></Link>
          <Link href="/more" className={`${styles.assetTile} ${styles.nftTile}`}><div className={styles.tileIcon}>•••</div><small>MORE</small><strong>Optional tools</strong><span>$1.99 demo, wallets, partner-backed investments, AI and property tools.</span><b>See More →</b></Link>
        </div>
      </section>

      <section className={styles.convertCard}>
        <div className={styles.convertCopy}><p>CLEAR + LEGIT</p><h2>The digital voxel is not the deed.</h2><span>The photo creates a stylized local VoxelPop experience; source-backed map data supplies mapped building context. Physical-property rights remain separate and require the normal verified legal path.</span></div>
        <div className={styles.convertFlow} aria-label="VoxelPop guided flow"><FlowIcon icon="▣" label="Photo" note="yours"/><i>→</i><FlowIcon icon="◆" label="Voxel" note="$4.99 digital"/><i>→</i><FlowIcon icon="◎" label="Map" note="source-backed"/><i>→</i><FlowIcon icon="◇" label="Vault" note="optional"/></div>
        <Link className={styles.convertAction} href="/property">START WITH A PHOTO</Link>
      </section>

      <footer className={styles.footer}><span>Collecting or minting a voxel does not buy the physical property or create deed/title, rent, occupancy, or investment rights. A single photo cannot verify unseen architecture or exact dimensions. Voxel Vault is not itself a bank, broker, exchange, custodian, escrow service, or deed registry.</span><Link href="/more">More tools</Link></footer>
    </div>
  </main>;
}

function FlowIcon({ icon, label, note }) { return <div className={styles.flowIcon}><span>{icon}</span><b>{label}</b><small>{note}</small></div>; }
