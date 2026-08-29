import Link from 'next/link';
import styles from './home.module.css';

// Product truth: upload is the single consumer starting point.
// Nothing is uploaded, generated, or charged before sign-in.
// One $4.99 checkout unlocks the source-faithful 3D preview and local VoxelPop voxel creation.
// The authorized source photo stays on the user's device; normal creation does not spend Meshy credits.
// The user sees and approves the recognizable 3D preview before the blocky voxel conversion begins.
// Minting is an optional downstream wallet action for the finished digital voxel only.
// Source-backed map geometry is a separate place-data layer, not a reconstruction of unseen photo details.
// Banking, securities and physical-property rights stay on separate verified legal/provider rails.
// A 3D model, payment, map marker, Property Passport, NFT or VoxelPop item is never a deed.
export default function Home() {
  return <main className={styles.page}>
    <div className={styles.shell}>
      <nav className={styles.top}>
        <Link className={styles.brand} href="/" aria-label="Voxel Vault home"><span className={styles.logoMark}><i/><b>+</b></span><span>VOXEL VAULT</span></Link>
        <div className={styles.topLinks}><Link href="/property">Create</Link><Link href="/world">World</Link><Link href="/vault">Vault</Link></div>
      </nav>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>VOXELPOP · PROPERTY CREATION</p>
          <h1>Upload a picture.<br/><em>See your house in 3D.</em></h1>
          <p className={styles.lead}>After sign-in and the $4.99 creation checkout, VoxelPop shows a recognizable textured 3D preview from your authorized property photo first. You approve that preview, then VoxelPop creates the separate movable 3D voxel. Minting comes only after the voxel is ready.</p>
          <div className={styles.heroActions}><Link className={styles.primaryAction} href="/property">START → SIGN IN + UPLOAD PHOTO</Link><Link className={styles.secondaryAction} href="/world">OPEN MY WORLD</Link></div>
          <p className={styles.heroFine}>One VoxelPop creation costs $4.99. Your source photo stays on your device and creation runs without Meshy credits. Optional Collect later is a separate digital-item purchase; no wallet is required to create. A wallet is requested only if you choose Mint after the voxel is finished.</p>
        </div>

        <div className={styles.heroVisual} aria-label="VoxelPop property creation preview">
          <div className={styles.visualBadge}>YOUR PHOTO → 3D → VOXEL</div>
          <div className={styles.voxelHouse} aria-hidden="true"><div className={styles.roof}/><div className={styles.houseBody}><i/><i/><b/></div><div className={styles.lawn}/></div>
          <div className={styles.priceBubble}><small>ONE CREATION</small><strong>$4.99</strong><span>3D preview + voxel</span></div>
          <div className={styles.visualNote}>See the house first<br/><b>Then build the voxel</b></div>
        </div>
      </section>

      <section className={styles.flowCard} aria-label="VoxelPop creation steps">
        <div className={styles.flowIntro}><p>HOW IT WORKS</p><h2>See it first. Voxelize it second. Mint last.</h2></div>
        <div className={styles.microFlow}><b>UPLOAD</b><i>→</i><b>$4.99 CREATE</b><i>→</i><b>3D</b><i>→</i><b>VOXEL</b><i>→</i><b>MINT</b></div>
        <Link className={styles.startButton} href="/property">CREATE MY VOXELPOP →</Link>
        <small>Collection and minting remain separate optional actions. After the voxel is ready, <b>MAP</b> and <b>READY</b> World placement remain available as optional source-backed context. The NFT is the digital voxel, not the physical house or deed.</small>
      </section>

      <section className={styles.destinationSection}>
        <div className={styles.sectionIntro}><p>AFTER CREATION</p><h2>Everything else has a clear place.</h2><span>Create is the front door. Mint is optional. World is the map. Vault stores your digital items. Advanced tools stay under More.</span></div>
        <div className={styles.assetGrid}>
          <Link href="/world" className={`${styles.assetTile} ${styles.worldTile}`}><div className={styles.tileIcon}>◎</div><small>WORLD</small><strong>See it on the map</strong><span>Explore saved creations against source-backed places.</span><b>Open World →</b></Link>
          <Link href="/vault" className={`${styles.assetTile} ${styles.vaultTile}`}><div className={styles.tileIcon}>◇</div><small>VAULT</small><strong>Keep your digital items</strong><span>Your saved and minted digital assets live here.</span><b>Open Vault →</b></Link>
          <Link href="/more" className={`${styles.assetTile} ${styles.moreTile}`}><div className={styles.tileIcon}>•••</div><small>MORE</small><strong>Optional tools</strong><span>The $1.99 property comparison is a sandbox; financial products remain provider-gated.</span><b>See More →</b></Link>
        </div>
      </section>

      <section className={styles.truthStrip}>
        <div><small>DIGITAL</small><strong>Photo → 3D preview → Voxel → optional NFT</strong></div><span>≠</span><div><small>LEGAL</small><strong>Deed / title / regulated financial rails</strong></div><Link href="/more">See product status →</Link>
      </section>

      <footer className={styles.footer}><span>Voxel Vault is not a bank and a VoxelPop item is not a deed. Digital creation or collectible payments do not create title, rent, occupancy, investment or appreciation rights in physical property. Banking, exchange, custody, securities and real-property transactions require their own verified providers and legal rails.</span><Link href="/more">More tools</Link></footer>
    </div>
  </main>;
}
