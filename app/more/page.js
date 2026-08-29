import Link from 'next/link';
import { APP_SECTIONS } from '../../lib/product-map';
import styles from './more.module.css';

export const metadata = {
  title: 'More · Voxel Vault',
  description: 'A clear directory for Voxel Vault live, sandbox, provider-gated and owner tools.',
};

export default function MorePage() {
  return <main className={styles.page}>
    <div className={styles.shell}>
      <header className={styles.top}>
        <Link className={styles.brand} href="/">VOXEL VAULT</Link>
        <span>LIVE · SANDBOX · PROVIDER-GATED</span>
      </header>

      <section className={styles.hero}>
        <small>EVERYTHING ELSE, ORGANIZED</small>
        <h1>Know what each feature actually is.</h1>
        <p>The main app is Create → World → Vault. This directory keeps map tools, digital assets, sandbox experiments, regulated/provider-dependent features, and owner controls in separate groups.</p>
        <div className={styles.heroActions}>
          <Link href="/property">CREATE PROPERTY</Link>
          <Link href="/world">OPEN MY WORLD</Link>
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
        <b>ONE SIMPLE RULE</b>
        <span>A digital asset, map record, wallet balance, payment record, security, lease and property deed are different things. Voxel Vault may show them in one interface, but it never treats them as legally or financially interchangeable.</span>
      </div>
    </div>
  </main>;
}
