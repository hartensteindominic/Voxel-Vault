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
          <p className={styles.kicker}>YOUR HOUSE PHOTO → 3D PICTURE → VOXEL</p>
          <h1>Your house,<br/><em>made 3D.</em></h1>
          <p className={styles.lead}>Upload a house photo and pay $4.99 once. First, review a recognizable 3D picture. Only after you approve it does VoxelPop build the separate movable voxel.</p>
          <div className={styles.heroActions}>
            <Link className={styles.primaryAction} href="/property">Create from photo · $4.99</Link>
            <Link className={styles.secondaryAction} href="/demo">Try free 3D demo</Link>
          </div>
          <div className={styles.trustRow} aria-label="VoxelPop creation facts">
            <span>One $4.99 creation</span><span>Photo stays on device</span><span>Minting is optional</span>
          </div>
        </div>
        <div className={styles.heroVisual}><HomeProductPreview/></div>
      </section>

      <section className={styles.flowCard} id="how-it-works" aria-label="VoxelPop creation steps">
        <div className={styles.flowIntro}><p>THE CREATION</p><h2>See it first. Approve it. Voxelize it.</h2></div>
        <div className={styles.microFlow}><b>PHOTO</b><i>→</i><b>$4.99</b><i>→</i><b>3D PICTURE</b><i>→</i><b>APPROVE</b><i>→</i><b>3D VOXEL</b><i>→</i><b>SAVE / MINT</b></div>
        <Link className={styles.startButton} href="/property">Start with my house photo →</Link>
      </section>

      <section className={styles.destinationSection}>
        <div className={styles.sectionIntro}><p>WHAT YOU GET</p><h2>One simple creation, three clear results.</h2><span>No real-estate jargon is required to use VoxelPop. The main product is the visual creation itself; maps, World, and other advanced tools stay secondary.</span></div>
        <div className={styles.assetGrid}>
          <Link href="/demo" className={`${styles.assetTile} ${styles.worldTile}`}><div className={styles.tileIcon}>◉</div><small>1 · 3D PICTURE</small><strong>Recognize your house first</strong><span>Your original photo remains visually intact while depth, perspective, lighting, and shadow make it inspectable in 3D.</span><b>Try the sample →</b></Link>
          <Link href="/property" className={`${styles.assetTile} ${styles.vaultTile}`}><div className={styles.tileIcon}>▦</div><small>2 · 3D VOXEL</small><strong>Voxelize only after approval</strong><span>Approve the 3D picture, then VoxelPop creates a separate movable block-style version from the same house photo.</span><b>Create mine →</b></Link>
          <Link href="/vault" className={`${styles.assetTile} ${styles.moreTile}`}><div className={styles.tileIcon}>◇</div><small>3 · SAVE OR MINT</small><strong>Keep it without minting</strong><span>The finished voxel is saved to Vault. Minting is optional and only asks for a wallet when you choose it.</span><b>Open Vault →</b></Link>
        </div>
      </section>

      <details className={styles.inclusion}>
        <summary><span><small>WHAT'S INCLUDED / WHAT'S NOT</small><b>Simple product boundaries</b></span><i>+</i></summary>
        <div>
          <p><b>START → SIGN IN + CHOOSE A HOUSE PHOTO.</b> Nothing is charged before you confirm the photo and continue to checkout.</p>
          <p>One VoxelPop creation costs <b>$4.99</b>. After payment, you see the 3D picture first. The separate voxel is not built until you approve that picture.</p>
          <p>Your source photo stays on your device during the normal creation flow. No wallet is required to create or save the finished voxel, and minting remains optional.</p>
          <p>A one-photo model can preserve the visible side of the house, but it cannot claim to reconstruct hidden sides or survey-grade dimensions.</p>
          <p><b>Voxel Vault is not a bank, deed registry, or investment product.</b> A voxel, NFT, map marker, payment, or Property Passport does not create physical-property ownership, rent, occupancy, investment, or appreciation rights.</p>
        </div>
      </details>

      <footer className={styles.footer}><span>Voxel Vault is a digital creation product. Physical-property rights and regulated financial products are separate workflows.</span><span><Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link> · <Link href="/about">About</Link> · <Link href="/demo">3D demo</Link></span></footer>
    </div>
  </main>;
}
