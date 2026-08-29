import Link from 'next/link';
import styles from './home.module.css';

export const metadata = { alternates: { canonical: '/' } };

const steps = [
  ['01', 'Take a photo', 'Use a clear front or angled exterior photo.'],
  ['02', 'Confirm address', 'Give the building a unique property identity.'],
  ['03', 'Build the voxel', 'Preview the voxel image, then create the movable 3D collectible.'],
  ['04', 'Mint if you want', 'Make the one-of-one collectible on-chain when you are ready.'],
  ['05', 'Keep it in Vault', 'The finished voxel is saved to Inventory first.'],
];

export default function Home() {
  return <main className={styles.page}>
    <header className={styles.topbar}>
      <Link className={styles.brand} href="/">
        <span className={styles.brandMark}>V</span>
        <span>VOXEL VAULT</span>
      </Link>
      <nav className={styles.nav} aria-label="Voxel Vault navigation">
        <Link href="/property">Create</Link>
        <Link href="/vault/property-drafts">Inventory</Link>
      </nav>
    </header>

    <section className={styles.hero}>
      <div className={styles.heroCopy}>
        <p className={styles.eyebrow}>PROPERTY → COLLECTIBLE</p>
        <h1>Turn a real place into a <em>3D voxel.</em></h1>
        <p className={styles.lead}>Take one property photo, confirm the address, watch it become a block-built 3D collectible, then mint it or keep it private in your Voxel Vault.</p>
        <div className={styles.heroActions}>
          <Link className={styles.primary} href="/property">Create a property voxel</Link>
          <Link className={styles.secondary} href="/vault/property-drafts">Open Inventory</Link>
        </div>
        <div className={styles.trustRow}>
          <span>✓ Mobile photo upload</span>
          <span>✓ Unique property lock</span>
          <span>✓ Minting optional</span>
        </div>
      </div>

      <div className={styles.heroVisual} aria-label="Voxel house illustration">
        <div className={styles.skyOrb}/>
        <div className={styles.voxelScene}>
          <div className={styles.plot}/>
          <div className={styles.house}>
            <div className={styles.roof}/>
            <div className={styles.door}/>
            <div className={`${styles.window} ${styles.windowOne}`}/>
            <div className={`${styles.window} ${styles.windowTwo}`}/>
          </div>
          <div className={`${styles.floatingVoxel} ${styles.voxelOne}`}>1</div>
          <div className={`${styles.floatingVoxel} ${styles.voxelTwo}`}>3D</div>
          <div className={`${styles.floatingVoxel} ${styles.voxelThree}`}>✓</div>
        </div>
        <div className={styles.visualLabel}><b>YOUR PROPERTY</b><span>photo → voxel → vault</span></div>
      </div>
    </section>

    <section className={styles.flowSection}>
      <div className={styles.sectionHeading}>
        <p className={styles.eyebrow}>ONE SIMPLE FLOW</p>
        <h2>Five pages. One design. No maze.</h2>
        <p>Each screen asks for one thing and moves you cleanly to the next step.</p>
      </div>
      <div className={styles.steps}>
        {steps.map(([number, title, description], index) => <article className={styles.stepCard} key={title}>
          <div className={styles.stepTop}><span>{number}</span><b>{index < steps.length - 1 ? '→' : '✓'}</b></div>
          <h3>{title}</h3>
          <p>{description}</p>
        </article>)}
      </div>
    </section>

    <section className={styles.featureGrid}>
      <article className={`${styles.featureCard} ${styles.featurePurple}`}>
        <small>PHOTO FIRST</small>
        <h2>Your camera roll is the starting point.</h2>
        <p>iPhone HEIC, JPG, PNG and WebP photos are supported. The original source photo stays on your device.</p>
      </article>
      <article className={`${styles.featureCard} ${styles.featureLime}`}>
        <small>ONE PROPERTY · ONE MINT</small>
        <h2>Every building gets a unique collectible identity.</h2>
        <p>Address confirmation helps prevent duplicate property mints inside Voxel Vault.</p>
      </article>
      <article className={`${styles.featureCard} ${styles.featureDark}`}>
        <small>YOUR INVENTORY</small>
        <h2>Mint now or just keep the voxel.</h2>
        <p>The finished 3D collectible is saved first. Minting is a choice, not a requirement.</p>
      </article>
    </section>

    <section className={styles.finalCta}>
      <div><p className={styles.eyebrow}>READY WHEN YOU ARE</p><h2>Your next property can become a voxel.</h2></div>
      <Link className={styles.primary} href="/property">Start with a photo</Link>
    </section>

    <p style={{ width: 'min(1000px, 100%)', margin: '36px auto 0', color: '#8b8491', fontSize: '10px', lineHeight: 1.6, textAlign: 'center' }}>This collectible is digital only. Saving or minting it does not create or transfer deed, title, equity, occupancy, rent, or other physical-property rights.</p>

    <footer className={styles.footer}>
      <span>Voxel Vault · digital property collectibles</span>
      <span><Link href="/about">About</Link> · <Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link></span>
    </footer>
  </main>;
}
