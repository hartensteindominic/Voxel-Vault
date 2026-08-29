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
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>VOXELPOP · PHOTO → 3D VOXEL PHOTO → MOVABLE VOXEL</p>
          <h1>Turn your house photo<br/><em>into a 3D voxel photo.</em></h1>
          <p className={styles.lead}>Upload one house photo and VoxelPop rebuilds the visible photo as a block-by-block 3D voxel photo. Approve it, then create the separate movable 3D voxel. Minting is optional.</p>
          <div className={styles.heroActions}>
            <Link className={styles.primaryAction} href="/property">Create mine · $4.99</Link>
            <Link className={styles.secondaryAction} href="/demo">Try the free voxel demo</Link>
          </div>
          <div className={styles.trustRow} aria-label="VoxelPop creation facts">
            <span>Voxel photo before model</span><span>Photo stays on device</span><span>Mint only if you want</span>
          </div>
        </div>
        <div className={styles.heroVisual}><HomeProductPreview/></div>
      </section>

      <section className={styles.flowCard} id="how-it-works" aria-label="VoxelPop creation steps">
        <div className={styles.flowIntro}><p>THE WHOLE FLOW</p><h2>Photo. Voxel photo. Movable voxel.</h2></div>
        <div className={styles.microFlow}><b>PHOTO</b><i>→</i><b>3D VOXEL PHOTO</b><i>→</i><b>APPROVE</b><i>→</i><b>MOVABLE 3D VOXEL</b></div>
        <Link className={styles.startButton} href="/property">Start my VoxelPop →</Link>
      </section>

      <details className={styles.inclusion}>
        <summary><span><small>AFTER YOU CREATE</small><b>Save it, place it, or mint it later</b></span><i>+</i></summary>
        <div className={styles.afterCreate}>
          <p><b>Vault</b> keeps your finished VoxelPop so you can reopen it later.</p>
          <p><b>World</b> can pair the finished voxel with map and building context.</p>
          <p><b>Mint</b> is optional and comes after the movable voxel is finished. No wallet is required to create.</p>
          <div className={styles.afterLinks}><Link href="/vault">Open Vault →</Link><Link href="/world">Open World →</Link><Link href="/more">More tools →</Link></div>
        </div>
      </details>

      <details className={styles.inclusion}>
        <summary><span><small>WHAT YOU'RE BUYING</small><b>One digital VoxelPop creation · $4.99</b></span><i>+</i></summary>
        <div>
          <p>Sign in, choose a house photo, and complete the $4.99 creation checkout. You then see the 3D voxel photo before the separate movable voxel is built.</p>
          <p>Your source photo stays on your device in the normal creation flow. One photo can represent the visible view, but it cannot prove hidden sides or survey-grade dimensions.</p>
          <p><b>Voxel Vault is not a bank, brokerage, title company, or real-estate marketplace.</b> A VoxelPop item, NFT, map marker, payment, or Property Passport does not create physical-property ownership, rent, occupancy, investment, or appreciation rights.</p>
        </div>
      </details>

      <footer className={styles.footer}><span>Voxel Vault is a digital creation product. Physical-property and regulated financial rights remain separate.</span><span><Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link> · <Link href="/about">About</Link> · <Link href="/demo">Voxel demo</Link></span></footer>
    </div>
  </main>;
}