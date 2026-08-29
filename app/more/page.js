import Link from 'next/link';
import ProductTopNav from '../components/ProductTopNav';
import styles from './more.module.css';

export const metadata = {
  title: 'Extras · Voxel Vault',
  description: 'Optional Voxel Vault tools kept separate from the main VoxelPop creation flow.',
};

const digitalTools = [
  { href: '/studio', icon: '+', title: 'Voxel Studio', copy: 'Create non-property voxel assets separately from VoxelPop Property.', badge: 'CREATE' },
  { href: '/capture', icon: '◉', title: 'Capture', copy: 'Bring another real object or image into a separate digital-asset workflow.', badge: 'SCAN' },
  { href: '/marketplace', icon: '▦', title: 'Marketplace', copy: 'Browse digital assets without mixing shopping into the house-voxel creator.', badge: 'SHOP' },
  { href: '/ai-licensing', icon: 'AI', title: 'AI Licensing', copy: 'Manage reviewed AI-use licensing for eligible digital assets.', badge: 'LICENSE' },
];

export default function MorePage() {
  return <main className={styles.page}>
    <ProductTopNav/>
    <div className={styles.shell}>
      <section className={styles.hero}>
        <small>EXTRAS</small>
        <h1>Keep VoxelPop simple.<br/><em>Open extras only when needed.</em></h1>
        <p><b>The main product is Create → 3D voxel photo → movable voxel → Vault.</b> World, minting, and the tools below are optional.</p>
      </section>

      <section className={styles.coreCard}>
        <div className={styles.coreCopy}>
          <small>CORE VOXELPOP FLOW</small>
          <h2>Making a house voxel?</h2>
          <p>Use a new house photo or reuse a property photo you already saved. You will review the <b>3D voxel photo</b> before the separate movable model is built.</p>
          <div className={styles.coreActions}>
            <Link className={styles.primary} href="/property">Create VoxelPop · $4.99 →</Link>
            <Link href="/demo">See free sample →</Link>
            <Link href="/vault">Open Vault →</Link>
          </div>
        </div>
        <div className={styles.flowVisual} aria-label="VoxelPop creation flow">
          <span>PHOTO</span><i>→</i><span>VOXEL PHOTO</span><i>→</i><span>APPROVE</span><i>→</i><span>MOVABLE VOXEL</span>
        </div>
      </section>

      <section className={styles.quickSection}>
        <div className={styles.sectionHead}><small>USEFUL EXTRAS</small><h2>Three places that support the core product.</h2><p>None of these are required to create a VoxelPop.</p></div>
        <div className={styles.quickGrid}>
          <Link className={styles.quickCard} href="/demo"><div className={styles.icon}>V</div><span className={styles.badge}>FREE</span><h3>VoxelPop demo</h3><p>See the 3D voxel photo and movable voxel before signing in or paying.</p><b>Open demo →</b></Link>
          <Link className={styles.quickCard} href="/vault"><div className={styles.icon}>◇</div><span className={styles.badge}>SAVED</span><h3>My Vault</h3><p>Reopen finished VoxelPops and saved property sources in one place.</p><b>Open Vault →</b></Link>
          <Link className={styles.quickCard} href="/world"><div className={styles.icon}>◎</div><span className={styles.badge}>OPTIONAL</span><h3>World</h3><p>Pair a finished voxel with map and building context after creation.</p><b>Open World →</b></Link>
        </div>
      </section>

      <details className={styles.advanced}>
        <summary><span><small>OTHER DIGITAL TOOLS</small><b>Studio, capture, marketplace + licensing</b></span><i>+</i></summary>
        <p className={styles.advancedIntro}>These are separate products and experiments. They stay collapsed so they do not compete with VoxelPop Property.</p>
        <div className={styles.grid}>{digitalTools.map((item) => <Link className={styles.card} href={item.href} key={item.href}>
          <div className={styles.cardTop}><span className={styles.icon}>{item.icon}</span><span className={styles.badge}>{item.badge}</span></div>
          <h3>{item.title}</h3><p>{item.copy}</p><b>Open →</b>
        </Link>)}</div>
      </details>

      <details className={styles.advanced}>
        <summary><span><small>OWNER / PROVIDER TOOLS</small><b>Advanced property and infrastructure screens</b></span><i>+</i></summary>
        <p className={styles.advancedIntro}>Provider-gated finance, title/claim verification, and owner infrastructure are not part of the $4.99 VoxelPop product. They remain separate and must never imply that a voxel or NFT creates physical-property or financial rights.</p>
        <div className={styles.advancedGrid}>
          <Link href="/vault/properties/claim"><b>Property verification</b><span>Evidence and Property Passport tools. Not a deed.</span><i>OPEN →</i></Link>
          <Link href="/admin/integrations"><b>Owner integrations</b><span>Provider and infrastructure readiness controls.</span><i>OPEN →</i></Link>
        </div>
      </details>

      <footer className={styles.note}><b>SIMPLE RULE</b><span>A VoxelPop model or NFT is a digital creation. It does not create deed/title, rent, occupancy, investment, banking, or appreciation rights in physical property.</span></footer>
    </div>
  </main>;
}
