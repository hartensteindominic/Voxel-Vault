import Link from 'next/link';
import styles from './home.module.css';

export default function Home() {
  return <main className={styles.page}>
    <nav className={styles.top}>
      <Link className={styles.brand} href="/">VOXEL VAULT</Link>
      <div className={styles.topLinks}><Link href="/vault/property-drafts">My Vault</Link><Link href="/world">World</Link></div>
    </nav>

    <header className={styles.hero}>
      <p className={styles.kicker}>✦ REAL PROPERTY, MADE 3D ✦</p>
      <h1>Add a property.<br/><em>See it in voxels.</em></h1>
      <p className={styles.lead}>Type an address. We make the 3D property first.</p>
    </header>

    <section className={styles.card}>
      <div className={styles.step}><span>1</span><div><h2>What property?</h2><p>Any address you want to explore.</p></div></div>
      <form className={styles.search} action="/property" method="get">
        <input name="q" placeholder="1047 Kensington Ave, Buffalo NY" aria-label="Property address" required />
        <button type="submit">ADD PROPERTY</button>
      </form>
      <div className={styles.microFlow}><b>BUY PIECE / WHOLE</b><i>→</i><b>VERIFY + MINT</b><i>→</i><b>VAULT</b><i>→</i><b>WORLD</b></div>
      <small>Buying only turns on when a real verified offering or exact sale listing exists.</small>
    </section>

    <section className={styles.quickLinks}>
      <Link href="/vault/property-drafts"><span>▣</span><div><b>My Vault</b><small>Your 3D properties</small></div></Link>
      <Link href="/world"><span>◉</span><div><b>World</b><small>See shared voxel properties</small></div></Link>
    </section>

    <footer className={styles.footer}>
      <span>Real purchase buttons only activate when a verified provider/listing and required legal settlement path exist. A 3D model or NFT alone is not a deed.</span>
      <Link href="/more">Advanced</Link>
    </footer>
  </main>;
}
