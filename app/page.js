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
          <p className={styles.kicker}>VOXELPOP · HOUSE PHOTO → 3D VOXEL</p>
          <h1>Make your house<br/><em>feel like a voxel.</em></h1>
          <p className={styles.lead}>Upload one property photo. First, review a photo-matched 3D voxel photo. If it looks right, turn it into the separate movable 3D voxel. Minting comes last and is always optional.</p>
          <div className={styles.heroActions}>
            <Link className={styles.primaryAction} href="/property">Create mine · $4.99</Link>
            <Link className={styles.secondaryAction} href="/demo">See an example</Link>
          </div>
          <div className={styles.trustRow} aria-label="VoxelPop creation facts">
            <span>See it before the voxel model</span><span>Photo stays on your device</span><span>No wallet required to create</span>
          </div>
        </div>
        <div className={styles.heroVisual}><HomeProductPreview/></div>
      </section>

      <section className={styles.flowCard} id="how-it-works" aria-label="VoxelPop creation steps">
        <div className={styles.flowIntro}><p>HOW IT WORKS</p><h2>One photo. Three clear steps.</h2></div>
        <div className={styles.microFlow}>
          <b><small>1</small>UPLOAD + PAY</b><i>→</i>
          <b><small>2</small>REVIEW 3D VOXEL PHOTO</b><i>→</i>
          <b><small>3</small>CREATE MOVABLE VOXEL</b>
        </div>
        <Link className={styles.startButton} href="/property">Start with my photo →</Link>
      </section>

      <section className={styles.promiseGrid} aria-label="What happens after creation">
        <article><span>01</span><b>Approve before the model</b><p>The 3D voxel photo is your checkpoint. If it does not look right, change the source photo before the movable voxel is built.</p></article>
        <article><span>02</span><b>Keep the finished voxel</b><p>Your finished VoxelPop is saved to Vault so you can reopen it later.</p></article>
        <article><span>03</span><b>Mint only if you want</b><p>The NFT step is separate. Creating the voxel does not require a wallet.</p></article>
      </section>

      <details className={styles.inclusion}>
        <summary><span><small>GOOD TO KNOW</small><b>What the $4.99 creation includes</b></span><i>+</i></summary>
        <div>
          <p>The $4.99 purchase is for one digital VoxelPop creation: your selected house photo, a reviewable 3D voxel photo, and the separate movable 3D voxel.</p>
          <p>One photo can only reproduce the visible view. It cannot prove hidden sides, survey dimensions, deed ownership, investment rights, rent rights, or any other physical-property interest.</p>
        </div>
      </details>

      <footer className={styles.footer}><span>Voxel Vault is a digital creation product. Physical-property and regulated financial rights remain separate.</span><span><Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link> · <Link href="/about">About</Link></span></footer>
    </div>
  </main>;
}
