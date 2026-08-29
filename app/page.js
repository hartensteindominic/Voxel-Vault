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
        <p className={styles.kicker}>VOXELPOP · PHOTO → 3D → VOXEL → NFT</p>
        <h1><em>VOXELPOP</em></h1>
        <p className={styles.heroLine}>Turn your property photo into a 3D preview, then a movable 3D voxel, then mint that finished voxel as an NFT if you want.</p>

        <div className={styles.centerMachine}>
          <div className={styles.machineLabel}><span>●</span> VOXELPOP CREATOR</div>
          <HomeProductPreview/>
          <div className={styles.heroActions}>
            <Link className={styles.primaryAction} href="/property">Start VoxelPop · $4.99</Link>
            <Link className={styles.secondaryAction} href="/demo">Try 3D sample · no login</Link>
          </div>
        </div>

        <div className={styles.pipeline} aria-label="VoxelPop creation flow">
          <div><i>1</i><b>Photo</b><small>Use your house or saved property image.</small></div>
          <span>→</span>
          <div><i>2</i><b>3D Preview</b><small>Inspect the 3D result before voxeling.</small></div>
          <span>→</span>
          <div><i>3</i><b>3D Voxel</b><small>Create the movable VoxelPop model.</small></div>
          <span>→</span>
          <div><i>4</i><b>NFT</b><small>Optional mint after the voxel is finished.</small></div>
        </div>

        <div className={styles.trustRow} aria-label="VoxelPop creation facts">
          <span>3D first</span>
          <span>Voxel second</span>
          <span>NFT optional</span>
          <span>No wallet until mint</span>
        </div>
      </section>

      <section className={styles.flowCard} id="how-it-works" aria-label="How VoxelPop works">
        <div className={styles.flowHeading}>
          <p>THE VOXELPOP FLOW</p>
          <h2>One centered creator. Four clear stages.</h2>
          <span>Your finished NFT represents the digital voxel only. Minting never changes ownership of the physical property.</span>
        </div>
        <div className={styles.flowSteps}>
          <div><i>1</i><b>Choose photo</b><small>Upload a clear property image or reuse one already saved in your Vault.</small></div>
          <div><i>2</i><b>Build 3D preview</b><small>See the 3D photo-based result before the voxel conversion starts.</small></div>
          <div><i>3</i><b>Voxel it</b><small>Approve the preview, then create the separate movable 3D voxel.</small></div>
          <div><i>4</i><b>Mint if you want</b><small>Save it normally or mint the completed digital voxel as an NFT.</small></div>
        </div>
        <Link className={styles.startButton} href="/property">Open VoxelPop Creator →</Link>
      </section>

      <section className={styles.valueSection} aria-label="What VoxelPop creates">
        <div className={styles.sectionTitle}><p>VOXELPOP OUTPUT</p><h2>3D first. Voxel second. NFT last.</h2></div>
        <div className={styles.valueGrid}>
          <article><span>01</span><b>3D preview</b><p>A photo-based 3D view you can inspect before converting it into the final voxel model.</p></article>
          <article><span>02</span><b>Movable 3D voxel</b><p>The finished interactive VoxelPop asset you can rotate, save, reopen, and keep in your Vault.</p></article>
          <article><span>03</span><b>Optional NFT</b><p>Mint the finished digital voxel only when you choose. The wallet step stays out of the creation flow until then.</p></article>
        </div>
      </section>

      <section className={styles.truthCard}>
        <div><b>VoxelPop stays in the middle.</b><span>Photo → 3D → Voxel → optional NFT.</span></div>
        <p>VoxelPop is a digital creation product. A VoxelPop, payment, map marker, or NFT does not create ownership, deed/title, rent, occupancy, investment, appreciation, or other rights in a physical property.</p>
      </section>

      <footer className={styles.footer}>
        <span>VoxelPop by Voxel Vault · digital creations only.</span>
        <span><Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link> · <Link href="/about">About</Link></span>
      </footer>
    </div>
  </main>;
}
