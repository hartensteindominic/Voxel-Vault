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
        <p className={styles.heroLine}>House photo in. Confirm the address. Approve the 3D voxel photo, then get the movable voxel.</p>

        <div className={styles.centerMachine}>
          <HomeProductPreview/>
          <Link className={styles.primaryAction} href="/property">Create mine · $4.99</Link>
          <p className={styles.microCopy}>Saved to Vault automatically · Your movable voxel is built and saved. · NFT optional · no wallet needed to create</p>
        </div>

        <div className={styles.simpleSteps} aria-label="VoxelPop house steps">
          <div><i>1</i><span><b>Photo</b><small>Upload one clear house photo.</small></span></div>
          <div><i>2</i><span><b>Address</b><small>Confirm the property address.</small></span></div>
          <div><i>3</i><span><b>Voxel</b><small>Approve the voxel image and 3D build.</small></span></div>
          <div><i>4</i><span><b>Keep</b><small>Saved to your Vault inventory.</small></span></div>
          <div><i>5</i><span><b>Mint</b><small>Mint the one-of-one NFT only if you want.</small></span></div>
        </div>
      </section>

      <section className={styles.truthCard}>
        <div><b>VoxelPop creates a digital asset only.</b><span>One confirmed property can have one VoxelPop collectible.</span></div>
        <p>VoxelPop does not create or transfer ownership, deed/title, rent, occupancy, investment, appreciation, or other rights in a physical property.</p>
      </section>

      <footer className={styles.footer}>
        <span>VoxelPop</span>
        <span><Link href="/demo">Demo</Link> · <Link href="/about">About</Link> · <Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link></span>
      </footer>
    </div>
  </main>;
}
