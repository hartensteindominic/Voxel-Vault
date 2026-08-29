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
          <p className={styles.kicker}>VOXELPOP · ONE PHOTO → TWO 3D RESULTS</p>
          <h1>See your house<br/><em>as a voxel.</em></h1>
          <p className={styles.lead}>Start with one authorized house photo. First, compare a 3D voxel photo against the original. Approve it, then VoxelPop builds the separate movable voxel.</p>
          <div className={styles.heroActions}>
            <Link className={styles.primaryAction} href="/property">Create my VoxelPop · $4.99</Link>
            <Link className={styles.secondaryAction} href="/demo">See the free demo</Link>
          </div>
          <div className={styles.trustRow} aria-label="VoxelPop creation facts">
            <span>Preview before model</span><span>$4.99 total creation</span><span>No wallet required</span>
          </div>
        </div>
        <div className={styles.heroVisual}><HomeProductPreview/></div>
      </section>

      <section className={styles.flowCard} id="how-it-works" aria-label="VoxelPop creation steps">
        <div className={styles.flowIntro}>
          <p>HOW IT WORKS</p>
          <h2>One simple creation flow.</h2>
        </div>
        <div className={styles.steps}>
          <div><span>1</span><b>Choose photo</b><small>Use a clear front or three-quarter view.</small></div>
          <div><span>2</span><b>Review voxel photo</b><small>Compare the 3D voxelized view to your original.</small></div>
          <div><span>3</span><b>Create movable voxel</b><small>Approve the look, then build the interactive model.</small></div>
          <div><span>4</span><b>Save or mint</b><small>Your Vault is included. Minting stays optional.</small></div>
        </div>
        <Link className={styles.startButton} href="/property">Start with my photo →</Link>
      </section>

      <section className={styles.infoGrid} aria-label="VoxelPop product details">
        <article>
          <small>WHAT YOU GET</small>
          <b>One digital VoxelPop creation</b>
          <p>Your $4.99 creation includes the voxel-photo review stage and the finished movable 3D voxel.</p>
        </article>
        <article>
          <small>PRIVATE BY DEFAULT</small>
          <b>Your source photo stays on your device</b>
          <p>The normal creation flow does not store your original source photo on Voxel Vault servers.</p>
        </article>
        <article>
          <small>BLOCKCHAIN IS OPTIONAL</small>
          <b>Create first. Mint only if you want.</b>
          <p>No wallet is required to make or save your VoxelPop. Minting happens only after the voxel is finished.</p>
        </article>
      </section>

      <details className={styles.inclusion}>
        <summary><span><small>IMPORTANT</small><b>What a VoxelPop does — and does not — represent</b></span><i>+</i></summary>
        <div>
          <p>A VoxelPop is a digital creation based on the visible view in your photo. One photo cannot prove hidden sides, survey-grade dimensions, title, deed, occupancy, rent, investment value, or other rights in a physical property.</p>
          <p><b>Voxel Vault is not a bank, brokerage, title company, or real-estate marketplace.</b> A VoxelPop item, NFT, map marker, payment, or Property Passport does not create physical-property ownership or financial rights.</p>
        </div>
      </details>

      <footer className={styles.footer}><span>Voxel Vault stores and organizes digital VoxelPop creations. Physical-property and regulated financial rights remain separate.</span><span><Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link> · <Link href="/about">About</Link> · <Link href="/demo">Free demo</Link></span></footer>
    </div>
  </main>;
}
