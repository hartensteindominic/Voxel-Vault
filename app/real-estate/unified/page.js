import Link from 'next/link';
import PropertyTwinCanvas from '../PropertyTwinCanvas';
import UnifiedVault from './UnifiedVault';
import styles from './unified.module.css';

export const metadata = {
  title: 'Unified Property Wallet | Voxel Vault',
  description: 'Simulation-first 3D property, USD, crypto and optional NFT wallet prototype.',
};

export default function UnifiedPropertyWalletPage() {
  return (
    <main className={styles.page}>
      <nav className={styles.topbar}>
        <Link href="/" className={styles.brand}>VOXEL VAULT</Link>
        <div className={styles.navLinks}>
          <Link href="/geo">Property</Link>
          <Link href="/studio">Create</Link>
          <Link href="/vault">Vault</Link>
          <Link href="/real-estate/launch">Launch gates</Link>
        </div>
      </nav>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <div className={styles.kicker}>3D PROPERTY + USD + CRYPTO + OPTIONAL NFT</div>
          <h1>One vault.<br/><em>Every kind of value.</em></h1>
          <p>
            Test a $1.99 digital-property anchor, compare other properties against it,
            hold the result beside USD and crypto, and preview asset conversion in one simple interface.
          </p>
          <div className={styles.heroPills}>
            <span>● SANDBOX</span>
            <span>$1.99 ANCHOR</span>
            <span>NFT OPTIONAL</span>
            <span>NO LIVE CUSTODY</span>
          </div>
        </div>

        <div className={styles.twinCard}>
          <PropertyTwinCanvas style={{ width: '100%', height: '100%' }} />
          <div className={styles.twinTop}>3D DIGITAL PROPERTY</div>
          <div className={styles.twinBottom}>
            <div><small>PROPERTY TWIN</small><b>Explore → price → test buy</b></div>
            <span>VOXELPOP</span>
          </div>
        </div>
      </section>

      <UnifiedVault />

      <section className={styles.boundary}>
        <div>
          <b>Digital property unit</b>
          <p>The $1.99-relative unit is a sandbox digital collectible/record. It is not a deed, equity share, rent right or promise of appreciation.</p>
        </div>
        <div>
          <b>USD account</b>
          <p>Live deposits, ACH, cards and withdrawals must be provided by an appropriately regulated financial partner. Voxel Vault itself is not presented as an FDIC-insured bank.</p>
        </div>
        <div>
          <b>Crypto + conversion</b>
          <p>Live customer custody, exchange and cash-out stay disabled until the licensed provider, identity checks, transaction controls and settlement records are connected.</p>
        </div>
        <div>
          <b>Real-property ownership</b>
          <p>A real property interest only appears after the separate legal offering/title path verifies what rights actually exist. Minting alone never creates those rights.</p>
        </div>
      </section>
    </main>
  );
}
