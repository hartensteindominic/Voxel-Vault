import Link from 'next/link';
import ProductTopNav from '../components/ProductTopNav';
import styles from '../legal-page.module.css';

export const metadata = {
  title: 'About',
  description: 'About Voxel Vault and the current VoxelPop house-photo-to-3D-voxel product.',
};

export default function AboutPage() {
  return <main className={styles.page}><ProductTopNav/><div className={styles.shell}>
    <header className={styles.hero}><small>ABOUT VOXELPOP</small><h1>One photo.<br/>One digital voxel.</h1><p>Voxel Vault is building VoxelPop: a privacy-conscious house-photo workflow that lets you inspect a recognizable 3D voxel photo, approve it, and then create the separate movable 3D voxel.</p></header>
    <section className={styles.card}>
      <h2>What the public product is</h2>
      <p>The current consumer promise is intentionally simple: <strong>upload an authorized photo of a house, pay $4.99 for one digital creation, see the 3D voxel photo first, approve it, then build the separate movable 3D voxel.</strong> Vault storage and optional blockchain minting come afterward. Map and World tools are separate extras.</p>
      <h2>What it is not</h2>
      <p>Voxel Vault does not claim that a one-photo creation is a perfect survey-grade replica. A digital VoxelPop creation or NFT is not a deed, title record, rent right, physical-property investment, appraisal, or ownership claim.</p>
      <h2>Why the photo stays local</h2>
      <p>The core creation flow is designed to process the source house image in the browser. That keeps the original photo out of public NFT metadata and reduces the need to maintain a central property-photo archive just to generate the local 3D experience.</p>
      <h2>Project status</h2>
      <p>Voxel Vault is an actively developed software project. The repository also contains research, testnet, provider-gated, and experimental systems that are intentionally kept outside the main VoxelPop flow unless their real dependencies and legal requirements are satisfied.</p>
      <h2>Contact and feedback</h2>
      <p>For product bugs, feedback, or public technical questions, use the GitHub repository issue tracker. Do not post passwords, private keys, seed phrases, card information, identity documents, private deeds or leases, tenant information, or other sensitive personal data in a public issue.</p>
      <div className={styles.links}><a href="https://github.com/hartensteindominic/Voxel-Vault/issues" target="_blank" rel="noreferrer">Open GitHub issues ↗</a><Link href="/demo">See public demo</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></div>
    </section>
  </div></main>;
}
