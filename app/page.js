import Link from 'next/link';
import styles from './home.module.css';

// Safety contract: the consumer front door shows only the product states that are actually true today.
// Digital creation uses an authorized photo for an on-device VoxelPop preview and a source-backed mapped 3D place.
// Collecting buys a digital collectible only. It does not buy the physical property or create deed/title, rent, occupancy, investment, or appreciation rights.
// The $1.99 Property Slice remains a sandbox comparison tool unless a separately verified legal offering is available.
// Real-property investment or purchase controls only activate when a verified provider/offering and required legal path exist.
// A 3D model, payment, map marker, Property Passport, or NFT is not a deed and does not create real-property rights.
// Real-property investing, money movement, custody, exchange and tokenized economic rights remain provider-gated and fail closed.
// Consumer flow: SIGN IN -> PHOTO -> VOXEL PREVIEW -> 3D MAP -> WORLD -> COLLECT + VAULT -> OPTIONAL VERIFIED MINT.
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
          <Link href="/vault/property-drafts">Vault</Link>
        </div>
      </nav>

      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>✦ REAL PLACE · DIGITAL VOXEL · CLEAR RIGHTS ✦</p>
          <h1>Build your property world.<br/><em>Keep it simple.</em></h1>
          <p className={styles.lead}>Turn an authorized property photo into a VoxelPop preview, match it to a real mapped place, explore the source-backed 3D neighborhood, and keep the digital asset in your Vault.</p>
          <div className={styles.heroActions}>
            <Link className={styles.primaryAction} href="/property">START → SIGN IN</Link>
            <Link className={styles.secondaryAction} href="/vault/property-drafts">OPEN MY VAULT</Link>
          </div>
          <p className={styles.heroFine}>Creating or collecting a voxel does not buy the physical property. Real ownership and investing use separate verified legal/provider rails.</p>
        </div>

        <div className={styles.heroVisual} aria-label="Voxel Vault property workflow preview">
          <div className={styles.skySparkle}>✦</div>
          <div className={styles.voxelHouse} aria-hidden="true">
            <div className={styles.roof}/><div className={styles.houseBody}><i/><i/><b/></div>
            <div className={styles.lawn}/>
          </div>
          <div className={styles.priceBubble}><small>CREATE</small><strong>FREE</strong><span>No Meshy credits</span></div>
          <div className={`${styles.assetChip} ${styles.chipUsd}`}><span>＋</span><b>PHOTO</b></div>
          <div className={`${styles.assetChip} ${styles.chipCrypto}`}><span>◎</span><b>MAP</b></div>
          <div className={`${styles.assetChip} ${styles.chipNft}`}><span>◇</span><b>VAULT</b></div>
        </div>
      </header>

      <section className={styles.creationCard}>
        <div className={styles.step}>
          <span>+</span>
          <div>
            <p>VOXELPOP PROPERTY</p>
            <h2>PHOTO → VOXEL PREVIEW → 3D MAP → WORLD</h2>
            <span>Your photo stays on-device for the preview. The interactive 3D comes from mapped building and neighborhood data, not invented unseen photo details.</span>
          </div>
        </div>
        <Link className={styles.startButton} href="/property">START → SIGN IN</Link>
        <div className={styles.microFlow}><b>SIGN IN</b><i>→</i><b>PHOTO</b><i>→</i><b>VOXEL</b><i>→</i><b>3D</b><i>→</i><b>WORLD</b><i>→</i><b>COLLECT + VAULT</b></div>
        <small>Nothing is uploaded, generated, or charged before sign-in. Creation itself is free. Collection is optional. A wallet is optional until you choose a separate verified mint step.</small>
      </section>

      <section className={styles.unifiedCard}>
        <div className={styles.sectionIntro}>
          <p>THREE MAIN PLACES</p>
          <h2>Create. Explore. Keep.</h2>
          <span>Everything else stays out of the way until you actually need it.</span>
        </div>
        <div className={styles.assetGrid} style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))' }}>
          <Link href="/property" className={`${styles.assetTile} ${styles.propertyTile}`}>
            <div className={styles.tileIcon}>+</div><small>CREATE</small><strong>Property voxel</strong><span>Photo preview + source-backed 3D map.</span><b>Create →</b>
          </Link>
          <Link href="/world" className={`${styles.assetTile} ${styles.usdTile}`}>
            <div className={styles.tileIcon}>◎</div><small>EXPLORE</small><strong>My World</strong><span>See mapped places and your saved digital property voxels.</span><b>Open World →</b>
          </Link>
          <Link href="/vault/property-drafts" className={`${styles.assetTile} ${styles.cryptoTile}`}>
            <div className={styles.tileIcon}>◇</div><small>KEEP</small><strong>My Vault</strong><span>Saved and collected digital property voxels, without financial clutter.</span><b>Open Vault →</b>
          </Link>
        </div>
      </section>

      <section className={styles.convertCard}>
        <div className={styles.convertCopy}>
          <p>WHAT IS ACTUALLY LIVE?</p>
          <h2>Digital first. Regulated features stay gated.</h2>
          <span>Voxel Vault can organize many asset types without pretending they are legally the same thing.</span>
        </div>
        <div className={styles.convertFlow} aria-label="Voxel Vault product status">
          <FlowIcon icon="◇" label="Digital voxel" note="available" />
          <i>·</i>
          <FlowIcon icon="¢" label="$1.99 Slice" note="sandbox" />
          <i>·</i>
          <FlowIcon icon="$" label="Real investing" note="provider-gated" />
          <i>·</i>
          <FlowIcon icon="⌂" label="Deed / title" note="external legal record" />
        </div>
        <Link className={styles.convertAction} href="/more">SEE ADVANCED TOOLS + STATUS</Link>
      </section>

      <section className={styles.quickLinks}>
        <Link href="/geo/slice"><span>¢</span><div><b>$1.99 Slice</b><small>Sandbox comparison only. No money moves and no property rights are created.</small></div><i>›</i></Link>
        <Link href="/vault/properties/claim"><span>✓</span><div><b>Verify a property</b><small>Evidence-first property identity and optional downstream minting.</small></div><i>›</i></Link>
        <Link href="/more"><span>•••</span><div><b>Advanced</b><small>Investing, rentals, money tools, AI, marketplace and owner controls—with live/sandbox/provider status kept explicit.</small></div><i>›</i></Link>
      </section>

      <footer className={styles.footer}>
        <span>Digital voxels, map data, wallet assets and legal property rights are separate records. Collection or minting does not create deed/title, rent, occupancy, or investment rights. Banking, exchange, custody and real-property investments require separately approved providers and legal rails.</span>
        <Link href="/more">Advanced</Link>
      </footer>
    </div>
  </main>;
}

function FlowIcon({ icon, label, note }) {
  return <div className={styles.flowIcon}><span>{icon}</span><b>{label}</b><small>{note}</small></div>;
}
