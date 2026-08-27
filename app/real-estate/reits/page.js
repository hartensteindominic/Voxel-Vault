import styles from '../real-estate.module.css';
import DigitalReitDashboard from './DigitalReitDashboard';
import { getDigitalReitSnapshot } from '../../../lib/real-estate/dinari';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Digital REIT Vault | Voxel Vault',
  description: 'Provider-backed tokenized real-estate securities, account positions, dividends and sandbox execution inside Voxel Vault.',
};

export default async function DigitalReitPage() {
  const snapshot = await getDigitalReitSnapshot(process.env);

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <nav className={styles.nav}>
          <a className={styles.brand} href="/"><span className={styles.brandMark}>V</span>Voxel Vault</a>
          <div className={styles.navActions}>
            <span className={styles.statusPill}><span className={styles.statusDot} />DIGITAL REIT VAULT · {snapshot.environment.toUpperCase()}</span>
            <a className={styles.ghostPill} href="/real-estate/acquire">Acquisition engine</a>
            <a className={styles.ghostPill} href="/real-estate/invest">Capital simulator</a>
          </div>
        </nav>

        <section className={styles.hero} style={{gridTemplateColumns:'minmax(0,1fr)'}}>
          <div style={{maxWidth:940}}>
            <p className={styles.eyebrow}>Stage 1 · regulated tokenized real-estate securities</p>
            <h1>Digital REITs,<br /><em>inside the vault.</em></h1>
            <p className={styles.lead}>
              Voxel Vault now has a real provider integration layer for tokenized U.S. stocks and ETFs. The Digital REIT Vault filters the provider catalog for real-estate securities, reads actual configured-account positions and dividend records, and supports capped test buys in Dinari sandbox.
            </p>
            <div className={styles.actions}>
              <a className={styles.primaryButton} href="#vault">Open Digital REIT Vault</a>
              <a className={styles.secondaryButton} href="/real-estate/acquire">Build toward a deed</a>
              <a className={styles.secondaryButton} href="/real-estate/launch">Production gates</a>
            </div>
            <div className={styles.heroNote}>
              <span>Dinari integration.</span>
              <span>Sandbox first.</span>
              <span>Real API data when credentials are configured.</span>
              <span>Production trading locked.</span>
            </div>
          </div>
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
              ['Property ladder', 'Digital real-estate exposure can remain separate from the future direct-property workflow: diligence → legal entity → closing → recorded deed → Property Passport.'],
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
          <div><strong>Voxel Vault Digital REIT Vault</strong><br />Provider-backed tokenized real-estate integration with sandbox-first execution.</div>
          <div>Not an investment recommendation · availability and eligibility are determined by the regulated provider · production trading is disabled.</div>
        </footer>
      </div>
    </main>
  );
}
