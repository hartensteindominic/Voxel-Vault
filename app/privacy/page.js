import Link from 'next/link';
import ProductTopNav from '../components/ProductTopNav';
import styles from '../legal-page.module.css';

export const metadata = {
  title: 'Privacy',
  description: 'How Voxel Vault handles property photos, accounts, payments, maps, and optional wallet activity.',
};

export default function PrivacyPage() {
  return <main className={styles.page}><ProductTopNav/><div className={styles.shell}>
    <header className={styles.hero}><small>PRIVACY</small><h1>Your original photo<br/>starts on your device.</h1><p>Voxel Vault keeps the source photo private from public property listings and does not intentionally publish the original photo as a property-photo database.</p></header>
    <section className={styles.card}>
      <div className={styles.notice}><strong>Current product boundary:</strong> after the $4.99 property creation is verified, the browser sends a resized prepared reference to the configured VoxelPop image provider to create the voxel image. That generated voxel image then feeds the configured image-to-3D provider to create the final movable GLB saved in your Vault.</div>
      <h2>Property photos</h2>
      <p>The selected source image begins in the browser. When supported, Voxel Vault keeps a private copy in on-device browser storage so the same paid creation can resume after checkout. During the voxel-image step, a resized JPG reference is transmitted transiently to the configured image-generation provider. Voxel Vault does not intentionally write the original source photo to its generation storage or publish it in NFT metadata.</p>
      <p>The generated voxel image is a visual interpretation of the visible reference. One photograph cannot verify hidden sides, the rear of a building, exact measurements, parcel boundaries, or legal property facts.</p>
      <h2>Generated 3D voxel</h2>
      <p>After the voxel image succeeds, its generated provider URL is used as the input to the configured image-to-3D service. The resulting 3D model is stored as the account-scoped final voxel and may be reopened from Voxel Vault inventory. The original source photo is not embedded in the NFT metadata.</p>
      <h2>Accounts</h2>
      <p>Google sign-in may be used to associate saved property drafts, creation records, and other account-scoped product state with one Voxel Vault identity. The authentication provider and configured backend services process the information required for sign-in and account storage.</p>
      <h2>Payments</h2>
      <p>Paid checkouts are handled through the configured payment provider. Voxel Vault should not store complete card numbers in the application database. Payment-provider records may include transaction identifiers and the minimum metadata needed to verify the purchase.</p>
      <h2>Maps and property context</h2>
      <p>The confirmed address is used to resolve a source-backed building identity and enforce the one-property purchase and one-mint limit. Map data remains conceptually separate from the user’s source photo, generated artwork, and legal ownership records.</p>
      <h2>Wallets and minting</h2>
      <p>A wallet is not required for the core creation flow. If a user explicitly chooses to mint a finished digital voxel, public blockchain transaction information may be visible on the relevant network. Voxel Vault does not ask users to commit private keys or seed phrases to the public repository.</p>
      <h2>Public sharing</h2>
      <p>Items are not meant to become public property claims merely because they appear in World, Vault, metadata, or an NFT. Public-facing coordinates may be reduced or transformed where the product intentionally limits precision.</p>
      <h2>Third-party services</h2>
      <p>Authentication, payment, image generation, 3D generation, map, hosting, blockchain, analytics, or other providers may have their own privacy practices. Only services actually configured on the live deployment should be treated as active.</p>
      <h2>Questions</h2>
      <p>For privacy questions or data-handling concerns, use the project contact route on the About page or open a repository issue without posting passwords, payment credentials, private keys, identity documents, deeds, leases, or other sensitive personal information.</p>
      <div className={styles.links}><Link href="/about">About + contact</Link><Link href="/terms">Terms</Link><Link href="/demo">See public demo</Link></div>
    </section>
  </div></main>;
}
