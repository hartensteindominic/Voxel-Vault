import Link from 'next/link';
import styles from '../legal.module.css';

export const metadata = {
  title: 'Privacy · Voxel Vault',
  description: 'How Voxel Vault handles account, device-local property photos, payments, map data, digital assets and optional third-party tools.',
};

export default function PrivacyPage() {
  return <main className={styles.page}><div className={styles.shell}>
    <div className={styles.top}><Link className={styles.back} href="/">← Voxel Vault</Link><nav><Link href="/demo">Demo</Link><Link href="/about">About + Support</Link><Link href="/terms">Terms</Link></nav></div>

    <header className={styles.hero}><small>PRIVACY</small><h1>Privacy should match the product.</h1><p>Last updated August 29, 2026.</p></header>
    <div className={styles.notice}><b>Core VoxelPop property creation:</b> the normal property flow is designed to keep the source photo on your device through checkout and local creation. It does not require Meshy generation credits or a private checkout-photo bucket.</div>

    <section className={styles.section}><h2>Account and sign-in</h2><p>Voxel Vault may use an account provider such as Google through Supabase authentication to keep your paid creation, World and Vault records associated with the correct account. Account identifiers and basic profile information supplied by that provider may be processed for sign-in and account syncing.</p></section>

    <section className={styles.section}><h2>Your property photo</h2><p>In the current core Property flow, the authorized source photo is kept in browser/device storage so it can survive the payment redirect and be used for local visual creation. The source photo is not intended to be uploaded to Meshy for the normal property-generation path. Derived digital model recipes, previews, IDs or account records may be saved separately when needed to reopen or sync your creation.</p></section>

    <section className={styles.section}><h2>Payments</h2><p>Stripe handles checkout and payment processing for paid VoxelPop creation and other explicit purchases. Voxel Vault may receive transaction identifiers, purchase status, price, account linkage and limited billing metadata needed to verify and fulfill a purchase. Card details are handled by Stripe rather than stored in the public Voxel Vault codebase.</p></section>

    <section className={styles.section}><h2>Addresses, map data and World</h2><p>When you enter an address or use location-based features, Voxel Vault may send the requested location to map/geocoding services to find source-backed place or building data. Saved World records may include location and map references. Public World sharing is separate from private account use and is designed to avoid publishing exact private coordinates by default.</p></section>

    <section className={styles.section}><h2>Analytics</h2><p>Voxel Vault may use privacy-minimized first-party funnel analytics for events such as page visits, checkout starts, completed payments and successful creation stages. Campaign attribution such as UTM source, medium or campaign may be recorded. Analytics should not be used as a place to store private property photos, payment-card data, passwords, private keys or identity documents.</p></section>

    <section className={styles.section}><h2>Optional tools and third parties</h2><p>Some optional routes can involve wallet providers, blockchain networks, hosting, storage, marketplace services, AI tools, investment providers or other integrations. Those optional tools are separate from the normal local Property creation path and may have their own privacy policies and data handling. Voxel Vault should request only the providers needed for the feature you choose to use.</p></section>

    <section className={styles.section}><h2>Local and account records</h2><p>Some creations and demo records may remain in browser storage until you clear site data or replace them. Account-linked purchases and digital-asset records may be retained as needed to restore purchases, keep account history, prevent duplicate fulfillment, meet transaction-record obligations or operate the service. Do not place passwords, private keys, card numbers, identity documents, private deeds, leases or other unnecessary sensitive information into public fields or token metadata.</p></section>

    <section className={styles.section}><h2>Your choices</h2><ul><li>You can decline optional wallet and location connections.</li><li>You can clear local browser/site data from your browser settings.</li><li>You can keep a World item private instead of sharing it publicly.</li><li>For public product bugs, use the support path on the <Link href="/about">About + Support</Link> page and do not include sensitive information.</li></ul></section>

    <footer className={styles.footer}><span>This notice describes the current product architecture and may change as features or providers change.</span><nav><Link href="/terms">Terms</Link><Link href="/about">About + Support</Link><a href="https://github.com/hartensteindominic/Voxel-Vault">GitHub</a></nav></footer>
  </div></main>;
}
