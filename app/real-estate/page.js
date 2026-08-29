import PropertyTwinCanvas from './PropertyTwinCanvas';
import styles from './real-estate.module.css';

const paths = [
  {
    number: '01',
    status: 'LIVE DIGITAL',
    title: 'Explore a real place',
    copy: 'Search an address and inspect source-backed map, building, parcel, and nearby 3D context.',
    href: '/geo',
    action: 'Open property map',
  },
  {
    number: '02',
    status: 'DEMO',
    title: 'Try $1.99 property math',
    copy: 'Use fake demo balances to compare tiny hypothetical slices. No real funds, security purchase, or property rights move.',
    href: '/geo/slice',
    action: 'Try the demo',
  },
  {
    number: '03',
    status: 'PARTNER REQUIRED',
    title: 'Property investments',
    copy: 'Real-estate securities only become live through an approved provider, eligible offering, user checks, settlement, and position verification.',
    href: '/real-estate/reits',
    action: 'View investment status',
  },
  {
    number: '04',
    status: 'TITLE REQUIRED',
    title: 'Own real property',
    copy: 'Direct ownership follows diligence, closing, and recorded title. A token, NFT, model, or map marker is not the deed.',
    href: '/real-estate/acquire',
    action: 'See ownership path',
  },
];

const truthLayers = [
  ['Place', 'Map, building, and parcel evidence can describe a location. They do not prove ownership.'],
  ['Digital asset', 'A VoxelPop creation or collectible can be bought as a digital asset. It does not include physical-property rights.'],
  ['Investment', 'A provider-confirmed security is shown only as the provider can substantiate it. Estimated values are not cash.'],
  ['Real ownership', 'Recorded title and the normal legal closing process control ownership of the physical property.'],
];

export default function RealEstatePlatformPage() {
  return (
    <main className={styles.page} style={{paddingBottom:'94px'}}>
      <div className={styles.shell}>
        <nav className={styles.nav}>
          <a className={styles.brand} href="/"><span className={styles.brandMark}>V</span>Voxel Vault</a>
          <div className={styles.navActions}>
            <span className={styles.statusPill}><span className={styles.statusDot} />REAL ESTATE · CLEAR STATUS</span>
            <a className={styles.ghostPill} href="/geo">Property Map</a>
            <a className={styles.ghostPill} href="/vault">My Vault</a>
          </div>
        </nav>

        <section className={styles.hero}>
          <div className={styles.heroIntro}>
            <p className={styles.eyebrow}>Explore · demo · invest through providers · own through title</p>
            <h1>Real estate,<br /><em>without pretending.</em></h1>
            <p className={styles.lead}>Explore real places in 3D, test a $1.99 sandbox, view provider-backed investment paths, and plan direct ownership through the normal legal title system.</p>
            <div className={styles.actions}>
              <a className={styles.primaryButton} href="/geo">Explore a place</a>
              <a className={styles.secondaryButton} href="/geo/slice">Try $1.99 demo</a>
              <a className={styles.secondaryButton} href="/vault">Open my Vault</a>
            </div>
            <div className={styles.heroNote}>
              <span>LIVE DIGITAL · 3D places + digital assets</span>
              <span>DEMO · $1.99 sandbox</span>
              <span>PARTNER REQUIRED · investments + financial rails</span>
              <span>TITLE REQUIRED · real property ownership</span>
            </div>
          </div>

          <div className={styles.heroVisual}>
            <PropertyTwinCanvas className={styles.twinCanvas} />
            <div className={styles.visualTop}><span className={styles.darkPill}>3D PROPERTY INTERFACE</span><span className={styles.demoPill}>TRUTH-FIRST</span></div>
            <div className={styles.visualBottom}>
              <div className={styles.propertyCaption}><small>One place can have different records</small><strong>Map ≠ collectible ≠ investment ≠ deed</strong></div>
              <span className={styles.dragHint}>3D helps you understand it<br />evidence decides what is true</span>
            </div>
          </div>
        </section>

        <section className={styles.metricGrid} aria-label="Real-estate product status">
          <div className={styles.metricCard}><div className={styles.metricLabel}>Explore</div><div className={styles.metricValue}>Live digital</div><div className={styles.metricSub}>Source-backed property and map context</div></div>
          <div className={styles.metricCard}><div className={styles.metricLabel}>$1.99</div><div className={styles.metricValue}>Demo</div><div className={styles.metricSub}>No real money or ownership</div></div>
          <div className={styles.metricCard}><div className={styles.metricLabel}>Invest</div><div className={styles.metricValue}>Partner required</div><div className={styles.metricSub}>Provider controls availability and eligibility</div></div>
          <div className={styles.metricCard}><div className={styles.metricLabel}>Own</div><div className={styles.metricValue}>Title required</div><div className={styles.metricSub}>Normal closing and recorded deed/title</div></div>
        </section>

        <section className={`${styles.section} ${styles.sectionDark}`}>
          <div className={styles.sectionHeader}><div><p className={styles.eyebrow}>Choose the right path</p><h2>Four paths. Four meanings.</h2></div><p>Voxel Vault can place these experiences in one app without pretending one automatically becomes another.</p></div>
          <div className={styles.propertyGrid}>
            {paths.map((step) => <a href={step.href} key={step.title} className={styles.propertyLink}><article className={styles.propertyCard}><div className={styles.propertyBody}><span className={styles.propertyTag}>{step.number} · {step.status}</span><h3>{step.title}</h3><p>{step.copy}</p><div className={styles.propertyOpen}>{step.action.toUpperCase()} →</div></div></article></a>)}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}><div><p className={styles.eyebrow}>What each record proves</p><h2>Keep the evidence attached to the claim.</h2></div><p>A polished 3D view can make the product easier to understand, but it never upgrades weak evidence into ownership or investment authority.</p></div>
          <div className={styles.stackGrid}>{truthLayers.map(([title, copy], index) => <article className={styles.stackCard} key={title}><span className={styles.stackNumber}>{index + 1}</span><h3>{title}</h3><p>{copy}</p></article>)}</div>
        </section>

        <section className={styles.section}>
          <div className={styles.gateCard}>
            <p className={styles.eyebrow}>Legitimacy boundary</p>
            <h3>Live where Voxel Vault is ready. Locked where a regulated or legal rail is still missing.</h3>
            <p>Voxel Vault is not itself a bank, broker, exchange, custodian, escrow service, or deed registry. Customer money movement, crypto exchange/custody, real-estate securities execution, and real-property ownership only become live through the exact approved provider or legal process required for that action.</p>
            <div className={styles.actions}><a className={styles.primaryButton} href="/property">Create a digital property voxel</a><a className={styles.secondaryButton} href="/real-estate/reits">Check investment status</a><a className={styles.secondaryButton} href="/real-estate/acquire">See direct ownership path</a></div>
          </div>
        </section>

        <footer className={styles.footer}><div><strong>Voxel Vault Real Estate</strong><br />3D place data, digital property assets, demo tools, provider-backed investments, and title-based ownership paths.</div><div>Digital product software · not an investment recommendation · no claim of bank, broker, exchange, custody, escrow, or deed-registry status.</div></footer>
      </div>
    </main>
  );
}
