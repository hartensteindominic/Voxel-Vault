import Link from 'next/link';
import styles from './home.module.css';

// Product truth: upload is the single consumer starting point.
// Nothing is uploaded, generated, or charged before sign-in.
// After an authorized photo is chosen, the app guides the user through local VoxelPop creation,
// interactive 3D, source-backed map placement, World, and optional digital collection.
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
          <p className={styles.lead}>Start with one property photo. After sign-in and your explicit creation checkout ($4.99), VoxelPop keeps that photo on your device while it builds the voxel-style image and movable 3D. Add the address only when you are ready to place it on the source-backed property map.</p>
          <div className={styles.heroActions}><Link className={styles.primaryAction} href="/property">START → SIGN IN + UPLOAD PHOTO</Link><Link className={styles.secondaryAction} href="/world">OPEN MY WORLD</Link></div>
          <p className={styles.heroFine}>$4.99 creates one digital VoxelPop item. No Meshy credits. No wallet required to create. Any later collection price is shown before a separate checkout.</p>
        </div>

        <div className={styles.heroVisual} aria-label="Upload one photo and VoxelPop guides the rest">
          <div className={styles.skySparkle}>✦</div>
          <div className={styles.voxelHouse} aria-hidden="true"><div className={styles.roof}/><div className={styles.houseBody}><i/><i/><b/></div><div className={styles.lawn}/></div>
          <div className={styles.priceBubble}><small>CREATE</small><strong>$4.99</strong><span>digital item</span></div>
          <div className={`${styles.assetChip} ${styles.chipUsd}`}><span>1</span><b>UPLOAD</b></div>
          <div className={`${styles.assetChip} ${styles.chipCrypto}`}><span>2</span><b>VOXEL + 3D</b></div>
          <div className={`${styles.assetChip} ${styles.chipNft}`}><span>3</span><b>MAP + WORLD</b></div>
        </div>
      </header>

      <section className={styles.creationCard}>
        <div className={styles.step}><span>+</span><div><p>THE EXPERIENCE</p><h2>One photo. One guided flow.</h2><span>Choose the picture first. The same screen moves from your photo to the VoxelPop image, movable 3D, address mapping, and finished World preview.</span></div></div>
        <Link className={styles.startButton} href="/property">START → SIGN IN + CHOOSE PHOTO</Link>
        <div className={styles.microFlow}><b>UPLOAD</b><i>→</i><b>CREATING</b><i>→</i><b>3D</b><i>→</i><b>MAP</b><i>→</i><b>READY</b></div>
        <small>Creation is $4.99. If you later collect a mapped digital voxel, its separate price is shown before checkout. Payment, collection and minting remain explicit actions—nothing is silently charged or minted.</small>
      </section>

      <section className={styles.unifiedCard}>
        <div className={styles.sectionIntro}><p>AFTER CREATION</p><h2>Everything has one clear home.</h2><span>Create is the front door. World shows mapped results. Vault keeps your digital collection. Advanced tools stay under More.</span></div>
        <div className={styles.assetGrid}>
          <Link href="/property" className={`${styles.assetTile} ${styles.propertyTile}`}><div className={styles.tileIcon}>+</div><small>CREATE</small><strong>Upload one photo</strong><span>Make one digital VoxelPop item for $4.99.</span><b>Choose photo →</b></Link>
          <Link href="/world" className={`${styles.assetTile} ${styles.usdTile}`}><div className={styles.tileIcon}>◎</div><small>WORLD</small><strong>See it on the map</strong><span>Explore your mapped VoxelPop places.</span><b>Open World →</b></Link>
          <Link href="/vault" className={`${styles.assetTile} ${styles.cryptoTile}`}><div className={styles.tileIcon}>◇</div><small>VAULT</small><strong>Keep your collection</strong><span>Saved and collected digital assets live here.</span><b>Open Vault →</b></Link>
          <Link href="/more" className={`${styles.assetTile} ${styles.nftTile}`}><div className={styles.tileIcon}>•••</div><small>MORE</small><strong>Optional tools</strong><span>Sandbox, wallets, verified financial rails, AI and property tools.</span><b>See More →</b></Link>
        </div>
      </section>

      <section className={styles.convertCard}>
        <div className={styles.convertCopy}><p>PRODUCT TRUTH</p><h2>The digital voxel is not the deed.</h2><span>Your photo creates the stylized VoxelPop item. Source-backed map data supplies location context. Neither one proves ownership of the physical property.</span></div>
        <div className={styles.convertFlow} aria-label="VoxelPop guided flow"><FlowIcon icon="▣" label="Photo" note="authorized"/><i>→</i><FlowIcon icon="◆" label="Voxel" note="digital"/><i>→</i><FlowIcon icon="◎" label="Map" note="reference"/><i>→</i><FlowIcon icon="◇" label="Vault" note="collection"/></div>
        <Link className={styles.convertAction} href="/property">START WITH A PHOTO</Link>
      </section>

      <footer className={styles.footer}><span>Collecting or minting a voxel does not buy the physical property or create deed/title, rent, occupancy, or investment rights. Live banking, crypto or real-property investing only appears through separately verified provider and legal rails.</span><Link href="/more">More tools</Link></footer>
    </div>
  </main>;
}

function FlowIcon({ icon, label, note }) { return <div className={styles.flowIcon}><span>{icon}</span><b>{label}</b><small>{note}</small></div>; }
