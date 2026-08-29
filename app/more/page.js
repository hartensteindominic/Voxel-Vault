import Link from 'next/link';
import { APP_SECTIONS } from '../../lib/product-map';
import styles from './more.module.css';

export const metadata = {
  title: 'More · Voxel Vault',
  description: 'Extra Voxel Vault tools, clearly separated from the everyday Create, World and Vault flow.',
};

function findItem(id) {
  return APP_SECTIONS.flatMap((section) => section.items).find((item) => item.id === id);
}

function ToolCard({ item, compact = false }) {
  if (!item) return null;
  return <Link className={`${styles.card} ${compact ? styles.compactCard : ''}`} href={item.href}>
    <div className={styles.cardTop}><span className={styles.icon}>{item.icon}</span><span className={styles.badge}>{item.badge}</span></div>
    <h3>{item.label}</h3>
    <p>{item.description}</p>
    <span className={styles.open}>Open →</span>
  </Link>;
}

export default function MorePage() {
  const start = ['property', 'bought-estates', 'earth', 'marketplace'].map(findItem).filter(Boolean);
  const explore = APP_SECTIONS.find((section) => section.id === 'explore');
  const create = APP_SECTIONS.find((section) => section.id === 'create');
  const createExtras = create?.items.filter((item) => !['property', 'bought-estates', 'marketplace'].includes(item.id)) || [];
  const advanced = APP_SECTIONS.filter((section) => ['property-money', 'intelligence', 'advanced'].includes(section.id));

  return <main className={styles.page}>
    <div className={styles.shell}>
      <header className={styles.top}>
        <Link className={styles.brand} href="/"><span>V</span>Voxel Vault</Link>
        <div className={styles.statusLine}>LIVE · SANDBOX · PROVIDER-GATED</div>
      </header>

      <section className={styles.hero}>
        <small>MORE · WITHOUT THE MESS</small>
        <h1>More tools.<br/><em>Still makes sense.</em></h1>
        <p><b>Know what each feature actually is.</b> The normal app stays Create → World → Vault. More is where browsing, extra creation tools, sandbox experiments, provider-backed finance and owner controls live without crowding the main experience.</p>
      </section>

      <section className={styles.startSection}>
        <div className={styles.sectionHead}><small>START HERE</small><h2>The useful stuff first.</h2><p>Four clear next steps instead of one giant wall of features.</p></div>
        <div className={styles.startGrid}>{start.map((item) => <ToolCard item={item} key={item.id}/>)}</div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}><small>EXPLORE</small><h2>Places + public things.</h2><p>{explore?.description}</p></div>
        <div className={styles.grid}>{explore?.items.map((item) => <ToolCard item={item} key={item.id} compact/>)}</div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}><small>CREATE + COLLECT</small><h2>Extra creative tools.</h2><p>Your main property creator and bought-property voxel path are already above. These are the optional extras.</p></div>
        <div className={styles.grid}>{createExtras.map((item) => <ToolCard item={item} key={item.id} compact/>)}</div>
      </section>

      <section className={`${styles.section} ${styles.advancedSection}`}>
        <div className={styles.sectionHead}><small>ADVANCED · CLEARLY LABELED</small><h2>Money, providers + power tools.</h2><p>These stay lower on purpose. A sandbox, security position, lease, deed, NFT and owner/admin control are different things.</p></div>
        {advanced.map((section) => <div className={styles.advancedGroup} key={section.id}>
          <div className={styles.groupHead}><div><small>{section.eyebrow}</small><h3>{section.title}</h3></div><p>{section.description}</p></div>
          <div className={styles.grid}>{section.items.map((item) => <ToolCard item={item} key={item.id} compact/>)}</div>
        </div>)}
      </section>

      <div className={styles.note}>
        <b>ONE SIMPLE RULE</b>
        <span>A digital asset, purchased Digital Estate, 3D voxel, NFT, map record, wallet balance, payment record, security, lease and property deed are different things. Voxel Vault can connect the experience without pretending those legal or financial rights are interchangeable.</span>
      </div>
    </div>
  </main>;
}
