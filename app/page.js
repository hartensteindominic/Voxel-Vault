import Link from 'next/link';
import styles from './home.module.css';

// Safety contract: the checkout in the guided property flow buys the generated digital VoxelPop collectible only.
// Real purchase buttons only activate when a verified provider/listing and required legal settlement path exist.
// A 3D model or NFT alone is not a deed.
// A payment, 3D model, map marker, Property Passport, or NFT does not create rent, occupancy, investment, or appreciation rights.
// Creation flow contract: SIGN IN -> PHOTO -> AUTO 3D -> AUTO VOXEL -> MY WORLD PREVIEW -> BUY & SAVE -> VAULT -> OPTIONAL VERIFIED MINT.
// Canonical property minting remains a separate parcel-verification step and address text is never treated as deed/title proof.
export default function Home() {
  return <main className={styles.page}>
    <nav className={styles.top}>
      <Link className={styles.brand} href="/">VOXEL VAULT</Link>
      <div className={styles.topLinks}><Link href="/property">Create</Link><Link href="/vault/property-drafts">Vault</Link><Link href="/world">World</Link></div>
    </nav>

    <header className={styles.hero}>
      <p className={styles.kicker}>✦ PHOTO → 3D → VOXEL → YOUR WORLD ✦</p>
      <h1>One photo.<br/><em>One little world.</em></h1>
      <p className={styles.lead}>Sign in once, add a property photo, and VoxelPop guides the rest one step at a time.</p>
    </header>

    <section className={styles.card}>
      <div className={styles.step}><span>1</span><div><h2>Sign in first. Then start with the photo.</h2><p>We build the first 3D, turn that 3D into VoxelPop, make the final movable voxel, then let you preview it on My World before you pay.</p></div></div>
      <Link className={styles.startButton} href="/property">START PROPERTY → SIGN IN</Link>
      <div className={styles.microFlow}><b>SIGN IN</b><i>→</i><b>PHOTO</b><i>→</i><b>3D</b><i>→</i><b>VOXEL</b><i>→</i><b>WORLD</b><i>→</i><b>BUY + VAULT</b></div>
      <small>Nothing uploads, generates, buys, rents or saves before you sign in. Wallet connection is optional; verify and mint to a wallet later only if you want.</small>
    </section>

    <section className={styles.quickLinks}>
      <Link href="/vault/property-drafts"><span>◇</span><div><b>My Vault</b><small>Your collected voxel properties, Create Another, and optional mint path.</small></div></Link>
      <Link href="/world"><span>◉</span><div><b>My World</b><small>See your private saved properties plus opt-in public World voxels.</small></div></Link>
    </section>

    <footer className={styles.footer}>
      <span>Creating or minting a property model does not buy, rent, or create deed/title rights. Property checkout buys the generated digital collectible only.</span>
      <Link href="/more">Advanced</Link>
    </footer>
  </main>;
}
