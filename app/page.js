import Link from 'next/link';
import styles from './home.module.css';

export default function Home() {
  return <main className={styles.page}>
    <div className={styles.shell}>
      <nav className={styles.top}>
        <Link className={styles.brand} href="/" aria-label="Voxel Vault home"><span className={styles.logoMark}><i/><b>+</b></span><span>VOXEL VAULT</span></Link>
        <div className={styles.topLinks}><Link href="/property">Create</Link><Link href="/world">World</Link><Link href="/vault">Vault</Link></div>
      </nav>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>VOXELPOP · PHOTO TO 3D</p>
          <h1>Your house photo.<br/><em>Then your 3D voxel.</em></h1>
          <p className={styles.lead}>Upload one property photo. After the $4.99 creation checkout, see the recognizable 3D preview first. Approve it, then create the movable voxel. Mint only if you want.</p>
          <div className={styles.heroActions}>
            <Link className={styles.primaryAction} href="/property">CREATE MY VOXELPOP →</Link>
            <Link className={styles.secondaryAction} href="/world">SEE MY WORLD</Link>
          </div>
          <p className={styles.heroFine}>$4.99 buys one digital VoxelPop creation. Your source photo stays on your device. The normal property creation flow uses no Meshy credits and needs no wallet until optional minting.</p>
        </div>

        <div className={styles.heroVisual} aria-label="VoxelPop property creation preview">
          <div className={styles.visualBadge}>PHOTO → 3D PREVIEW → VOXEL</div>
          <div className={styles.voxelHouse} aria-hidden="true"><div className={styles.roof}/><div className={styles.houseBody}><i/><i/><b/></div><div className={styles.lawn}/></div>
          <div className={styles.priceBubble}><small>ONE CREATION</small><strong>$4.99</strong><span>preview + voxel</span></div>
          <div className={styles.visualNote}>See the house first<br/><b>Build the voxel second</b></div>
        </div>
      </section>

      <section className={styles.flowCard} aria-label="VoxelPop creation steps">
        <div className={styles.flowIntro}><p>ONE SIMPLE FLOW</p><h2>See it. Approve it. Voxelize it.</h2></div>
        <div className={styles.microFlow}><b>PHOTO</b><i>→</i><b>$4.99</b><i>→</i><b>3D PREVIEW</b><i>→</i><b>VOXEL</b><i>→</i><b>OPTIONAL MINT</b></div>
        <Link className={styles.startButton} href="/property">START WITH A PROPERTY PHOTO →</Link>
        <small>World and Vault come after creation. Map context and NFT minting are optional and do not change physical-property ownership.</small>
      </section>

      <section className={styles.destinationSection}>
        <div className={styles.sectionIntro}><p>AFTER YOUR VOXEL</p><h2>Three places. No confusion.</h2><span>Create makes it. World shows it in place. Vault keeps it. Everything experimental stays under More.</span></div>
        <div className={styles.assetGrid}>
          <Link href="/property" className={`${styles.assetTile} ${styles.worldTile}`}><div className={styles.tileIcon}>+</div><small>CREATE</small><strong>Make or remake a voxel</strong><span>Use a new photo or reuse one of your saved properties.</span><b>Create →</b></Link>
          <Link href="/world" className={`${styles.assetTile} ${styles.vaultTile}`}><div className={styles.tileIcon}>◎</div><small>WORLD</small><strong>See your voxels in place</strong><span>Open your saved digital properties against source-backed map context.</span><b>Open World →</b></Link>
          <Link href="/vault" className={`${styles.assetTile} ${styles.moreTile}`}><div className={styles.tileIcon}>◇</div><small>VAULT</small><strong>Keep what you made</strong><span>Your properties, purchased twins, finished 3D creations, and optional mints live here.</span><b>Open Vault →</b></Link>
        </div>
      </section>

      <section className={styles.truthStrip}>
        <div><small>DIGITAL CREATION</small><strong>Photo → 3D preview → voxel → optional NFT</strong></div><span>≠</span><div><small>PHYSICAL PROPERTY</small><strong>Deed / title / rent / investment rights</strong></div><Link href="/more">Advanced + experimental →</Link>
      </section>
    </div>
  </main>;
}
