import Link from 'next/link';
import { APP_SECTIONS } from '../../lib/product-map';
import styles from './more.module.css';

export const metadata = {
  title: 'More',
  description: 'The organized directory for Voxel Vault products, tools, ownership workflows and owner operations.',
};

export default function MorePage() {
  return <main className={styles.page}>
    <div className={styles.shell}>
      <header className={styles.top}>
        <Link className={styles.brand} href="/">VOXEL VAULT</Link>
        <span>ONE APP · CLEARLY ORGANIZED</span>
      </header>

      <section className={styles.hero}>
        <small>EVERYTHING, WITHOUT THE CLUTTER</small>
        <h1>One Vault.<br/>Clear places for everything.</h1>
        <p>Voxel Vault now separates the main jobs instead of making every screen explain the whole company. Explore real places, create 3D assets, manage your Vault, use provider-backed money tools, and keep operator controls in their own advanced area.</p>
        <div className={styles.heroActions}>
          <Link href="/vault/earth">EXPLORE EARTH</Link>
          <Link href="/studio">CREATE 3D</Link>
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
        <b>PRODUCT TRUTH RULE</b>
        <span>Map data, AI models, creator assets, securities, wallet holdings, income records and real-property title are intentionally separate data layers. Organizing them into one app does not make them legally equivalent.</span>
      </div>
    </div>
  </main>;
}
