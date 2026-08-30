import Link from 'next/link';
import ProductTopNav from '../components/ProductTopNav';
import styles from '../legal-page.module.css';

export const metadata = {
  title: 'Privacy',
  description: 'How Galactic Trust and Voxel Vault handle account sign-in, banking-readiness data, property photos, payments, maps, and optional wallet activity.',
};

export default function PrivacyPage() {
  return <main className={styles.page}><ProductTopNav/><div className={styles.shell}>
    <header className={styles.hero}><small>PRIVACY</small><h1>Collect less.<br/>Expose less.</h1><p>Galactic Trust uses account authentication today, but real bank identity data, deposit accounts, and money movement are not live. Future regulated data should be handled through the minimum approved provider flow rather than copied into the browser or public repository.</p></header>
    <section className={styles.card}>
      <div className={styles.notice}><strong>GALACTIC TRUST TODAY:</strong> the financial dashboard uses simulated balances, cards, transfers, and crypto. Galactic Trust does not currently collect bank-program KYC documents or hold real customer deposits.</div>
      <h2>Account authentication</h2>
      <p>Google sign-in or passwordless email sign-in may be used to establish a Galactic Trust/Voxel Vault application session. The authentication provider processes the information needed to authenticate the account. Application authentication is separate from any future bank-required customer identification or account-opening process.</p>
      <h2>Future bank-program identity data</h2>
      <p>If a sponsor-bank program launches, KYC/CIP, AML, sanctions, account-opening, card, transfer, dispute, and compliance data should be collected and stored according to the approved bank/provider architecture. The application should prefer provider-hosted or tokenized workflows when available and should not store full Social Security numbers, identity-document images, full payment-card numbers, PINs, CVVs, passwords, one-time codes, or provider API secrets in browser-visible application state.</p>
      <h2>Financial records</h2>
      <p>Live balances and transactions, if launched, must come from bank/provider-authoritative records and be reconciled against the provider ledger. The current displayed account numbers and transaction history are demo data and are not records of a real deposit account.</p>
      <h2>Provider secrets and webhooks</h2>
      <p>Banking platform credentials and webhook verification secrets belong only in server-side secret storage. Webhooks should be signature-verified, replay-resistant, and recorded with the minimum metadata needed for reconciliation, support, fraud review, and legal retention requirements.</p>
      <h2>Retention and access</h2>
      <p>Before live banking, the sponsor bank and privacy/security reviewers must approve a data inventory, retention schedule, access-control model, incident process, service-provider review, and customer privacy notices for the exact program.</p>
      <h2>Property photos</h2>
      <p>The selected source image begins in the browser. When supported, Voxel Vault keeps a private copy in on-device browser storage so the same paid creation can resume after checkout. During the voxel-image step, a resized JPG reference is transmitted transiently to the configured image-generation provider. Voxel Vault does not intentionally write the original source photo to its generation storage or publish it in NFT metadata.</p>
      <p>The generated voxel image is a visual interpretation of the visible reference. One photograph cannot verify hidden sides, the rear of a building, exact measurements, parcel boundaries, or legal property facts.</p>
      <h2>Payments</h2>
      <p>Paid VoxelPop checkouts are handled through the configured payment provider. Voxel Vault should not store complete card numbers in the application database. Payment-provider records may include transaction identifiers and the minimum metadata needed to verify the purchase.</p>
      <h2>Maps and property context</h2>
      <p>The confirmed address is used to resolve a source-backed building identity and enforce the one-property purchase and one-mint limit. Map data remains conceptually separate from the user’s source photo, generated artwork, and legal ownership records.</p>
      <h2>Wallets and minting</h2>
      <p>A wallet is not required for the core creation flow. If a user explicitly chooses to mint a finished digital voxel, public blockchain transaction information may be visible on the relevant network. Voxel Vault does not ask users to commit private keys or seed phrases to the public repository.</p>
      <h2>Third-party services</h2>
      <p>Authentication, payment, banking, identity/compliance, image generation, map, hosting, blockchain, analytics, or other providers may have their own privacy practices. Only services actually configured and approved on the live deployment should be treated as active.</p>
      <h2>Questions</h2>
      <p>For privacy questions or data-handling concerns, use the project contact route on the About page or open a repository issue without posting passwords, payment credentials, private keys, identity documents, account numbers, tax IDs, deeds, leases, or other sensitive personal information.</p>
      <div className={styles.links}><Link href="/bank/readiness">Banking launch status</Link><Link href="/terms">Terms</Link><Link href="/about">About + contact</Link></div>
    </section>
  </div></main>;
}
