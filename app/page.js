import Link from 'next/link';
import styles from './home.module.css';

const CORE = [
  { href: '/studio', icon: '+', title: 'Create', copy: 'Make and prepare 3D voxel assets without starting inside finance or property tooling.', action: 'OPEN STUDIO' },
  { href: '/vault/earth', icon: '◎', title: 'Earth', copy: 'Explore source-backed real places, open imagery, local evidence and selected high-detail Meshy reconstructions.', action: 'EXPLORE EARTH' },
  { href: '/vault', icon: '◇', title: 'Vault', copy: 'Organize creator assets, digital twins and verified positions in one spatial collection without mixing what they legally mean.', action: 'OPEN VAULT' },
  { href: '/real-estate/reits', icon: '$', title: 'Invest', copy: 'Use provider-backed real-estate investment workflows with sandbox/live states and fail-closed execution gates.', action: 'OPEN INVESTMENTS' },
];

const TRUTH = [
  ['Digital assets', '3D models, collectibles and NFTs can be owned digitally. They do not automatically create rights in physical property.'],
  ['Real-world evidence', 'Maps, parcels, imagery and listings are evidence layers. Missing data stays missing instead of being invented.'],
  ['Money + ownership', 'Provider positions, observed income and recorded title remain separate until the exact provider/legal system proves each fact.'],
];

export default function Home() {
  return <main className={styles.page}>
    <div className={styles.shell}>
      <header className={styles.top}>
        <Link className={styles.brand} href="/">VOXEL VAULT</Link>
        <Link href="/more">ALL PRODUCTS →</Link>
      </header>

      <section className={styles.hero}>
        <span className={styles.eyebrow}>SPATIAL ASSET OS</span>
        <h1>Everything you own.<br/><em>Made spatial.</em></h1>
        <p>Create 3D assets, explore the real world, organize your Vault, and use connected financial tools from one app. Each layer keeps its own source, rights and verification rules instead of pretending every asset is the same thing.</p>
        <div className={styles.actions}>
          <Link href="/vault/earth">EXPLORE EARTH</Link>
          <Link href="/studio">CREATE 3D</Link>
          <Link href="/more">SEE EVERYTHING</Link>
        </div>
      </section>

      <section className={styles.core}>
        <div className={styles.sectionHead}>
          <small>FOUR CORE JOBS</small>
          <h2>Start where your goal actually is.</h2>
          <p>No more forcing creator tools, property research, finance and owner controls onto the same screen.</p>
        </div>
        <div className={styles.grid}>
          {CORE.map((item) => <Link className={styles.card} href={item.href} key={item.title}>
            <span className={styles.icon}>{item.icon}</span>
            <h3>{item.title}</h3>
            <p>{item.copy}</p>
            <span>{item.action} →</span>
          </Link>)}
        </div>
      </section>

      <section className={styles.core}>
        <div className={styles.sectionHead}>
          <small>ONE APP · SEPARATE TRUTH LAYERS</small>
          <h2>Organized does not mean conflated.</h2>
        </div>
        <div className={styles.truth}>
          {TRUTH.map(([title, copy]) => <article key={title}><b>{title}</b><span>{copy}</span></article>)}
        </div>
      </section>

      <footer className={styles.footer}>
        <span>Voxel Vault can connect creation, spatial data, digital assets and provider-backed finance while still keeping legal title, investment rights, map licenses and AI-generation evidence distinct.</span>
        <Link href="/more">OPEN ORGANIZED DIRECTORY →</Link>
      </footer>
    </div>
  </main>;
}
