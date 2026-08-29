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
          <p className={styles.kicker}>VOXELPOP · ONE HOUSE PHOTO · $4.99</p>
          <h1>See your house<br/><em>as a VoxelPop 3D house.</em></h1>
          <p className={styles.lead}>Choose one house photo, pay once, and VoxelPop generates the polished NFT-house-style 3D image first. Compare and approve that generated house, then build the separate movable 3D voxel.</p>
          <div className={styles.heroActions}>
            <Link className={styles.primaryAction} href="/property">Create my VoxelPop · $4.99</Link>
            <Link className={styles.secondaryAction} href="/demo">Try the free demo</Link>
          </div>
          <div className={styles.trustRow} aria-label="VoxelPop creation facts">
            <span>Generated 3D house first</span><span>Original not saved by Voxel Vault</span><span>No wallet to create</span>
          </div>
        </div>
        <div className={styles.heroVisual}><HomeProductPreview/></div>
      </section>

      <section className={styles.flowCard} id="how-it-works" aria-label="VoxelPop creation steps">
        <div className={styles.flowIntro}><p>THE PRODUCT</p><h2>One simple creation flow.</h2></div>
        <div className={styles.microFlow}><b>1 · PHOTO</b><i>→</i><b>2 · VOXELPOP 3D HOUSE</b><i>→</i><b>3 · MOVABLE VOXEL</b><i>→</i><b>4 · SAVE / OPTIONAL MINT</b></div>
      </section>

      <details className={styles.inclusion}>
        <summary><span><small>WHAT'S INCLUDED / WHAT'S NOT</small><b>Your complete digital VoxelPop creation · $4.99</b></span><i>+</i></summary>
        <div>
          <p>Sign in, choose a house photo, confirm you can use it, and complete one $4.99 checkout. VoxelPop uses the authorized photo as a temporary visual reference to generate the VoxelPop/NFT-house-style 3D image. You approve that generated house before the movable voxel is created.</p>
          <p>The source photo is kept locally for checkout continuity. When you generate the 3D house image, a prepared copy is sent transiently to the configured image-generation provider; Voxel Vault does not save the original photo in its generation storage. The approved generated image becomes the visual source for the local voxel build.</p>
          <p>A one-photo generated render is a visual interpretation. It cannot verify hidden sides, the rear of the building, exact dimensions, parcel boundaries, or other survey-grade facts.</p>
          <p>The finished voxel can be saved in Vault. Minting is optional and comes afterward; you do not need a wallet to create.</p>
        </div>
      </details>

      <details className={styles.inclusion}>
        <summary><span><small>AFTER CREATION</small><b>Keep it simple—or explore more later</b></span><i>+</i></summary>
        <div className={styles.afterCreate}>
          <p><b>Vault</b> keeps your finished digital VoxelPop. <b>World</b> can add map context later. <b>Mint</b> is optional and represents only the finished digital voxel.</p>
          <div className={styles.afterLinks}><Link href="/vault">Open Vault →</Link><Link href="/world">Open World →</Link></div>
        </div>
      </details>

      <footer className={styles.footer}><span>Voxel Vault is a digital creation product. A VoxelPop, map marker, payment, or NFT does not create ownership or financial rights in a physical property.</span><span><Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link> · <Link href="/about">About</Link></span></footer>
    </div>
  </main>;
}
