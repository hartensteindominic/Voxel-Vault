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
          <p className={styles.kicker}>VOXELPOP · PHOTO → 3D HOUSE → VOXEL</p>
          <h1>Turn your house photo<br/><em>into a 3D voxel.</em></h1>
          <p className={styles.lead}>Upload one house photo. VoxelPop generates the polished 3D-style house image first, like the NFT-house experience. Approve that image, then create the separate movable voxel. Minting is optional.</p>
          <div className={styles.heroActions}>
            <Link className={styles.primaryAction} href="/property">Create mine · $4.99</Link>
            <Link className={styles.secondaryAction} href="/demo">Try the free 3D demo</Link>
          </div>
          <div className={styles.trustRow} aria-label="VoxelPop creation facts">
            <span>3D house before voxel</span><span>Original not saved by Voxel Vault</span><span>Mint only if you want</span>
          </div>
        </div>
        <div className={styles.heroVisual}><HomeProductPreview/></div>
      </section>

      <section className={styles.flowCard} id="how-it-works" aria-label="VoxelPop creation steps">
        <div className={styles.flowIntro}><p>THE WHOLE FLOW</p><h2>Photo. 3D house. Voxel.</h2></div>
        <div className={styles.microFlow}><b>PHOTO</b><i>→</i><b>VOXELPOP 3D HOUSE</b><i>→</i><b>APPROVE</b><i>→</i><b>3D VOXEL</b></div>
        <Link className={styles.startButton} href="/property">Start my VoxelPop →</Link>
      </section>

      <details className={styles.inclusion}>
        <summary><span><small>AFTER YOU CREATE</small><b>Save it, place it, or mint it later</b></span><i>+</i></summary>
        <div className={styles.afterCreate}>
          <p><b>Vault</b> keeps your finished VoxelPop so you can reopen it later.</p>
          <p><b>World</b> can pair the finished voxel with map and building context.</p>
          <p><b>Mint</b> is optional and comes after the voxel is finished. No wallet is required to create.</p>
          <div className={styles.afterLinks}><Link href="/vault">Open Vault →</Link><Link href="/world">Open World →</Link><Link href="/more">More tools →</Link></div>
        </div>
      </details>

      <details className={styles.inclusion}>
        <summary><span><small>WHAT'S INCLUDED / WHAT'S NOT</small><b>One digital VoxelPop creation · $4.99</b></span><i>+</i></summary>
        <div>
          <p>Sign in, choose a house photo, and complete the $4.99 creation checkout. VoxelPop then uses that authorized photo as a temporary reference to generate the VoxelPop/NFT-house-style 3D image. You approve the generated house before the separate voxel is built.</p>
          <p>The source photo is kept locally for checkout continuity. When the 3D house image is generated, a prepared copy is sent transiently to the configured image-generation provider; Voxel Vault does not save the original photo in its generation storage. The approved generated image becomes the visual source for the local voxel build.</p>
          <p>A one-photo generated render is a visual interpretation. It cannot verify hidden sides, the rear of the building, exact dimensions, parcel boundaries, or other survey-grade facts.</p>
          <p><b>Voxel Vault is not a bank, brokerage, title company, or real-estate marketplace.</b> A VoxelPop item, NFT, map marker, payment, or Property Passport does not create physical-property ownership, rent, occupancy, investment, or appreciation rights.</p>
        </div>
      </details>

      <footer className={styles.footer}><span>Voxel Vault is a digital creation product. Physical-property and regulated financial rights remain separate.</span><span><Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link> · <Link href="/about">About</Link> · <Link href="/demo">3D demo</Link></span></footer>
    </div>
  </main>;
}
