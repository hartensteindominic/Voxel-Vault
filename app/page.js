import Link from 'next/link';
import styles from './home.module.css';

// Safety contract for any future purchase controls: Real purchase buttons only activate when a verified provider/listing and required legal settlement path exist.
// A 3D model or NFT alone is not a deed.
// Creation flow contract: SIGN IN -> ADDRESS -> PHOTO -> MAKE VOXEL -> MAKE 3D -> VAULT -> MINT LATER.
// Creating or minting a property model does not buy the property or create deed/title rights.
// Rental controls likewise require a real verified lease/provider path. A model/NFT alone is not a lease, ownership share, or rent right either.
export default function Home() {
  return <main className={styles.page}>
    <nav className={styles.top}>
      <Link className={styles.brand} href="/">VOXEL VAULT</Link>
      <div className={styles.topLinks}><Link href="/studio">VoxelPop</Link><Link href="/vault/property-drafts">Vault</Link></div>
    </nav>

    <header className={styles.hero}>
      <p className={styles.kicker}>✦ SIGN IN → MAKE THE VOXEL FIRST ✦</p>
      <h1>One account.<br/><em>One easy flow.</em></h1>
      <p className={styles.lead}>Nothing uploads, generates, buys, rents or saves before you sign in.</p>
    </header>

    <section className={styles.card}>
      <div className={styles.step}><span>1</span><div><h2>Sign in first.</h2><p>Then choose a property, pick the clearest photo and make the voxel before 3D.</p></div></div>
      <Link className={styles.startButton} href="/property">START PROPERTY → SIGN IN</Link>
      <div className={styles.microFlow}><b>SIGN IN</b><i>→</i><b>ADDRESS</b><i>→</i><b>PHOTO</b><i>→</i><b>MAKE VOXEL</b><i>→</i><b>3D</b><i>→</i><b>VAULT</b></div>
      <small>The voxel image must finish first. Only then does the 3D button unlock.</small>
    </section>

    <section className={styles.quickLinks}>
      <Link href="/studio"><span>✦</span><div><b>Make any voxel</b><small>Sign in → describe it → create it → 3D.</small></div></Link>
      <Link href="/vault/rentals"><span>⌂</span><div><b>Rented</b><small>Verified rentals and renter decoration live in your Vault.</small></div></Link>
    </section>

    <footer className={styles.footer}>
      <span>Creating or minting a property model does not buy, rent, or create deed/title rights in the real property.</span>
      <Link href="/more">Advanced</Link>
    </footer>
  </main>;
}
