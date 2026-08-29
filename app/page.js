import Link from 'next/link';
import Home3DProof from './components/Home3DProof';
import styles from './home.module.css';

export const metadata = { alternates: { canonical: '/' } };

// One public promise: authorized house photo -> $4.99 digital VoxelPop creation.
// Visitors can inspect the real production viewers before account/payment friction.
// Paid creation remains account-bound and preserves preview -> approval -> voxel -> optional mint.
// Source photos stay device-local in the normal creation flow and no Meshy credits are required.
// A model, map marker, payment, NFT, demo slice, or Property Passport is never a deed.
export default function Home() {
  return <main className={styles.page}>
    <div className={styles.shell}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>VOXELPOP · HOUSE PHOTO → 3D VOXEL</p>
          <h1>Your house photo.<br/><em>Made movable in 3D.</em></h1>
          <p className={styles.lead}>See your photo as a recognizable 3D preview first. Approve it, then build the separate movable voxel.</p>
          <div className={styles.heroActions}>
            <Link className={styles.primaryAction} href="/property">Create my house · $4.99</Link>
            <Link className={styles.secondaryAction} href="/demo">Try 3D demo · no login</Link>
          </div>
          <div className={styles.heroTrust}><span>✓ Photo stays on this device</span><span>✓ No wallet to create</span><span>✓ No Meshy credits in guided creation</span></div>
          <details className={styles.heroDetails}>
            <summary>What’s included / what isn’t</summary>
            <p>One $4.99 creation includes the textured 3D preview, your approval step, and the movable voxel. Minting, World placement, and collection actions are optional. A one-photo creation preserves visible details but does not claim hidden-side or survey-grade accuracy, and no digital item creates physical-property rights.</p>
          </details>
        </div>
        <Home3DProof/>
      </section>

      <section className={styles.flowCard} id="how-it-works" aria-label="VoxelPop creation steps">
        <div className={styles.flowIntro}><p>HOW IT WORKS</p><h2>One clear creation flow.</h2></div>
        <div className={styles.microFlow}><b>PHOTO</b><i>→</i><b>$4.99</b><i>→</i><b>3D PREVIEW</b><i>→</i><b>APPROVE</b><i>→</i><b>VOXEL</b></div>
        <Link className={styles.startButton} href="/property">Start with my photo →</Link>
        <small>After the voxel is complete, <b>World</b>, <b>Vault</b>, and <b>Mint</b> are optional next actions—not required steps.</small>
      </section>

      <section className={styles.destinationSection}>
        <div className={styles.sectionIntro}><p>AFTER CREATION</p><h2>Your voxel has somewhere to go.</h2><span>Preview the interaction, place a finished voxel in map context, or keep your saved creations together. These are destinations, not extra hurdles in the $4.99 build.</span></div>
        <div className={styles.assetGrid}>
          <Link href="/demo" className={`${styles.assetTile} ${styles.vaultTile}`}><div className={styles.tileIcon}>3D</div><small>PUBLIC DEMO</small><strong>Try the real viewer</strong><span>Rotate the textured preview and switch to the separate voxel without signing in.</span><b>Try demo →</b></Link>
          <Link href="/world" className={`${styles.assetTile} ${styles.worldTile}`}><div className={styles.tileIcon}>◎</div><small>WORLD</small><strong>Place it in context</strong><span>Pair a finished voxel with source-backed place and building context when you choose.</span><b>Open World →</b></Link>
          <Link href="/vault" className={`${styles.assetTile} ${styles.moreTile}`}><div className={styles.tileIcon}>◇</div><small>VAULT</small><strong>Keep what you made</strong><span>Saved property sources and VoxelPop creations stay organized together.</span><b>Open Vault →</b></Link>
        </div>
      </section>

      <section className={styles.truthStrip} id="pricing">
        <div><small>PRICE</small><strong>$4.99 · one digital VoxelPop creation</strong></div><span>+</span><div><small>INCLUDED</small><strong>3D preview → approval → movable voxel</strong></div><Link href="/property">Create mine →</Link>
      </section>

      <section className={styles.truthStrip} id="legal">
        <div><small>DIGITAL</small><strong>Photo → 3D preview → voxel → optional NFT</strong></div><span>≠</span><div><small>PHYSICAL PROPERTY</small><strong>Deed / title / rent / regulated investment rights</strong></div><Link href="/terms">Read terms →</Link>
      </section>
    </div>
  </main>;
}
