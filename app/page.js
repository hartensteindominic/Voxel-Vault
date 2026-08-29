import Link from 'next/link';
import styles from './home.module.css';

// Product truth: upload is the single consumer starting point.
// Nothing is uploaded, generated, or charged before sign-in.
// One $4.99 checkout unlocks one device-local VoxelPop image + interactive 3D creation.
// The authorized source photo stays on the user's device; normal creation does not spend Meshy credits.
// Source-backed map geometry is a separate place-data layer, not a reconstruction of unseen photo details.
// Optional Collect is a separate digital-item purchase; minting remains optional and downstream.
// Banking, securities and physical-property rights stay on separate verified legal/provider rails.
// A 3D model, payment, map marker, Property Passport, NFT or VoxelPop item is never a deed.
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
          <p className={styles.lead}>Start with one authorized property photo. After sign-in and the $4.99 creation checkout, VoxelPop keeps that photo visible while it builds the local voxel-style image and movable 3D. Then you add the address so the result can be placed against source-backed property-map data.</p>
          <div className={styles.heroActions}><Link className={styles.primaryAction} href="/property">START → SIGN IN + UPLOAD PHOTO</Link><Link className={styles.secondaryAction} href="/world">OPEN MY WORLD</Link></div>
          <p className={styles.heroFine}>One VoxelPop creation costs $4.99. Your source photo stays on your device and the image + interactive 3D are built locally without Meshy credits. Optional Collect later is a separate digital-item purchase; no wallet is required to create.</p>
        </div>

        <div className={styles.heroVisual} aria-label="Upload one photo and VoxelPop guides the rest">
          <div className={styles.skySparkle}>✦</div>
          <div className={styles.voxelHouse} aria-hidden="true"><div className={styles.roof}/><div className={styles.houseBody}><i/><i/><b/></div><div className={styles.lawn}/></div>
          <div className={styles.priceBubble}><small>CREATE 3D</small><strong>$4.99</strong><span>local engine</span></div>
          <div className={`${styles.assetChip} ${styles.chipUsd}`}><span>1</span><b>UPLOAD</b></div>
          <div className={`${styles.assetChip} ${styles.chipCrypto}`}><span>2</span><b>VOXEL + 3D</b></div>
          <div className={`${styles.assetChip} ${styles.chipNft}`}><span>3</span><b>MAP + WORLD</b></div>
        </div>
      </header>

      <section className={styles.creationCard}>
        <div className={styles.step}><span>+</span><div><p>THE EXPERIENCE</p><h2>You provide the photo. We guide everything after it.</h2><span>Pick the picture first. The same creation screen progresses through the explicit $4.99 checkout, VoxelPop image, movable local 3D, address mapping and finished World preview.</span></div></div>
        <Link className={styles.startButton} href="/property">START → SIGN IN + CHOOSE PHOTO</Link>
        <div className={styles.microFlow}><b>UPLOAD</b><i>→</i><b>$4.99 CREATE</b><i>→</i><b>3D</b><i>→</i><b>MAP</b><i>→</i><b>READY</b></div>
        <small>Your photo stays on this device through creation. The address is requested only when the 3D is ready to be mapped. Collection and minting remain separate optional actions rather than hidden charges.</small>
      </section>

      <section className={styles.unifiedCard}>
        <div className={styles.sectionIntro}><p>AFTER CREATION</p><h2>Everything has a clear home.</h2><span>Create is the front door. World and Vault are where the finished result goes. Advanced features stay out of the way.</span></div>
        <div className={styles.assetGrid}>
          <Link href="/property" className={`${styles.assetTile} ${styles.propertyTile}`}><div className={styles.tileIcon}>+</div><small>CREATE</small><strong>$4.99 local VoxelPop</strong><span>Authorized photo → voxel image → movable 3D. No Meshy credits.</span><b>Choose photo →</b></Link>
          <Link href="/world" className={`${styles.assetTile} ${styles.usdTile}`}><div className={styles.tileIcon}>◎</div><small>WORLD</small><strong>See it on the map</strong><span>Explore your saved voxels against source-backed mapped locations.</span><b>Open World →</b></Link>
          <Link href="/vault" className={`${styles.assetTile} ${styles.cryptoTile}`}><div className={styles.tileIcon}>◇</div><small>VAULT</small><strong>Keep your digital items</strong><span>Saved and collected digital assets live here.</span><b>Open Vault →</b></Link>
          <Link href="/more" className={`${styles.assetTile} ${styles.nftTile}`}><div className={styles.tileIcon}>•••</div><small>MORE</small><strong>Optional tools</strong><span>Sandbox, wallets, provider-gated financial rails, AI and property verification.</span><b>See More →</b></Link>
        </div>
      </section>

      <section className={styles.convertCard}>
        <div className={styles.convertCopy}><p>CLEAR + LEGIT</p><h2>Digital asset ≠ physical property.</h2><span>The photo creates the digital VoxelPop; source-backed map data supplies mapped place context. The $1.99 property comparison is a sandbox, and financial products remain provider-gated. Physical-property rights require the normal verified legal path.</span></div>
        <div className={styles.convertFlow} aria-label="VoxelPop product boundaries"><FlowIcon icon="▣" label="Photo" note="device-local"/><i>→</i><FlowIcon icon="◆" label="Voxel" note="digital"/><i>→</i><FlowIcon icon="◎" label="Map" note="source-backed"/><i>≠</i><FlowIcon icon="⌂" label="Deed" note="legal rail"/></div>
        <Link className={styles.convertAction} href="/more">SEE SANDBOX + PROVIDER TOOLS</Link>
      </section>

      <footer className={styles.footer}><span>Voxel Vault is not a bank and a VoxelPop item is not a deed. Digital creation or collectible payments do not create title, rent, occupancy, investment or appreciation rights in physical property. Banking, exchange, custody, securities and real-property transactions require their own verified providers and legal rails.</span><Link href="/more">More tools</Link></footer>
    </div>
  </main>;
}

function FlowIcon({ icon, label, note }) { return <div className={styles.flowIcon}><span>{icon}</span><b>{label}</b><small>{note}</small></div>; }
