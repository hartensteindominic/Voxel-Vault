import Link from 'next/link';
import { APP_SECTIONS, PRODUCT_STATUS } from '../../lib/product-map';
import styles from './more.module.css';

export const metadata = {
  title: 'Product Status',
  description: 'A clear directory of what is live, demo-only, provider-gated, or dependent on recorded title in Voxel Vault.',
};

export default function MorePage() {
  return <main className={styles.page}>
    <div className={styles.shell}>
      <header className={styles.top}>
        <Link className={styles.brand} href="/">VOXEL VAULT</Link>
        <span>PRODUCT STATUS</span>
      </header>

      <section className={styles.hero}>
        <small>EVERYTHING, CLEARLY LABELED</small>
        <h1>Know what works now.<br/>Know what does not.</h1>
        <p>Voxel Vault keeps digital creation, property data, demo tools, provider-backed finance, and real-property ownership in one interface without pretending they are the same thing.</p>
        <div className={styles.heroActions}>
          <Link href="/property">CREATE A VOXEL</Link>
          <Link href="/world">OPEN WORLD</Link>
          <Link href="/vault">OPEN VAULT</Link>
        </div>
      </section>

      <div className={styles.note}>
        <b>{PRODUCT_STATUS.liveDigital.label}</b>
        <span>{PRODUCT_STATUS.liveDigital.description}</span>
      </div>
      <div className={styles.note}>
        <b>{PRODUCT_STATUS.demo.label}</b>
        <span>{PRODUCT_STATUS.demo.description}</span>
      </div>
      <div className={styles.note}>
        <b>{PRODUCT_STATUS.partner.label}</b>
        <span>{PRODUCT_STATUS.partner.description}</span>
      </div>
      <div className={styles.note}>
        <b>{PRODUCT_STATUS.title.label}</b>
        <span>{PRODUCT_STATUS.title.description}</span>
      </div>

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
        <span>A photo, 3D model, map marker, payment, NFT, wallet connection, or Property Passport never becomes a deed just because it appears in the same app. Each claim keeps its real source of authority.</span>
      </div>
    </div>
  </main>;
}
