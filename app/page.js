import Link from 'next/link';
import styles from './home.module.css';

export default function Home() {
  return <main className={styles.page}>
    <nav className={styles.top}>
      <Link className={styles.brand} href="/">VOXEL VAULT</Link>
      <div className={styles.topLinks}><Link href="/vault/property-drafts">Vault</Link><Link href="/world">World</Link></div>
    </nav>

    <header className={styles.hero}>
      <p className={styles.kicker}>✦ REAL PLACE → VOXEL PROPERTY ✦</p>
      <h1>Add a property.<br/><em>See it in voxels.</em></h1>
      <p className={styles.lead}>Photo → voxel image → 3D. Mint later.</p>
    </header>

    <section className={styles.card}>
      <div className={styles.step}><span>1</span><div><h2>What property?</h2><p>Enter one real address.</p></div></div>
      <form className={styles.search} action="/property" method="get">
        <input name="q" placeholder="1047 Kensington Ave, Buffalo NY" aria-label="Property address" required />
        <button type="submit">ADD PROPERTY</button>
      </form>
      <div className={styles.microFlow}><b>CREATE IMAGE</b><i>→</i><b>CREATE 3D</b><i>→</i><b>VAULT</b><i>→</i><b>MINT LATER</b></div>
      <small>The photo guides appearance. We do not invent a facade when no rights-cleared reference photo is available.</small>
    </section>

    <footer className={styles.footer}>
      <span>Creating or minting a property model does not buy the property or create deed/title rights.</span>
      <Link href="/more">Advanced</Link>
    </footer>
  </main>;
}
