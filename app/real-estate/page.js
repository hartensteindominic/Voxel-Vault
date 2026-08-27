import PropertyTwinCanvas from './PropertyTwinCanvas';
import styles from './real-estate.module.css';

const properties = [
  {
    id: 'PROPERTY #0001',
    routeId: '0001',
    location: 'Buffalo House',
    type: 'Single-family rental',
    value: '$182,000',
    rent: '$1,550/mo',
    units: '100,000',
    glyph: '🏠',
    tone: 'cool',
  },
  {
    id: 'PROPERTY #0002',
    routeId: '0002',
    location: 'Mixed-Use Corner',
    type: 'Retail + apartment demo',
    value: '$410,000',
    rent: '$3,100/mo',
    units: '100,000',
    glyph: '🏢',
    tone: 'warm',
  },
  {
    id: 'PROPERTY #0003',
    routeId: '0003',
    location: 'Vacant Parcel',
    type: 'Land-only demo',
    value: '$44,000',
    rent: '—',
    units: '100,000',
    glyph: '🌳',
    tone: 'land',
  },
];

const stack = [
  ['Recorded deed', 'The county land-title system remains the source of record for the real property itself.'],
  ['Property LLC', 'A dedicated entity holds the deed and isolates the property, contracts, bills and operating records.'],
  ['Permissioned token', 'Approved wallets can hold economic-interest units linked by the LLC operating agreement.'],
  ['Net distributions', 'Rent is collected normally; property expenses and reserves are paid before approved distributions.'],
];

export default function RealEstatePlatformPage() {
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <nav className={styles.nav}>
          <a className={styles.brand} href="/">
            <span className={styles.brandMark}>V</span>
            Voxel Vault
          </a>
          <div className={styles.navActions}>
            <span className={styles.statusPill}><span className={styles.statusDot} />PILOT · BASE SEPOLIA</span>
            <a className={styles.ghostPill} href="/real-estate/compound">Compounding simulator</a>
            <a className={styles.ghostPill} href="/studio">3D asset studio</a>
          </div>
        </nav>

        <section className={styles.hero}>
          <div>
            <p className={styles.eyebrow}>Real property × legal ownership × spatial 3D</p>
            <h1>Real estate,<br /><em>made spatial.</em></h1>
            <p className={styles.lead}>
              Voxel Vault is becoming a real-property operating platform: each building or parcel can have a legally linked property entity, a permissioned blockchain ownership layer, an explorable 3D digital twin and auditable net-income distributions.
            </p>
            <div className={styles.actions}>
              <a className={styles.primaryButton} href="#portfolio">Explore demo portfolio</a>
              <a className={styles.secondaryButton} href="/real-estate/onboard">Start property intake</a>
              <a className={styles.secondaryButton} href="/real-estate/compound">Run capital simulator</a>
            </div>
            <div className={styles.heroNote}>
              <span>🔒 Live investing is locked.</span>
              <span>Demo data only.</span>
              <span>No deed or security is being sold from this prototype.</span>
            </div>
          </div>

          <div className={styles.heroVisual}>
            <PropertyTwinCanvas className={styles.twinCanvas} />
            <div className={styles.visualTop}>
              <span className={styles.darkPill}>3D PROPERTY TWIN · #0001</span>
              <span className={styles.demoPill}>DEMO</span>
            </div>
            <div className={styles.visualBottom}>
              <div className={styles.propertyCaption}>
                <small>Sample property entity</small>
                <strong>123 Main Street Property LLC</strong>
              </div>
              <span className={styles.dragHint}>Drag to rotate<br />parcel boundary shown</span>
            </div>
          </div>
        </section>

        <section className={styles.metricGrid} aria-label="Pilot metrics">
          <div className={styles.metricCard}>
            <div className={styles.metricLabel}>Pilot properties</div>
            <div className={styles.metricValue}>3</div>
            <div className={styles.metricSub}>Sample records, not live offerings</div>
          </div>
          <div className={styles.metricCard}>
            <div className={styles.metricLabel}>Ownership model</div>
            <div className={styles.metricValue}>LLC → token</div>
            <div className={styles.metricSub}>Legal agreement provides the linkage</div>
          </div>
          <div className={styles.metricCard}>
            <div className={styles.metricLabel}>Transfer mode</div>
            <div className={styles.metricValue}>Allowlisted</div>
            <div className={styles.metricSub}>No anonymous unrestricted transfers</div>
          </div>
          <div className={styles.metricCard}>
            <div className={styles.metricLabel}>Money movement</div>
            <div className={styles.metricValue}>Locked</div>
            <div className={styles.metricSub}>Legal + provider gates required first</div>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.eyebrow}>The legal stack</p>
              <h2>Blockchain sits on top of normal property law.</h2>
            </div>
            <p>The token is not treated as a magic blockchain deed. The property remains in the normal title system; the operating agreement defines what approved token units mean economically and contractually.</p>
          </div>
          <div className={styles.stackGrid}>
            {stack.map(([title, copy], index) => (
              <article className={styles.stackCard} key={title}>
                <span className={styles.stackNumber}>{index + 1}</span>
                {index < stack.length - 1 ? <span className={styles.stackArrow}>→</span> : null}
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="portfolio" className={`${styles.section} ${styles.sectionDark}`}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.eyebrow}>My real estate</p>
              <h2>Walk through a portfolio, not a spreadsheet.</h2>
            </div>
            <p>Open a property to enter its spatial vault with title/entity references, occupancy, expenses, document controls, distributions and blockchain history.</p>
          </div>

          <div className={styles.propertyGrid}>
            {properties.map((property) => (
              <a key={property.id} href={`/real-estate/property/${property.routeId}`} style={{color:'inherit',textDecoration:'none'}} aria-label={`Open ${property.location} property vault`}>
                <article className={styles.propertyCard} style={{height:'100%'}}>
                  <div className={styles.propertyArt} data-tone={property.tone}>
                    <span className={styles.artGlyph}>{property.glyph}</span>
                  </div>
                  <div className={styles.propertyBody}>
                    <span className={styles.propertyTag}>{property.id} · demo</span>
                    <h3>{property.location}</h3>
                    <p>{property.type}</p>
                    <div className={styles.propertyStats}>
                      <div className={styles.propertyStat}><small>Value</small><b>{property.value}</b></div>
                      <div className={styles.propertyStat}><small>Gross rent</small><b>{property.rent}</b></div>
                      <div className={styles.propertyStat}><small>Token units</small><b>{property.units}</b></div>
                    </div>
                    <div style={{marginTop:16,fontSize:13,fontWeight:900,letterSpacing:'.04em'}}>OPEN PROPERTY VAULT →</div>
                  </div>
                </article>
              </a>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.eyebrow}>Distribution accounting</p>
              <h2>Distribute net income, not gross rent.</h2>
            </div>
            <p>The platform separates property operations from investor distributions. A compliant property manager or operator handles the building first; only approved net distributable income reaches the distribution layer.</p>
          </div>

          <div className={styles.moneyGrid}>
            <div className={styles.waterfallCard}>
              <div className={styles.moneyLine}><span>Tenant rent collected</span><strong>$2,000</strong></div>
              <div className={styles.moneyLine}><span>Taxes + insurance</span><strong>− $370</strong></div>
              <div className={styles.moneyLine}><span>Repairs + management</span><strong>− $230</strong></div>
              <div className={styles.moneyLine}><span>Property reserve</span><strong>− $200</strong></div>
              <div className={`${styles.moneyLine} ${styles.moneyLineTotal}`}><span>Net distributable income</span><strong>$1,200</strong></div>
            </div>

            <div className={styles.gateCard}>
              <p className={styles.eyebrow}>Fail-closed launch gate</p>
              <h3>Real-money investing stays off until every required layer is ready.</h3>
              <p>The prototype exposes the product architecture without pretending that securities, custody, transfer-agent, money-transmission or property-title requirements are already solved.</p>
              <ul className={styles.gateList}>
                <li><span className={styles.lock}>●</span><span>Securities counsel approves the exact offering structure and investor eligibility flow.</span></li>
                <li><span className={styles.lock}>●</span><span>Title company / property counsel validates deed, liens and the property-owning entity.</span></li>
                <li><span className={styles.lock}>●</span><span>KYC/AML, sanctions screening and transfer restrictions are integrated through appropriate providers.</span></li>
                <li><span className={styles.lock}>●</span><span>Custody, fiat/USDC rails, tax reporting and distribution operations are production-reviewed.</span></li>
                <li><span className={styles.lock}>●</span><span>Smart contracts are independently audited before any mainnet use.</span></li>
              </ul>
            </div>
          </div>

          <div className={styles.legacyCard}>
            <div>
              <h3>The voxel engine is preserved.</h3>
              <p>Your existing 3D generation tools can become the digital-twin creation layer instead of being deleted.</p>
            </div>
            <a className={styles.secondaryButton} href="/studio">Open legacy 3D studio →</a>
          </div>
        </section>

        <footer className={styles.footer}>
          <div><strong>Voxel Vault Real Property Pilot</strong><br />Prototype architecture for legally linked real-estate digital twins.</div>
          <div>Demo only · not an investment offer · not legal, tax, title or investment advice · live investment flows disabled by design.</div>
        </footer>
      </div>
    </main>
  );
}
