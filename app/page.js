import Link from 'next/link';
import ProductTopNav from './components/ProductTopNav';
import HomeProductPreview from './components/HomeProductPreview';
import styles from './home.module.css';

export const metadata = { alternates: { canonical: '/' } };

export default function Home() {
  return <main className={styles.page}>
    <ProductTopNav/>
    <div className={styles.shell}>
      <section className={styles.hero}>
        <p className={styles.kicker}>VOXELPOP · PHOTO → 3D VOXEL PHOTO → MOVABLE VOXEL → NFT</p>
        <h1>One photo.<br/><em>One simple flow.</em></h1>
        <p className={styles.heroLine}>Turn a house photo into a high-fidelity 3D voxel photo, approve it, and get a separate movable 3D voxel. Mint only if you want.</p>

        <div className={styles.centerMachine}>
          <HomeProductPreview/>
          <Link className={styles.primaryAction} href="/property">Start VoxelPop · $4.99</Link>
          <Link className={styles.secondaryAction} href="/demo">Try voxel sample · no login</Link>
        </div>

        <div className={styles.quickFacts} aria-label="VoxelPop creation facts">
          <span>3D voxel photo</span>
          <span>Movable 3D voxel</span>
          <span>NFT optional</span>
          <span>No wallet until mint</span>
        </div>
      </section>

      <section className={styles.simpleFlow} aria-label="How VoxelPop works">
        <p className={styles.eyebrow}>VOXELPOP OUTPUT</p>
        <h2>Photo → Create → Done.</h2>
        <div className={styles.steps}>
          <article><i>1</i><b>Photo</b><span>Choose one clear house photo.</span></article>
          <article><i>2</i><b>Create</b><span>Pay $4.99, review the 3D voxel photo, then approve the movable 3D voxel.</span></article>
          <article><i>3</i><b>Done</b><span>Your movable voxel saves to Vault. Optional NFT minting stays separate.</span></article>
        </div>
      </section>

      <section className={styles.truthCard}>
        <b>VoxelPop is a digital creation product.</b>
        <p>A VoxelPop, payment, map marker, or NFT does not create ownership, deed/title, rent, occupancy, investment, appreciation, or other rights in a physical property.</p>
      </section>

      <footer className={styles.footer}>
        <span>VoxelPop by Voxel Vault · digital creations only.</span>
        <span><Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link> · <Link href="/about">About</Link></span>
      </footer>
    </div>
  </main>;
}
