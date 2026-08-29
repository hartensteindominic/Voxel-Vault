import Link from 'next/link';
import styles from './home.module.css';

// Safety contract: Collecting in the guided property flow buys the generated digital VoxelPop collectible only.
// Real-property investment or purchase controls only activate when a verified provider/offering and required legal path exist.
// A 3D model, payment, map marker, Property Passport, or NFT is not a deed and does not create rent, occupancy, investment, or appreciation rights.
// Creation flow contract: SIGN IN -> PHOTO -> AUTO 3D -> AUTO VOXEL -> MY WORLD PREVIEW -> COLLECT -> VAULT -> OPTIONAL VERIFIED MINT.
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
      <p className={styles.lead}>Sign in, choose a property photo, and VoxelPop guides the creation one clear step at a time.</p>
    </header>

    <section className={styles.card}>
      <div className={styles.step}><span>1</span><div><h2>Start with one photo.</h2><p>We make a first 3D model, turn it into the VoxelPop look, build the final movable voxel, then ask for the address so you can preview it on My World.</p></div></div>
      <Link className={styles.startButton} href="/property">START → SIGN IN</Link>
      <div className={styles.microFlow}><b>SIGN IN</b><i>→</i><b>PHOTO</b><i>→</i><b>3D</b><i>→</i><b>VOXEL</b><i>→</i><b>WORLD</b><i>→</i><b>COLLECT + VAULT</b></div>
      <small>Nothing is uploaded, generated, or charged before sign-in. A wallet is optional until you choose the separate Verify &amp; Mint step later.</small>
    </section>

    <section className={styles.quickLinks}>
      <Link href="/vault/property-drafts"><span>◇</span><div><b>My Vault</b><small>Your saved and collected digital property voxels.</small></div></Link>
      <Link href="/world"><span>◉</span><div><b>My World</b><small>See your private saved properties plus anything you choose to share publicly.</small></div></Link>
    </section>

    <footer className={styles.footer}>
      <span>Collecting or minting a voxel does not buy the physical property or create deed/title, rent, occupancy, or investment rights.</span>
      <Link href="/more">Advanced</Link>
    </footer>
  </main>;
}
