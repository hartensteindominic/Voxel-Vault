import Link from 'next/link';
import styles from './home.module.css';

// Product truth: upload is the single consumer starting point.
// Nothing is uploaded, generated, or charged before sign-in.
// One $4.99 checkout unlocks the device-local 3D picture preview and the approved local voxel creation.
// The authorized source photo stays on the user's device; normal creation does not spend Meshy credits.
// The user sees and approves the house-like 3D picture before voxel conversion begins.
// Minting is an explicit optional final wallet action and represents only the finished digital voxel.
// Source-backed map geometry is an optional separate place-data layer, not a reconstruction of unseen photo details.
// Optional Collect is a separate digital-item purchase outside the normal creation funnel.
// Banking, securities and physical-property rights stay on separate verified legal/provider rails.
// A 3D model, payment, map marker, Property Passport, NFT or VoxelPop item is never a deed.
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

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>VOXELPOP · PROPERTY CREATION</p>
          <h1>Upload a picture.<br/><em>See it in 3D first.</em></h1>
          <p className={styles.lead}>After sign-in and the $4.99 creation checkout, VoxelPop shows your authorized property photo as an interactive 3D picture first. You compare it with the original, approve it, then VoxelPop creates the movable 3D voxel. Mint only after the voxel looks right.</p>
          <div className={styles.heroActions}>
            <Link className={styles.primaryAction} href="/property">START → SIGN IN + UPLOAD PHOTO</Link>
            <Link className={styles.secondaryAction} href="/world">OPEN MY WORLD</Link>
          </div>
          <p className={styles.heroFine}>One VoxelPop creation costs $4.99. Your source photo stays on your device and creation runs without Meshy credits. Optional Collect later is a separate digital-item purchase; no wallet is required to create. A wallet appears only if you choose Mint.</p>
        </div>

        <div className={styles.heroVisual} aria-label="VoxelPop property creation preview">
          <div className={styles.visualBadge}>YOUR HOUSE FIRST</div>
          <div className={styles.voxelHouse} aria-hidden="true">
            <div className={styles.roof}/>
            <div className={styles.houseBody}><i/><i/><b/></div>
            <div className={styles.lawn}/>
          </div>
          <div className={styles.priceBubble}><small>ONE CREATION</small><strong>$4.99</strong><span>3D picture + voxel</span></div>
          <div className={styles.visualNote}>Approve before voxel<br/><b>No generic fallback house</b></div>
        </div>
      </section>

      <section className={styles.flowCard} aria-label="VoxelPop creation steps">
        <div className={styles.flowIntro}>
          <p>HOW IT WORKS</p>
          <h2>See the house first. Voxel it second.</h2>
        </div>
        <div className={styles.microFlow}>
          <b>PHOTO</b><i>→</i><b>$4.99</b><i>→</i><b>3D PICTURE</b><i>→</i><b>3D VOXEL</b><i>→</i><b>MINT</b>
        </div>
        <Link className={styles.startButton} href="/property">CREATE MY VOXELPOP →</Link>
        <small>You approve the 3D picture before voxel conversion. Minting is optional and happens only after the finished voxel; My World mapping is optional too.</small>
      </section>

      <section className={styles.destinationSection}>
        <div className={styles.sectionIntro}>
          <p>AFTER CREATION</p>
          <h2>Everything else has a clear place.</h2>
          <span>Create is the front door. World is the optional map. Vault stores your digital items. Advanced tools stay under More.</span>
        </div>
        <div className={styles.assetGrid}>
          <Link href="/world" className={`${styles.assetTile} ${styles.worldTile}`}>
            <div className={styles.tileIcon}>◎</div><small>WORLD</small><strong>Place it on the map</strong><span>Optionally match the finished voxel to source-backed place context.</span><b>Open World →</b>
          </Link>
          <Link href="/vault" className={`${styles.assetTile} ${styles.vaultTile}`}>
            <div className={styles.tileIcon}>◇</div><small>VAULT</small><strong>Keep your digital items</strong><span>Your saved and collected digital assets live here.</span><b>Open Vault →</b>
          </Link>
          <Link href="/more" className={`${styles.assetTile} ${styles.moreTile}`}>
            <div className={styles.tileIcon}>•••</div><small>MORE</small><strong>Optional tools</strong><span>The $1.99 property comparison is a sandbox; financial products remain provider-gated.</span><b>See More →</b>
          </Link>
        </div>
      </section>

      <section className={styles.truthStrip}>
        <div><small>DIGITAL</small><strong>Photo → 3D picture → voxel → optional NFT</strong></div>
        <span>≠</span>
        <div><small>LEGAL</small><strong>Deed / title / regulated financial rails</strong></div>
        <Link href="/more">See product status →</Link>
      </section>

      <footer className={styles.footer}>
        <span>Voxel Vault is not a bank and a VoxelPop item is not a deed. Digital creation, voxel minting or collectible payments do not create title, rent, occupancy, investment or appreciation rights in physical property. Banking, exchange, custody, securities and real-property transactions require their own verified providers and legal rails.</span>
        <Link href="/more">More tools</Link>
      </footer>
    </div>
  </main>;
}
