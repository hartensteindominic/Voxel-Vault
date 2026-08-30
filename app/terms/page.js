import Link from 'next/link';
import ProductTopNav from '../components/ProductTopNav';
import styles from '../legal-page.module.css';

export const metadata = {
  title: 'Terms',
  description: 'Terms for Galactic Trust financial-app features and Voxel Vault digital creation, maps, payments, and experimental provider-gated features.',
};

export default function TermsPage() {
  return <main className={styles.page}><ProductTopNav/><div className={styles.shell}>
    <header className={styles.hero}><small>TERMS</small><h1>Digital products.<br/>Clear boundaries.</h1><p>Galactic Trust and the wider Voxel Vault repository include software experiences that may look like banking, investing, property, wallet, map, or digital-asset products. Each feature is live only to the extent the required real providers, agreements, eligibility, settlement, evidence, and legal processes actually exist.</p></header>
    <section className={styles.card}>
      <div className={styles.notice}><strong>GALACTIC TRUST:</strong> Galactic Trust is a financial technology product, not a bank. It does not currently accept or hold real customer deposits, issue live bank accounts or debit cards, or move real customer money.</div>
      <h2>Galactic Trust banking features</h2>
      <p>Balances, cards, transfers, deposits, bill pay, rewards, crypto, and related dashboard content are simulated unless the product expressly identifies an approved live provider-backed program. Authentication to the website does not by itself open a bank account or complete bank-required identity verification.</p>
      <p>If live banking is introduced, the actual sponsor bank and approved banking providers must control or approve the relevant account terms, customer eligibility, KYC/CIP, AML and sanctions processes, payment rails, limits, statements, complaints, disputes, error resolution, fraud controls, settlement, and required disclosures. Galactic Trust will identify the actual bank only after that relationship and public wording are approved.</p>
      <h2>Deposit insurance and bank identity</h2>
      <p>Galactic Trust itself is not an FDIC-insured institution and should not be understood as one. No FDIC name, logo, Member FDIC statement, pass-through insurance claim, or other deposit-insurance representation applies to Galactic Trust unless it is tied to a specific approved sponsor-bank program and accurately describes that program.</p>
      <h2>Electronic transfers and disputes</h2>
      <p>Any future live electronic transfer service must use provider-authoritative transaction and settlement states and the applicable approved disclosures, receipts, statements, unauthorized-transfer procedures, and error-resolution process. The current demo transfer controls do not move real money.</p>
      <h2>Crypto</h2>
      <p>The current crypto panel is simulated. A live banking relationship does not automatically authorize crypto brokerage, exchange, transfer, or custody. Those features remain separate and require their own approved provider, eligibility, jurisdiction, disclosure, custody, and compliance framework before any real crypto transaction is enabled.</p>
      <h2>Regulated launch status</h2>
      <p>The public <Link href="/bank/readiness">Galactic Trust regulated launch status</Link> shows the product gates that remain blocked before real banking can be enabled. Environment variables, admin toggles, screenshots, or founder approval do not substitute for executed partner agreements and provider acceptance.</p>
      <h2>Using photos and content</h2>
      <p>Only submit a property photo or other content that you took, own, or have permission to use. You remain responsible for having the rights needed to use the source material.</p>
      <h2>Creation results</h2>
      <p>The 3D preview and voxel are digital representations. A single photograph cannot truthfully establish unseen walls, exact roof geometry, precise dimensions, structural condition, boundaries, survey accuracy, appraisal value, or legal property rights. Results can vary with photo quality, device performance, and browser support.</p>
      <h2>Payments</h2>
      <p><strong>$4.99 DIGITAL:</strong> a completed VoxelPop creation checkout buys one digital VoxelPop creation. It does not buy the physical house or land and does not create title, equity, rent, occupancy, investment, or appreciation rights.</p>
      <p>A completed $4.99 VoxelPop creation checkout unlocks the digital preview and voxel creation flow for that paid creation. Separate optional digital collectible or blockchain actions, when offered, are not part of the physical-property purchase process.</p>
      <h2>Maps and property information</h2>
      <p>Address, building, parcel, imagery, and other source-backed place information may be incomplete or change over time. Map geometry, a saved property record, a payment, a Property Passport, or an NFT is not proof of deed/title ownership.</p>
      <h2>Wallets and blockchain</h2>
      <p>A wallet is optional for the core creation flow. Blockchain transactions can be public and may be irreversible. Users should verify network, wallet, transaction, and fee details before approving an optional mint or transfer.</p>
      <h2>Demo and provider-gated features</h2>
      <p>The $1.99 Property Sandbox uses demo credit and does not move real money or create property rights. Investment, banking, exchange, custody, lease, income, or direct-property workflows are live only to the extent that the required real providers, eligibility, settlement, evidence, and legal processes are actually available.</p>
      <h2>No professional advice</h2>
      <p>Voxel Vault and Galactic Trust are software products, not substitutes for legal, tax, investment, financial, appraisal, survey, title, engineering, or other professional advice.</p>
      <h2>Availability</h2>
      <p>The software is evolving. Features, compatible devices, provider integrations, pricing for future products, and experimental routes may change. Regulated functionality should fail closed rather than pretend an unavailable financial or property-rights workflow is live.</p>
      <div className={styles.links}><Link href="/bank/readiness">Banking launch status</Link><Link href="/privacy">Privacy</Link><Link href="/about">About + contact</Link></div>
    </section>
  </div></main>;
}
