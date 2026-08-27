import PropertyTwinCanvas from '../PropertyTwinCanvas';
import styles from '../real-estate.module.css';
import {
  acquisitionPolicy,
  buildCapitalLadder,
  evaluateTokenizedRealEstateAccess,
  rankPropertyCandidates,
} from '../../../lib/real-estate/acquisition-engine';

const demoCandidates = [
  {
    id: 'CANDIDATE-001',
    label: 'Low-cost single-family demo',
    location: 'Example Midwest market',
    purchasePrice: 22500,
    closingCosts: 1700,
    immediateRepairs: 6200,
    backTaxes: 0,
    initialReserve: 2500,
    monthlyRent: 725,
    annualPropertyTax: 1150,
    annualInsurance: 1200,
    monthlyHoa: 0,
    monthlyUtilities: 0,
    managementRate: 0.09,
    vacancyRate: 0.08,
    maintenanceRate: 0.1,
    titleVerified: true,
    liensCleared: true,
    taxesCurrent: true,
    habitable: true,
    rentalLegal: true,
    insuranceAvailable: true,
    inspectionComplete: true,
    marketRentVerified: true,
    propertyManagerConfirmed: true,
    floodRiskReviewed: true,
    utilityArrearsReviewed: true,
  },
  {
    id: 'CANDIDATE-002',
    label: 'Ultra-cheap house demo',
    location: 'Example distressed market',
    purchasePrice: 4900,
    closingCosts: 1300,
    immediateRepairs: 18500,
    backTaxes: 3400,
    initialReserve: 3000,
    monthlyRent: 650,
    annualPropertyTax: 900,
    annualInsurance: 1450,
    managementRate: 0.1,
    vacancyRate: 0.12,
    maintenanceRate: 0.12,
    titleVerified: false,
    liensCleared: false,
    taxesCurrent: false,
    habitable: false,
    rentalLegal: true,
    insuranceAvailable: false,
    inspectionComplete: false,
    marketRentVerified: false,
    propertyManagerConfirmed: false,
    floodRiskReviewed: false,
    utilityArrearsReviewed: false,
  },
  {
    id: 'CANDIDATE-003',
    label: 'Small duplex demo',
    location: 'Example secondary city',
    purchasePrice: 48500,
    closingCosts: 2600,
    immediateRepairs: 7500,
    backTaxes: 0,
    initialReserve: 4500,
    monthlyRent: 1350,
    annualPropertyTax: 2300,
    annualInsurance: 1850,
    monthlyUtilities: 90,
    managementRate: 0.09,
    vacancyRate: 0.08,
    maintenanceRate: 0.1,
    titleVerified: true,
    liensCleared: true,
    taxesCurrent: true,
    habitable: true,
    rentalLegal: true,
    insuranceAvailable: true,
    inspectionComplete: false,
    marketRentVerified: true,
    propertyManagerConfirmed: true,
    floodRiskReviewed: true,
    utilityArrearsReviewed: true,
  },
];

const tokenizedDemo = [
  { name: 'Tokenized real-estate sleeve', type: 'Regulated security integration slot', value: 0, distribution: 'Provider data required', status: 'NOT CONNECTED' },
  { name: 'REIT / property fund sleeve', type: 'Broker/provider-held position', value: 0, distribution: 'Provider data required', status: 'NOT CONNECTED' },
];

function usd(value, digits = 0) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: digits }).format(value);
}

function pct(value) {
  return `${(value * 100).toFixed(1)}%`;
}

export default function AcquisitionEnginePage() {
  const ranked = rankPropertyCandidates(demoCandidates);
  const tokenizedAccess = evaluateTokenizedRealEstateAccess(process.env);
  const ladder = buildCapitalLadder({ tokenizedValue: 0, cash: 0, propertyEquity: 0 });

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <nav className={styles.nav}>
          <a className={styles.brand} href="/">
            <span className={styles.brandMark}>V</span>
            Voxel Vault
          </a>
          <div className={styles.navActions}>
            <span className={styles.statusPill}><span className={styles.statusDot} />ACQUISITION ENGINE · V1</span>
            <a className={styles.ghostPill} href="/real-estate/invest">Investment simulator</a>
            <a className={styles.ghostPill} href="/real-estate/launch">Launch gates</a>
          </div>
        </nav>

        <section className={styles.hero}>
          <div>
            <p className={styles.eyebrow}>Tokenized real estate → cash reserve → direct property</p>
            <h1>Build toward<br /><em>the first real deed.</em></h1>
            <p className={styles.lead}>
              Voxel Vault now has an acquisition layer designed to start with regulated tokenized real-estate exposure, build a cash reserve, and graduate to directly owned rental property through a normal title and closing process.
            </p>
            <div className={styles.actions}>
              <a className={styles.primaryButton} href="#candidates">Rank property candidates</a>
              <a className={styles.secondaryButton} href="#tokenized">Tokenized real estate</a>
              <a className={styles.secondaryButton} href="/real-estate/onboard">Property intake</a>
            </div>
            <div className={styles.heroNote}>
              <span>🔒 Analysis-only execution policy.</span>
              <span>No securities orders.</span>
              <span>No deed purchases.</span>
              <span>No unattended spending.</span>
            </div>
          </div>

          <div className={styles.heroVisual}>
            <PropertyTwinCanvas className={styles.twinCanvas} />
            <div className={styles.visualTop}>
              <span className={styles.darkPill}>ACQUISITION TARGET · 3D PREVIEW</span>
              <span className={styles.demoPill}>SIMULATION</span>
            </div>
            <div className={styles.visualBottom}>
              <div className={styles.propertyCaption}>
                <small>Ranking objective</small>
                <strong>Cheapest profitable verified property</strong>
              </div>
              <span className={styles.dragHint}>Price alone<br />never wins</span>
            </div>
          </div>
        </section>

        <section className={styles.metricGrid} aria-label="Acquisition engine status">
          <div className={styles.metricCard}>
            <div className={styles.metricLabel}>Property execution</div>
            <div className={styles.metricValue}>Locked</div>
            <div className={styles.metricSub}>Title + closing + explicit authorization required</div>
          </div>
          <div className={styles.metricCard}>
            <div className={styles.metricLabel}>Tokenized trading</div>
            <div className={styles.metricValue}>{tokenizedAccess.liveTradingEnabled ? 'Provider live' : 'Research only'}</div>
            <div className={styles.metricSub}>Official regulated-provider integration required</div>
          </div>
          <div className={styles.metricCard}>
            <div className={styles.metricLabel}>Ranking goal</div>
            <div className={styles.metricValue}>Profit + diligence</div>
            <div className={styles.metricSub}>Not the lowest listing price</div>
          </div>
          <div className={styles.metricCard}>
            <div className={styles.metricLabel}>Capital tracked</div>
            <div className={styles.metricValue}>{usd(ladder.total)}</div>
            <div className={styles.metricSub}>Connect real accounts only through approved providers</div>
          </div>
        </section>

        <section id="tokenized" className={styles.section}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.eyebrow}>Stage 1 · blockchain / tokenized real estate</p>
              <h2>Start small without pretending Voxel Vault is the broker.</h2>
            </div>
            <p>
              A production version can display positions, distributions and property-linked securities from a regulated provider. The provider remains responsible for eligibility, custody, order execution, settlement and required records.
            </p>
          </div>

          <div className={styles.propertyGrid}>
            {tokenizedDemo.map((position) => (
              <article className={styles.propertyCard} key={position.name}>
                <div className={styles.propertyArt} data-tone="cool"><span className={styles.artGlyph}>🏢</span></div>
                <div className={styles.propertyBody}>
                  <span className={styles.propertyTag}>{position.status}</span>
                  <h3>{position.name}</h3>
                  <p>{position.type}</p>
                  <div className={styles.propertyStats}>
                    <div className={styles.propertyStat}><small>Connected value</small><b>{usd(position.value)}</b></div>
                    <div className={styles.propertyStat}><small>Distribution</small><b>{position.distribution}</b></div>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className={styles.legacyCard}>
            <div>
              <h3>Provider connection is deliberately not faked.</h3>
              <p>{tokenizedAccess.missing.length ? `Still required: ${tokenizedAccess.missing.join(', ')}.` : 'External provider gates are present, but production execution remains code-locked pending a reviewed release.'}</p>
            </div>
            <span className={styles.secondaryButton} aria-disabled="true" style={{opacity:.55,cursor:'not-allowed'}}>CONNECT REGULATED PROVIDER · LOCKED</span>
          </div>
        </section>

        <section id="candidates" className={`${styles.section} ${styles.sectionDark}`}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.eyebrow}>Stage 2 · acquisition scout</p>
              <h2>Find cheap property that survives diligence.</h2>
            </div>
            <p>
              Every candidate is scored on all-in basis, modeled net yield and hard diligence gates. A $4,900 house with broken title, taxes and habitability can rank below a more expensive property that actually has a path to rent.
            </p>
          </div>

          <div className={styles.propertyGrid}>
            {ranked.map((candidate, index) => (
              <article className={styles.propertyCard} key={candidate.id}>
                <div className={styles.propertyArt} data-tone={candidate.status === 'reject' ? 'warm' : 'land'}>
                  <span className={styles.artGlyph}>{candidate.status === 'reject' ? '⚠️' : '🏠'}</span>
                </div>
                <div className={styles.propertyBody}>
                  <span className={styles.propertyTag}>#{index + 1} · SCORE {candidate.score}/100 · {candidate.status.toUpperCase()}</span>
                  <h3>{candidate.label}</h3>
                  <p>{candidate.location}</p>
                  <div className={styles.propertyStats}>
                    <div className={styles.propertyStat}><small>Listing</small><b>{usd(candidate.economics.purchasePrice)}</b></div>
                    <div className={styles.propertyStat}><small>All-in basis</small><b>{usd(candidate.economics.totalBasis)}</b></div>
                    <div className={styles.propertyStat}><small>Gross rent</small><b>{usd(candidate.economics.monthlyRent)}/mo</b></div>
                    <div className={styles.propertyStat}><small>Modeled net</small><b>{usd(candidate.economics.monthlyNet)}/mo</b></div>
                    <div className={styles.propertyStat}><small>Modeled net yield</small><b>{pct(candidate.economics.modeledNetYield)}</b></div>
                    <div className={styles.propertyStat}><small>Human review</small><b>{candidate.eligibleForHumanReview ? 'Eligible' : 'Blocked'}</b></div>
                  </div>
                  {candidate.failedHardGates.length ? (
                    <p style={{marginTop:14,fontSize:12,lineHeight:1.5}}><b>Hard stops:</b> {candidate.failedHardGates.join(' · ')}</p>
                  ) : null}
                  {candidate.warnings.length ? (
                    <p style={{marginTop:10,fontSize:12,lineHeight:1.5}}><b>Still verify:</b> {candidate.warnings.join(' · ')}</p>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.eyebrow}>Stage 3 · direct ownership</p>
              <h2>The winning candidate still closes like real property.</h2>
            </div>
            <p>Voxel Vault can organize the workflow, but the acquisition completes through the legal title system—not by sending crypto to an NFT contract.</p>
          </div>
          <div className={styles.stackGrid}>
            {[
              ['Diligence', 'Inspection, title, liens, taxes, rent legality, insurance, environmental/flood review and operating budget.'],
              ['Property entity', 'Form or verify the dedicated property LLC and approve the purchase through the appropriate legal process.'],
              ['Closing + deed', 'Escrow/title/attorneys complete settlement and the deed is recorded in the normal land-record system.'],
              ['Onchain passport', 'After verification, anchor the property identity, legal-record hashes, 3D twin and auditable accounting to Voxel Vault.'],
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

        <section className={styles.section}>
          <div className={styles.gateCard}>
            <p className={styles.eyebrow}>Execution boundary</p>
            <h3>V1 can recommend a candidate. It cannot buy one.</h3>
            <p>The code-level policy reports property acquisition execution as <b>{String(acquisitionPolicy.livePropertyExecutionReady)}</b> and tokenized-security trading readiness as <b>{String(acquisitionPolicy.liveTokenizedSecurityTradingReady)}</b>. Both require a future reviewed release plus the real regulated/title integrations.</p>
          </div>
        </section>

        <footer className={styles.footer}>
          <div><strong>Voxel Vault Acquisition Engine V1</strong><br />Research → diligence → regulated provider → legal closing → verified property passport.</div>
          <div>Demo economics only · not an investment recommendation · no live property or securities execution.</div>
        </footer>
      </div>
    </main>
  );
}
