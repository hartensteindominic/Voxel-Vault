import Link from 'next/link';
import styles from '../legal-page.module.css';

export const metadata = {
  title: 'Terms',
  description: 'Terms for Voxel Vault digital VoxelPop creation, optional minting, maps, and experimental features.',
};

export default function TermsPage() {
  return <main className={styles.page}><div className={styles.shell}>
    <nav className={styles.top}><Link className={styles.brand} href="/"><span>V</span><b>VOXEL VAULT</b></Link><div><Link href="/demo">Public demo</Link><Link href="/property">Create</Link></div></nav>
    <header className={styles.hero}><small>TERMS</small><h1>Digital creation.<br/>Clear boundaries.</h1><p>The current core Voxel Vault product turns an authorized property photo into a digital VoxelPop 3D preview and voxel. Other property, wallet, map, and provider features have separate meanings and requirements.</p></header>
    <section className={styles.card}>
      <div className={styles.notice}><strong>$4.99 DIGITAL:</strong> the creation payment buys one digital VoxelPop creation. It does not buy the physical house or land and does not create title, equity, rent, occupancy, investment, or appreciation rights.</div>
      <h2>Using photos and content</h2>
      <p>Only submit a property photo or other content that you took, own, or have permission to use. You remain responsible for having the rights needed to use the source material.</p>
      <h2>Creation results</h2>
      <p>The 3D preview and voxel are digital representations. A single photograph cannot truthfully establish unseen walls, exact roof geometry, precise dimensions, structural condition, boundaries, survey accuracy, appraisal value, or legal property rights. Results can vary with photo quality, device performance, and browser support.</p>
      <h2>Payments</h2>
      <p>A completed $4.99 VoxelPop creation checkout unlocks the digital preview and voxel creation flow for that paid creation. Separate optional digital collectible or blockchain actions, when offered, are not part of the physical-property purchase process.</p>
      <h2>Maps and property information</h2>
      <p>Address, building, parcel, imagery, and other source-backed place information may be incomplete or change over time. Map geometry, a saved property record, a payment, a Property Passport, or an NFT is not proof of deed/title ownership.</p>
      <h2>Wallets and blockchain</h2>
      <p>A wallet is optional for the core creation flow. Blockchain transactions can be public and may be irreversible. Users should verify network, wallet, transaction, and fee details before approving an optional mint or transfer.</p>
      <h2>Demo and provider-gated features</h2>
      <p>The $1.99 Property Sandbox uses demo credit and does not move real money or create property rights. Investment, banking, exchange, custody, lease, income, or direct-property workflows are live only to the extent that the required real providers, eligibility, settlement, evidence, and legal processes are actually available.</p>
      <h2>No professional advice</h2>
      <p>Voxel Vault is a software product, not a substitute for legal, tax, investment, financial, appraisal, survey, title, engineering, or other professional advice.</p>
      <h2>Availability</h2>
      <p>Voxel Vault is evolving software. Features, compatible devices, provider integrations, pricing for future products, and experimental routes may change. The product should fail closed rather than pretend an unavailable regulated or property-rights workflow is live.</p>
      <div className={styles.links}><Link href="/demo">See public demo</Link><Link href="/privacy">Privacy</Link><Link href="/about">About + contact</Link></div>
    </section>
    <footer className={styles.footer}><Link href="/">Home</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/about">About</Link></footer>
  </div></main>;
}
