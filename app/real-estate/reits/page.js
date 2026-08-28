import styles from '../real-estate.module.css';
import DigitalReitDashboard from './DigitalReitDashboard';
import ReitVaultCanvas from './ReitVaultCanvas';
import { getDigitalReitSnapshot } from '../../../lib/real-estate/dinari';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Digital REIT Vault | Voxel Vault',
  description: 'Spatial provider-backed tokenized real-estate securities, provider positions, dividends, sandbox testing and an owner-gated live investment path inside Voxel Vault.',
};

export default async function DigitalReitPage() {
  const snapshot = await getDigitalReitSnapshot(process.env);
  const status = snapshot.environment === 'live'
    ? snapshot.productionTradingEnabled
      ? 'LIVE CONFIGURED · OWNER VERIFY'
      : 'LIVE · LOCKED'
    : 'SANDBOX';

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <nav className={styles.nav}>
          <a className={styles.brand} href="/"><span className={styles.brandMark}>V</span>Voxel Vault</a>
          <div className={styles.navActions}>
            <span className={styles.statusPill}><span className={styles.statusDot} />DIGITAL REIT VAULT · {status}</span>
            <a className={styles.ghostPill} href="/admin/digital-reits/live">Owner live investing</a>
            <a className={styles.ghostPill} href="/real-estate/acquire">Acquisition engine</a>
            <a className={styles.ghostPill} href="/real-estate/invest">Capital simulator</a>
          </div>
        </nav>

        <section className={styles.hero} style={{gridTemplateColumns:'minmax(0,1fr)'}}>
          <div style={{maxWidth:940}}>
            <p className={styles.eyebrow}>Stage 1 · regulated tokenized real-estate securities</p>
            <h1>Digital REITs,<br /><em>inside the vault.</em></h1>
            <p className={styles.lead}>
              Voxel Vault combines a spatial portfolio with a provider-backed tokenized-securities layer. The REIT district uses the same Dinari snapshot as the financial dashboard: provider-confirmed assets become buildings, and only positions actually returned by the configured provider account are shown as held.
            </p>
            <div className={styles.actions}>
              <a className={styles.primaryButton} href="#spatial-vault">Enter My Vault</a>
              <a className={styles.secondaryButton} href="#vault">Open financial view</a>
              <a className={styles.secondaryButton} href="/admin/digital-reits/live">Owner live console</a>
              <a className={styles.secondaryButton} href="/real-estate/launch">Direct-property launch gates</a>
            </div>
            <div className={styles.heroNote}>
              <span>Dinari integration.</span>
              <span>Spatial portfolio.</span>
              <span>Provider-backed holdings only.</span>
              <span>{snapshot.productionTradingImplementationReady ? 'Live execution code present; external/provider gates still required.' : 'Production execution code locked.'}</span>
            </div>
          </div>
        </section>

        <section id="spatial-vault" className={styles.section} style={{paddingTop:24}}>
          <div style={{display:'flex',justifyContent:'space-between',gap:16,alignItems:'end',flexWrap:'wrap',marginBottom:14}}>
            <div>
              <p className={styles.eyebrow}>My Vault · spatial portfolio</p>
              <h2 style={{fontSize:'clamp(2.2rem,5vw,4.4rem)',lineHeight:.92,letterSpacing:'-.065em',margin:'6px 0 0'}}>Your real-estate exposure,<br />built into a 3D district.</h2>
            </div>
            <div style={{maxWidth:430,fontSize:12,lineHeight:1.65,color:'#95a18f'}}>
              Bright buildings represent provider-reported holdings. Dark buildings are browseable provider-confirmed assets or, before connection, clearly labeled watchlist previews. The 3D view never invents ownership.
            </div>
          </div>
          <ReitVaultCanvas
            assets={snapshot.catalog}
            positions={snapshot.portfolio}
            watchlistSymbols={snapshot.symbols}
          />
        </section>

        <section id="vault" className={styles.section} style={{paddingTop:24}}>
          <DigitalReitDashboard snapshot={snapshot} />
        </section>

        <section className={styles.section}>
          <div className={styles.stackGrid}>
            {[
              ['Provider catalog', 'Voxel Vault asks the regulated provider which configured real-estate symbols are actually supported instead of inventing listings.'],
              ['Account holdings', 'The vault reads dShare balances from the configured provider account and keeps provider account IDs and API secrets server-side.'],
              ['Cash dividends', 'Actual provider dividend-payment records can feed the acquisition-reserve ledger; the UI does not manufacture projected income.'],
              ['Property ladder', 'Digital real-estate exposure remains separate from the future direct-property workflow: diligence → legal entity → closing → recorded deed → Property Passport.'],
            ].map(([title, copy], index) => (
              <article className={styles.stackCard} key={title}>
                <span className={styles.stackNumber}>{index + 1}</span>
                {index < 3 ? <span className={styles.stackArrow}>→</span> : null}
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
        </section>

        <footer className={styles.footer}>
          <div><strong>Voxel Vault Digital REIT Vault</strong><br />Spatial provider-backed real-estate securities with sandbox and owner-gated live execution paths.</div>
          <div>Not an investment recommendation · provider availability/eligibility controls execution · a REIT/dShare position is not a deed to a particular property.</div>
        </footer>
      </div>
    </main>
  );
}
