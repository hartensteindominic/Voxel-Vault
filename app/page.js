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
        <p className={styles.kicker}>ONE PHOTO → ONE VOXEL</p>
        <h1><em>VOXELPOP</em></h1>
        <p className={styles.heroLine}>Upload a property photo. Approve the 3D voxel photo. Your movable voxel is built and saved.</p>

        <div className={styles.centerMachine}>
          <HomeProductPreview/>
          <Link className={styles.primaryAction} href="/property">Create mine · $4.99</Link>
          <p className={styles.microCopy}>Saved to Vault automatically · NFT optional · no wallet needed to create</p>
        </div>

        <div className={styles.simpleSteps} aria-label="VoxelPop creation flow">
          <div><i>1</i><span><b>Choose photo</b><small>Pick one clear house photo.</small></span></div>
          <div><i>2</i><span><b>Approve</b><small>Check the 3D voxel photo.</small></span></div>
          <div><i>3</i><span><b>Done</b><small>Rotate your voxel. It is saved.</small></span></div>
        </div>
      </section>

      <section className={styles.truthCard}>
        <div><b>Simple by design.</b><span>Photo → review → movable voxel → saved.</span></div>
        <p>VoxelPop creates a digital asset only. It does not create or transfer ownership, deed/title, rent, occupancy, investment, appreciation, or other rights in a physical property.</p>
      </section>

      <footer className={styles.footer}>
        <span>VoxelPop by Voxel Vault · digital creations only.</span>
        <span><Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link> · <Link href="/about">About</Link></span>
      </footer>
    </div>
  </main>;
}
