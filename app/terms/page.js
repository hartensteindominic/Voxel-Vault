import Link from 'next/link';
import styles from '../legal.module.css';

export const metadata = {
  title: 'Terms · Voxel Vault',
  description: 'Terms for VoxelPop digital property creation, mapping, Vault, optional minting and provider-gated advanced tools.',
};

export default function TermsPage() {
  return <main className={styles.page}><div className={styles.shell}>
    <div className={styles.top}><Link className={styles.back} href="/">← Voxel Vault</Link><nav><Link href="/demo">Demo</Link><Link href="/about">About + Support</Link><Link href="/privacy">Privacy</Link></nav></div>

    <header className={styles.hero}><small>TERMS</small><h1>Digital creation, clearly defined.</h1><p>Last updated August 29, 2026.</p></header>
    <div className={styles.notice}><b>Simple rule:</b> paying for, saving, mapping, collecting or minting a VoxelPop item does not buy the physical house or land and does not create deed/title, rent, occupancy, investment or appreciation rights.</div>

    <section className={styles.section}><h2>The $4.99 VoxelPop creation</h2><p>The current core Property product charges $4.99 for one digital VoxelPop creation. The intended sequence is photo → paid creation → 3D preview → user review → movable voxel → World/Vault → optional mint. A verified paid session may resume the same creation without requiring a second creation payment.</p></section>

    <section className={styles.section}><h2>Your photo and content rights</h2><p>You must have the right to use any photo or content you submit. Do not upload private or sensitive material you do not have permission to process. You remain responsible for the content you choose to use and for complying with applicable law and third-party rights.</p></section>

    <section className={styles.section}><h2>3D quality and accuracy</h2><p>VoxelPop is a digital visual-creation product, not a survey, architectural measurement service or guaranteed physical replica. A single photo can guide visible appearance but cannot establish unseen sides, exact dimensions, structural condition, legal boundaries, ownership, title or property value. Map data can add source-backed place/building context, but map geometry is a separate evidence layer from the visual creation.</p></section>

    <section className={styles.section}><h2>World and Vault</h2><p>World and Vault organize digital models, purchased digital items, map references and account-linked records. A saved location, mapped footprint, account record or wallet holding is not a county deed, title record or proof of physical-property ownership unless a separate legal process independently establishes that right.</p></section>

    <section className={styles.section}><h2>Optional minting and digital collectibles</h2><p>Minting is optional and occurs only after the digital voxel is ready. Blockchain transactions may be irreversible and can involve network fees or wallet-provider risks. A minted token can represent the digital item defined by its contract and metadata; it does not automatically represent the physical property, property equity, rent rights or a regulated investment.</p></section>

    <section className={styles.section}><h2>Demo and sandbox features</h2><p>The public 3D demo uses synthetic sample content. The $1.99 Property Sandbox uses demo credit and hypothetical comparison math. Demo balances are not deposits, cash, investment accounts or payment instruments and create no property rights.</p></section>

    <section className={styles.section}><h2>Advanced financial and real-estate tools</h2><p>Investment, custody, exchange, banking, lease, income and real-property workflows are separate from the core VoxelPop creator. Any regulated or real-property action must remain unavailable unless the specific approved provider, eligibility, disclosure, settlement, verification and legal requirements for that action are actually satisfied. Voxel Vault does not claim to be a bank, broker, exchange, custodian, escrow service or deed registry.</p></section>

    <section className={styles.section}><h2>Third-party services</h2><p>Sign-in, payments, hosting, maps, wallets, blockchains and optional integrations can depend on third-party services. Availability, processing time, fees and service continuity may be outside Voxel Vault’s control. Review the information shown by a provider before authorizing a transaction.</p></section>

    <section className={styles.section}><h2>Changes</h2><p>Voxel Vault is evolving. Features and these terms may change as the product is simplified, providers change or legal requirements are clarified. The current version will be published on this page.</p></section>

    <footer className={styles.footer}><span>These terms are intended to keep the digital product and physical-property/legal layers distinct.</span><nav><Link href="/privacy">Privacy</Link><Link href="/about">About + Support</Link><a href="https://github.com/hartensteindominic/Voxel-Vault">GitHub</a></nav></footer>
  </div></main>;
}
