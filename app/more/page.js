import Link from 'next/link';
import styles from './more.module.css';

export const metadata = {
  title: 'More · Voxel Vault',
  description: 'Optional and advanced Voxel Vault tools, kept separate from the main Create, World, and Vault flow.',
};

const digitalTools = [
  { href: '/studio', icon: '+', title: 'Voxel Studio', copy: 'Create other 3D voxel assets that are not property-based.', badge: 'CREATE' },
  { href: '/marketplace', icon: '▦', title: 'Marketplace', copy: 'Browse digital assets and explicit checkout flows.', badge: 'SHOP' },
  { href: '/capture', icon: '◉', title: 'Capture', copy: 'Bring a real object or image into a digital-asset workflow.', badge: 'SCAN' },
  { href: '/room', icon: '◇', title: 'My Room', copy: 'Arrange confirmed digital collectibles in a personal 3D space.', badge: 'COLLECT' },
  { href: '/ai-licensing', icon: 'AI', title: 'AI Licensing', copy: 'Manage reviewed AI-use licensing for eligible digital assets.', badge: 'LICENSE' },
  { href: '/discover', icon: '✦', title: 'Discover', copy: 'Browse public Voxel Vault experiences and digital creations.', badge: 'BROWSE' },
];

const advancedTools = [
  { href: '/real-estate/reits', title: 'Real-estate investments', copy: 'Provider-backed securities only when an approved provider and eligible offering are actually active.' },
  { href: '/real-estate/acquire', title: 'Direct property path', copy: 'Ordinary diligence, financing, closing, and title steps. A token is never the deed.' },
  { href: '/vault/properties/claim', title: 'Property verification', copy: 'Verify evidence and optional Property Passport records without claiming title.' },
  { href: '/vault/rentals', title: 'Lease records', copy: 'Verified lease and payment records only when supporting evidence exists.' },
  { href: '/vault/income', title: 'Income records', copy: 'Provider-observed payment history without inventing returns or spendable balances.' },
  { href: '/admin/integrations', title: 'Owner integrations', copy: 'Provider and infrastructure readiness controls for the site owner.' },
];

export default function MorePage() {
  return <main className={styles.page}>
    <div className={styles.shell}>
      <nav className={styles.top}>
        <Link className={styles.brand} href="/"><span>V</span><b>VOXEL VAULT</b></Link>
        <div className={styles.navLinks}><Link href="/property">Create</Link><Link href="/world">World</Link><Link href="/vault">Vault</Link></div>
      </nav>

      <section className={styles.hero}>
        <small>MORE</small>
        <h1>Optional tools.<br/><em>Out of your way.</em></h1>
        <p><b>Create → World → Vault is the main app.</b> Everything below is secondary, experimental, provider-dependent, or advanced.</p>
      </section>

      <section className={styles.coreCard}>
        <div className={styles.coreCopy}>
          <small>CORE PROPERTY FLOW</small>
          <h2>Want to keep creating?</h2>
          <p>Use a new property photo or reuse one you already saved. The main sequence stays <b>photo → 3D preview → approve → voxel → optional mint</b>.</p>
          <div className={styles.coreActions}>
            <Link className={styles.primary} href="/property">Create a VoxelPop →</Link>
            <Link href="/property?source=properties">Use My Properties →</Link>
            <Link href="/vault">Open My Vault</Link>
          </div>
        </div>
        <div className={styles.flowVisual} aria-label="Property creation flow">
          <span>PHOTO</span><i>→</i><span>3D</span><i>→</i><span>APPROVE</span><i>→</i><span>VOXEL</span><i>→</i><span>OPTIONAL MINT</span>
        </div>
      </section>

      <section className={styles.quickSection}>
        <div className={styles.sectionHead}><small>PROPERTY EXTRAS</small><h2>Useful when you need them.</h2><p>These are separate from the normal creation journey.</p></div>
        <div className={styles.quickGrid}>
          <Link className={styles.quickCard} href="/geo/slice"><div className={styles.icon}>¢</div><span className={styles.badge}>DEMO</span><h3>$1.99 Property Sandbox</h3><p>Try hypothetical property-slice math with demo credit only. No real property rights or customer funds move.</p><b>Try demo →</b></Link>
          <Link className={styles.quickCard} href="/vault#purchased-twins"><div className={styles.icon}>⌂</div><span className={styles.badge}>PURCHASED</span><h3>Purchased Digital Twins</h3><p>Open an account-secured digital purchase and create its included custom voxel when eligible.</p><b>Open purchases →</b></Link>
          <Link className={styles.quickCard} href="/geo"><div className={styles.icon}>⌖</div><span className={styles.badge}>MAP DATA</span><h3>Property details</h3><p>Inspect map, building, parcel, and evidence context without treating it as title or ownership.</p><b>Open details →</b></Link>
        </div>
      </section>

      <details className={styles.advanced}>
        <summary><span><small>DIGITAL EXTRAS</small><b>Studio, marketplace, capture + more</b></span><i>+</i></summary>
        <p className={styles.advancedIntro}>These digital tools stay available without crowding the core property experience.</p>
        <div className={styles.grid}>{digitalTools.map((item) => <Link className={styles.card} href={item.href} key={item.href}>
          <div className={styles.cardTop}><span className={styles.icon}>{item.icon}</span><span className={styles.badge}>{item.badge}</span></div>
          <h3>{item.title}</h3><p>{item.copy}</p><b>Open →</b>
        </Link>)}</div>
      </details>

      <details className={styles.advanced}>
        <summary><span><small>ADVANCED + PROVIDER-GATED</small><b>Financial, legal, and owner tools</b></span><i>+</i></summary>
        <p className={styles.advancedIntro}>A demo, NFT, investment security, lease record, bank product, and property deed are different things. These screens intentionally stay outside the normal customer journey.</p>
        <div className={styles.advancedGrid}>{advancedTools.map((item) => <Link href={item.href} key={item.href}><b>{item.title}</b><span>{item.copy}</span><i>OPEN →</i></Link>)}</div>
      </details>
    </div>
  </main>;
}
