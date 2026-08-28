import PropertyTwinCanvas from './PropertyTwinCanvas';
import styles from './real-estate.module.css';

const journey = [
  {
    number: '01',
    title: 'Explore',
    copy: 'Search a real address and inspect source-backed geography, mapped buildings, parcel evidence and nearby context in 3D.',
    href: '/geo',
    action: 'Open GEO',
  },
  {
    number: '02',
    title: 'Invest',
    copy: 'Browse provider-confirmed tokenized real-estate securities. Sandbox and live execution stay separated and provider-gated.',
    href: '/real-estate/reits',
    action: 'Open investments',
  },
  {
    number: '03',
    title: 'Vault',
    copy: 'Keep creator assets, wallet-verified collectibles and user-bound financial positions in one spatial home without mixing their legal meaning.',
    href: '/vault',
    action: 'Open my Vault',
  },
  {
    number: '04',
    title: 'Income',
    copy: 'See provider-reported dividend payment history as observed income. No invented yield, rent, FX conversion or projections.',
    href: '/vault/income',
    action: 'Open Income',
  },
  {
    number: '05',
    title: 'Own',
    copy: 'Plan the longer path toward a directly owned property through diligence, entity setup, normal closing and a recorded deed.',
    href: '/real-estate/acquire',
    action: 'Plan direct ownership',
  },
];

const truthLayers = [
  ['Place truth', 'Source-backed map, building and parcel evidence. GEO never turns map geometry into a deed claim.'],
  ['Asset truth', 'Provider-confirmed securities stay distinct from NFTs, creator assets and direct real property.'],
  ['Ownership truth', 'Wallet checks, account bindings and recorded title are used only for the ownership facts they can actually prove.'],
  ['Income truth', 'Observed provider payments are shown as reported. Modeled rent and simulations remain clearly labeled models.'],
];

export default function RealEstatePlatformPage() {
  return (
    <main className={styles.page} style={{paddingBottom:'94px'}}>
      <div className={styles.shell}>
        <nav className={styles.nav}>
          <a className={styles.brand} href="/">
            <span className={styles.brandMark}>V</span>
            Voxel Vault
          </a>
          <div className={styles.navActions}>
            <span className={styles.statusPill}><span className={styles.statusDot} />FINANCIAL OS · PILOT</span>
            <a className={styles.ghostPill} href="/geo">Explore GEO</a>
            <a className={styles.ghostPill} href="/vault">My Vault</a>
            <a className={styles.ghostPill} href="/studio">Create 3D</a>
          </div>
        </nav>

        <section className={styles.hero}>
          <div className={styles.heroIntro}>
            <p className={styles.eyebrow}>Explore → invest → verify → observe → own</p>
            <h1>Your money,<br /><em>made spatial.</em></h1>
            <p className={styles.lead}>
              Voxel Vault is one spatial financial home for real-estate discovery, provider-backed investment assets, verified holdings, observed income and the longer path toward direct property ownership.
            </p>
            <div className={styles.actions}>
              <a className={styles.primaryButton} href="/geo">Explore a real place</a>
              <a className={styles.secondaryButton} href="/real-estate/reits">Browse investments</a>
              <a className={styles.secondaryButton} href="/vault">Open my Vault</a>
            </div>
            <div className={styles.heroNote}>
              <span>Live investing is locked unless the approved provider path says otherwise.</span>
              <span>Demo data only where marked.</span>
              <span>Source-backed geography.</span>
              <span>Observed income only.</span>
              <span>Direct property closes through normal title systems.</span>
            </div>
          </div>

          <div className={styles.heroVisual}>
            <PropertyTwinCanvas className={styles.twinCanvas} />
            <div className={styles.visualTop}>
              <span className={styles.darkPill}>SPATIAL FINANCIAL HOME</span>
              <span className={styles.demoPill}>TRUTH-FIRST</span>
            </div>
            <div className={styles.visualBottom}>
              <div className={styles.propertyCaption}>
                <small>One coherent system</small>
                <strong>Place → asset → ownership → income</strong>
              </div>
              <span className={styles.dragHint}>3D is the interface<br />evidence is the authority</span>
            </div>
          </div>
        </section>

        <section className={styles.metricGrid} aria-label="Financial operating principles">
          <div className={styles.metricCard}>
            <div className={styles.metricLabel}>Explore</div>
            <div className={styles.metricValue}>Real places</div>
            <div className={styles.metricSub}>Source-backed map and parcel context</div>
          </div>
          <div className={styles.metricCard}>
            <div className={styles.metricLabel}>Invest</div>
            <div className={styles.metricValue}>Provider-gated</div>
            <div className={styles.metricSub}>No invented listings or fake execution</div>
          </div>
          <div className={styles.metricCard}>
            <div className={styles.metricLabel}>Income</div>
            <div className={styles.metricValue}>Observed</div>
            <div className={styles.metricSub}>Reported payments stay separate from projections</div>
          </div>
          <div className={styles.metricCard}>
            <div className={styles.metricLabel}>Direct ownership</div>
            <div className={styles.metricValue}>Title-first</div>
            <div className={styles.metricSub}>Normal diligence, closing and deed recording</div>
          </div>
        </section>

        <section className={`${styles.section} ${styles.sectionDark}`}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.eyebrow}>The Voxel Vault journey</p>
              <h2>Five rooms. One financial story.</h2>
            </div>
            <p>Every major screen now has one job. The app can grow without making a user learn a different product every time they tap a tab.</p>
          </div>

          <div className={styles.propertyGrid}>
            {journey.map((step) => (
              <a href={step.href} key={step.title} className={styles.propertyLink}>
                <article className={styles.propertyCard}>
                  <div className={styles.propertyBody}>
                    <span className={styles.propertyTag}>{step.number} · FINANCIAL OS</span>
                    <h3>{step.title}</h3>
                    <p>{step.copy}</p>
                    <div className={styles.propertyOpen}>{step.action.toUpperCase()} →</div>
                  </div>
                </article>
              </a>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.eyebrow}>Trust architecture</p>
              <h2>Every number should know where it came from.</h2>
            </div>
            <p>Voxel Vault should feel simple on the surface and strict underneath. A beautiful 3D view never upgrades weak evidence into a stronger legal or financial claim.</p>
          </div>
          <div className={styles.stackGrid}>
            {truthLayers.map(([title, copy], index) => (
              <article className={styles.stackCard} key={title}>
                <span className={styles.stackNumber}>{index + 1}</span>
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.eyebrow}>Capital path</p>
              <h2>Start with access. Build toward ownership.</h2>
            </div>
            <p>Tokenized real-estate securities can provide regulated market exposure when the connected provider permits it. That is deliberately separate from buying a particular house or holding its deed.</p>
          </div>
          <div className={styles.stackGrid}>
            {[
              ['Provider-backed exposure', 'Browse eligible real-estate securities through the connected provider layer. Provider rules control eligibility and execution.'],
              ['Verified portfolio', 'Bring supported holdings into My Vault only when the relevant wallet, account or provider can substantiate them.'],
              ['Observed income', 'Track actual provider payment records without calling dividends rent or manufacturing future yield.'],
              ['Direct-property plan', 'Research candidates, complete diligence and eventually close through the normal legal title system before creating a verified property passport.'],
            ].map(([title, copy], index) => (
              <article className={styles.stackCard} key={title}>
                <span className={styles.stackNumber}>{index + 1}</span>
                {index < 3 ? <span className={styles.stackArrow}>→</span> : null}
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
          <div className={styles.actions} style={{marginTop:24}}>
            <a className={styles.primaryButton} href="/real-estate/reits">Open provider-backed investments</a>
            <a className={styles.secondaryButton} href="/real-estate/acquire">Open direct-property planner</a>
            <a className={styles.secondaryButton} href="/real-estate/launch">Review launch gates</a>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.gateCard}>
            <p className={styles.eyebrow}>Product boundary</p>
            <h3>Simple for the user. Fail-closed for real money.</h3>
            <p>Public exploration can be broad. Personal holdings require identity or wallet evidence. Securities execution stays inside the approved provider path. Direct-property ownership requires real diligence, legal closing and recorded title. Voxel Vault can organize those layers without pretending to replace them.</p>
            <div className={styles.actions}>
              <a className={styles.primaryButton} href="/vault">Go to My Vault</a>
              <a className={styles.secondaryButton} href="/vault/income">See observed income</a>
              <a className={styles.secondaryButton} href="/real-estate/property/0001">Open clearly labeled demo property vault</a>
            </div>
          </div>
        </section>

        <footer className={styles.footer}>
          <div><strong>Voxel Vault Financial OS</strong><br />Spatial discovery, provider-backed assets, verified holdings, observed income and direct-property planning.</div>
          <div>Pilot software · not an investment recommendation · asset availability and execution depend on connected providers and applicable eligibility rules.</div>
        </footer>
      </div>
    </main>
  );
}