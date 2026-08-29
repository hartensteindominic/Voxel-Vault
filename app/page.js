import Link from 'next/link';
import styles from './home.module.css';

// Safety contract for any future purchase/rent controls: real-world rights only activate when a verified provider, lease/listing and required legal path exist.
// A 3D model or NFT alone is not a deed, lease, ownership share or rent right.
export default function Home() {
  return <main className={styles.page}>
    <nav className={styles.top}>
      <Link className={styles.brand} href="/">VOXEL VAULT</Link>
      <div className={styles.topLinks}><Link href="/vault/property-drafts">Vault</Link><Link href="/world">World</Link></div>
    </nav>

    <header className={styles.hero}>
      <p className={styles.kicker}>✦ REAL PLACE → VOXEL PROPERTY ✦</p>
      <h1>Add a property.<br/><em>Make it VoxelPop.</em></h1>
      <p className={styles.lead}>One easy step at a time.</p>
    </header>

    <section className={styles.card}>
      <div className={styles.step}><span>1</span><div><h2>Which property?</h2><p>Start with one real address.</p></div></div>
      <form className={styles.search} action="/property" method="get">
        <input name="q" placeholder="1047 Kensington Ave, Buffalo NY" aria-label="Property address" required />
        <button type="submit">FIND PROPERTY</button>
      </form>
      <div className={styles.microFlow}><b>ADDRESS</b><i>→</i><b>PHOTO</b><i>→</i><b>VOXEL IMAGE</b><i>→</i><b>3D</b><i>→</i><b>VAULT</b><i>→</i><b>MINT LATER</b></div>
      <small>Use your newest photo or a rights-cleared street photo. We never invent a missing facade.</small>
    </section>

    <footer className={styles.footer}>
      <span>Creating or minting a property model does not buy, rent, or create deed/title rights in the real property.</span>
      <Link href="/more">Advanced</Link>
    </footer>
  </main>;
}
