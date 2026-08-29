import Link from 'next/link';
import { APP_SECTIONS } from '../../lib/product-map';
import styles from './more.module.css';

export const metadata = {
  title: 'More',
  description: 'Advanced Voxel Vault tools, clearly separated by live, sandbox, evidence, and provider-gated status.',
};

export default function MorePage() {
  return <main className={styles.page}>
    <div className={styles.shell}>
      <header className={styles.top}>
        <Link className={styles.brand} href="/">VOXEL VAULT</Link>
        <span>ADVANCED · CLEAR STATUS</span>
      </header>

      <section className={styles.hero}>
        <small>ONLY WHEN YOU NEED IT</small>
        <h1>Advanced tools.<br/>No blurred promises.</h1>
        <p>The normal product is Create → World → Vault. This page holds everything else and labels whether a feature is live, digital-only, sandboxed, evidence-based, owner-only, or dependent on an approved external provider.</p>
        <div className={styles.heroActions}>
          <Link href="/property">CREATE PROPERTY VOXEL</Link>
          <Link href="/world">OPEN WORLD</Link>
          <Link href="/vault">OPEN MY VAULT</Link>
        </div>
      </section>

      {APP_SECTIONS.map((section) => <section className={styles.section} key={section.id}>
        <div className={styles.sectionHead}>
          <small>{section.eyebrow}</small>
          <h2>{section.title}</h2>
          <p>{section.description}</p>
        </div>
        <div className={styles.grid}>
          {section.items.map((item) => <Link className={styles.card} href={item.href} key={item.id}>
            <div className={styles.cardTop}><span className={styles.icon}>{item.icon}</span><span className={styles.badge}>{item.badge}</span></div>
            <h3>{item.label}</h3>
            <p>{item.description}</p>
            <span className={styles.open}>OPEN →</span>
          </Link>)}
        </div>
      </section>)}

      <div className={styles.note}>
        <b>ONE RULE</b>
        <span>A digital voxel is a digital asset. Map evidence is map evidence. A wallet balance is a wallet balance. A security is a security. A deed is a deed. Voxel Vault can organize them together, but never silently converts one legal status into another.</span>
      </div>
    </div>
  </main>;
}
