import Link from 'next/link';
import ConsumerTopNav from '../components/ConsumerTopNav';
import styles from '../legal-page.module.css';

export const metadata = {
  title: 'Privacy',
  description: 'How Voxel Vault handles property photos, accounts, payments, maps, and optional wallet activity.',
};

export default function PrivacyPage() {
  return <main className={styles.page}>
    <ConsumerTopNav/>
    <div className={styles.shell}>
    <header className={styles.hero}><small>PRIVACY</small><h1>Your photo starts<br/>on your device.</h1><p>Voxel Vault is designed so the property source photo used by the current VoxelPop creation flow stays on the user’s device rather than becoming a public property-photo database.</p></header>
    <section className={styles.card}>
      <div className={styles.notice}><strong>Current product boundary:</strong> the normal $4.99 property creation flow uses local browser processing for the 3D preview and voxel creation and does not require Meshy credits.</div>
      <h2>Property photos</h2>
      <p>The current VoxelPop property flow processes the selected source image in the browser. When supported by the browser, Voxel Vault may keep a private copy in on-device browser storage so the same paid creation can resume after checkout. If that local cache is unavailable, the user may be asked to choose the same photo again. The source photo is not intentionally published in NFT metadata.</p>
      <h2>Accounts</h2>
      <p>Google sign-in may be used to associate saved property drafts, creation records, and other account-scoped product state with one Voxel Vault identity. The authentication provider and configured backend services process the information required for sign-in and account storage.</p>
      <h2>Payments</h2>
      <p>Paid checkouts are handled through the configured payment provider. Voxel Vault should not store complete card numbers in the application database. Payment-provider records may include transaction identifiers and the minimum metadata needed to verify the purchase.</p>
      <h2>Maps and property context</h2>
      <p>If a user chooses to map a finished creation, Voxel Vault may request address, coordinate, building, parcel, or other source-backed place information. Map data is kept conceptually separate from the user’s private source photo and from legal ownership records.</p>
      <h2>Wallets and minting</h2>
      <p>A wallet is not required for the core creation flow. If a user explicitly chooses to mint a finished digital voxel, public blockchain transaction information may be visible on the relevant network. Voxel Vault does not ask users to commit private keys or seed phrases to the public repository.</p>
      <h2>Public sharing</h2>
      <p>Items are not meant to become public property claims merely because they appear in World, Vault, metadata, or an NFT. Public-facing coordinates may be reduced or transformed where the product intentionally limits precision.</p>
      <h2>Third-party services</h2>
      <p>Authentication, payment, map, hosting, blockchain, analytics, or other providers may have their own privacy practices. Only services actually configured on the live deployment should be treated as active.</p>
      <h2>Questions</h2>
      <p>For privacy questions or data-handling concerns, use the project contact route on the About page or open a repository issue without posting passwords, payment credentials, private keys, identity documents, deeds, leases, or other sensitive personal information.</p>
      <div className={styles.links}><Link href="/about">About + contact</Link><Link href="/terms">Terms</Link><Link href="/demo">See public demo</Link></div>
    </section>
    <footer className={styles.footer}><Link href="/">Home</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/about">About</Link></footer>
  </div></main>;
}
