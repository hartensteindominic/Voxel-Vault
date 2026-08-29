import Link from 'next/link';
import styles from './home.module.css';

export default function Home() {
  return <main className={styles.page}>
    <header className={styles.top}>
      <Link className={styles.brand} href="/">VOXEL VAULT</Link>
      <nav><Link href="/vault/property-drafts">VAULT</Link><Link href="/world">WORLD</Link></nav>
    </header>

    <section className={styles.hero}>
      <span className={styles.eyebrow}>REAL PROPERTY · 3D · SIMPLE</span>
      <h1>Add a property.<br/><em>That’s it.</em></h1>
      <form className={styles.search} action="/property" method="get">
        <input name="q" placeholder="Enter any property address" aria-label="Property address" required />
        <button type="submit">ADD</button>
      </form>
      <p>Voxel Vault makes the 3D property first. Then you can buy a verified portion or the whole property when a real offering/listing exists, mint the digital record after verification, keep it in your Vault, and choose to show it on the public 3D World.</p>
    </section>

    <section className={styles.flow} aria-label="Voxel Vault property flow">
      <div><b>1</b><span>ADD PROPERTY</span></div>
      <i>→</i>
      <div><b>2</b><span>BUY PIECE / WHOLE</span></div>
      <i>→</i>
      <div><b>3</b><span>MINT</span></div>
      <i>→</i>
      <div><b>4</b><span>VAULT</span></div>
      <i>→</i>
      <div><b>5</b><span>WORLD</span></div>
    </section>

    <section className={styles.links}>
      <Link href="/vault/property-drafts"><strong>YOUR VAULT</strong><span>Your saved 3D properties.</span></Link>
      <Link href="/world"><strong>3D WORLD</strong><span>See properties people chose to share.</span></Link>
    </section>

    <footer className={styles.footer}>
      <span>Real purchase buttons only activate when a verified provider/listing and required legal settlement path exist. A 3D model or NFT alone is not a deed.</span>
      <Link href="/more">ADVANCED →</Link>
    </footer>
  </main>;
}
