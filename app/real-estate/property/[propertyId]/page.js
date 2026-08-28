import { notFound } from 'next/navigation';
import PropertyTwinCanvas from '../../PropertyTwinCanvas';
import styles from '../../real-estate.module.css';
import {
  PROPERTY_RIGHT_TYPES,
  normalizePropertyTwin,
  propertyRightsLabel,
} from '../../../../lib/real-estate/property-twin';

const demoProperties = {
  '0001': {
    id: 'PROPERTY #0001',
    name: 'Buffalo House',
    address: '123 Main Street · Buffalo, New York · DEMO ADDRESS',
    entity: '123 Main Street Property LLC',
    type: 'Single-family rental',
    value: '$182,000',
    grossRent: '$1,550 / month',
    occupancy: '100% demo',
    units: '100,000',
    distributable: '$865 / month demo',
    reserve: '$155 / month demo',
    title: 'County deed reference hash pending verification',
  },
  '0002': {
    id: 'PROPERTY #0002',
    name: 'Mixed-Use Corner',
    address: 'Demo commercial parcel · NOT A LIVE PROPERTY',
    entity: 'Mixed-Use Corner Property LLC · demo',
    type: 'Retail + apartment demo',
    value: '$410,000',
    grossRent: '$3,100 / month',
    occupancy: '92% demo',
    units: '100,000',
    distributable: '$1,740 / month demo',
    reserve: '$310 / month demo',
    title: 'Demo title package · not verified',
  },
  '0003': {
    id: 'PROPERTY #0003',
    name: 'Vacant Parcel',
    address: 'Demo land parcel · NOT A LIVE PROPERTY',
    entity: 'Vacant Parcel Property LLC · demo',
    type: 'Land-only demo',
    value: '$44,000',
    grossRent: '—',
    occupancy: 'Not occupied',
    units: '100,000',
    distributable: '$0',
    reserve: '$0',
    title: 'Demo parcel reference · not verified',
  },
};

export function generateStaticParams() {
  return Object.keys(demoProperties).map((propertyId) => ({ propertyId }));
}

const truthText = (state) => {
  if (state === 'verified') return 'VERIFIED';
  if (state === 'partial') return 'PARTIAL';
  return 'UNVERIFIED';
};

export default async function PropertyVaultPage({ params }) {
  const { propertyId } = await params;
  const property = demoProperties[propertyId];
  if (!property) notFound();

  // These existing property cards are intentionally demo/reference records. They do not
  // contain authoritative parcel coordinates, boundaries, building geometry or title evidence,
  // so the truth engine must refuse to call them verified.
  const twin = normalizePropertyTwin({
    propertyId,
    label: property.name,
    addressLabel: property.address,
    identity: {
      countryCode: 'US',
      subdivisionCode: 'NY',
      countyCode: '',
      parcelId: '',
      fingerprint: '',
    },
    rights: {
      type: PROPERTY_RIGHT_TYPES.REFERENCE_ONLY,
    },
  });
  const rightsLabel = propertyRightsLabel(twin);

  const ledger = [
    ['Property entity', property.entity, 'Legal owner layer'],
    ['Recorded title', property.title, 'Off-chain authoritative record'],
    ['Interest units', property.units, 'Permissioned testnet units'],
    ['Transfer policy', 'Allowlisted wallets only', 'Anonymous transfers blocked'],
  ];

  const history = [
    ['Entity package created', 'Demo', 'Off-chain'],
    ['Deed reference hashed', 'Pending verification', 'Registry-ready'],
    ['Interest token prepared', 'Base Sepolia only', 'Testnet'],
    ['Distribution vault prepared', 'Claims locked', 'Testnet'],
  ];

  const truthCards = [
    ['Geographic truth', truthText(twin.verification.geography), 'Requires canonical parcel identity, valid coordinates, parcel polygon and authoritative source lineage.'],
    ['Physical truth', truthText(twin.verification.physical), 'Requires source-backed building footprint and height before the 3D twin can be called physically verified.'],
    ['Ownership rights', rightsLabel, 'Reference-only, provider-confirmed fractional security, or title/entity-confirmed direct ownership are kept separate.'],
    ['Fully verified vault', twin.verification.fullyVerified ? 'YES' : 'NO', 'Only becomes YES when both the spatial twin and the legal/economic ownership position are verified.'],
  ];

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <nav className={styles.nav}>
          <a className={styles.brand} href="/"><span className={styles.brandMark}>V</span>Voxel Vault</a>
          <div className={styles.navActions}>
            <span className={styles.statusPill}><span className={styles.statusDot} />PROPERTY VAULT · {rightsLabel}</span>
            <a className={styles.ghostPill} href="/real-estate">All properties</a>
          </div>
        </nav>

        <section className={styles.hero}>
          <div>
            <p className={styles.eyebrow}>{property.id} · spatial property vault</p>
            <h1>{property.name}<br /><em>property vault.</em></h1>
            <p className={styles.lead}>{property.address}</p>
            <div className={styles.heroNote}>
              <span>RIGHTS · {rightsLabel}</span>
              <span>GEO · {truthText(twin.verification.geography)}</span>
              <span>PHYSICAL · {truthText(twin.verification.physical)}</span>
              <span>🔒 No deed transfer occurs on-chain.</span>
            </div>
          </div>

          <div className={styles.heroVisual}>
            <PropertyTwinCanvas className={styles.twinCanvas} />
            <div className={styles.visualTop}>
              <span className={styles.darkPill}>3D PROPERTY TWIN · {propertyId}</span>
              <span className={styles.demoPill}>REFERENCE MODEL</span>
            </div>
            <div className={styles.visualBottom}>
              <div className={styles.propertyCaption}><small>Property entity</small><strong>{property.entity}</strong></div>
              <span className={styles.dragHint}>Drag to rotate<br />geometry not yet verified</span>
            </div>
          </div>
        </section>

        <section className={styles.metricGrid} aria-label="Property summary">
          <div className={styles.metricCard}><div className={styles.metricLabel}>Indicative value</div><div className={styles.metricValue}>{property.value}</div><div className={styles.metricSub}>Demo valuation only</div></div>
          <div className={styles.metricCard}><div className={styles.metricLabel}>Gross rent</div><div className={styles.metricValue}>{property.grossRent}</div><div className={styles.metricSub}>Before expenses and reserves</div></div>
          <div className={styles.metricCard}><div className={styles.metricLabel}>Occupancy</div><div className={styles.metricValue}>{property.occupancy}</div><div className={styles.metricSub}>Property-management data layer</div></div>
          <div className={styles.metricCard}><div className={styles.metricLabel}>Net distributable</div><div className={styles.metricValue}>{property.distributable}</div><div className={styles.metricSub}>Illustrative, not promised income</div></div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <div><p className={styles.eyebrow}>Spatial truth engine</p><h2>A 3D model is not automatically a real property twin.</h2></div>
            <p>Voxel Vault now tracks geographic truth, physical truth and legal/economic ownership as separate verification layers. A visually accurate model cannot create ownership, and a financial position cannot silently claim a specific parcel.</p>
          </div>
          <div className={styles.stackGrid}>
            {truthCards.map(([label, value, note], index) => (
              <article className={styles.stackCard} key={label}>
                <span className={styles.stackNumber}>{index + 1}</span>
                <h3>{label}</h3>
                <p><strong>{value}</strong><br />{note}</p>
              </article>
            ))}
          </div>
          <div className={styles.heroNote} style={{ marginTop: 20 }}>
            <span>Parcel coordinates · missing</span>
            <span>Parcel boundary · missing</span>
            <span>Building footprint · missing</span>
            <span>Authoritative source · missing</span>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <div><p className={styles.eyebrow}>Ownership + title map</p><h2>The deed, LLC and token stay distinguishable.</h2></div>
            <p>The recorded deed remains in the ordinary land-title system. The property entity owns the real estate. Any blockchain units only represent the rights actually granted by signed legal agreements.</p>
          </div>
          <div className={styles.stackGrid}>
            {ledger.map(([label, value, note], index) => <article className={styles.stackCard} key={label}><span className={styles.stackNumber}>{index + 1}</span><h3>{label}</h3><p><strong>{value}</strong><br />{note}</p></article>)}
          </div>
        </section>

        <section className={`${styles.section} ${styles.sectionDark}`}>
          <div className={styles.sectionHeader}>
            <div><p className={styles.eyebrow}>Operating waterfall</p><h2>Building bills are paid before distributions.</h2></div>
            <p>This screen is designed to reconcile property-management accounting with the distribution ledger instead of letting a smart contract blindly split gross rent.</p>
          </div>
          <div className={styles.moneyGrid}>
            <div className={styles.waterfallCard}>
              <div className={styles.moneyLine}><span>Gross rent</span><strong>{property.grossRent}</strong></div>
              <div className={styles.moneyLine}><span>Taxes / insurance / management</span><strong>deduct first</strong></div>
              <div className={styles.moneyLine}><span>Protected reserve</span><strong>{property.reserve}</strong></div>
              <div className={`${styles.moneyLine} ${styles.moneyLineTotal}`}><span>Eligible net distribution</span><strong>{property.distributable}</strong></div>
            </div>
            <div className={styles.gateCard}>
              <p className={styles.eyebrow}>Document vault design</p>
              <h3>Public hashes, private source documents.</h3>
              <p>Public metadata should expose identifiers and cryptographic hashes, not tenant PII, bank information, signatures, private closing documents or unredacted leases.</p>
              <ul className={styles.gateList}>
                <li><span className={styles.lock}>●</span><span>Recorded deed / title commitment: private copy + public hash.</span></li>
                <li><span className={styles.lock}>●</span><span>LLC operating agreement: signed private copy + version hash.</span></li>
                <li><span className={styles.lock}>●</span><span>Inspection, insurance and reserve policy: controlled document access.</span></li>
                <li><span className={styles.lock}>●</span><span>Investor identity files: never stored in public token metadata.</span></li>
              </ul>
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <div><p className={styles.eyebrow}>Blockchain history</p><h2>An audit trail, not a substitute for closing records.</h2></div>
            <p>Registry and distribution events can make ownership and payout history easier to audit while the authoritative legal and accounting records remain available off-chain.</p>
          </div>
          <div className={styles.stackGrid}>
            {history.map(([event, status, rail], index) => <article className={styles.stackCard} key={event}><span className={styles.stackNumber}>{index + 1}</span><h3>{event}</h3><p><strong>{status}</strong><br />{rail}</p></article>)}
          </div>
          <div className={styles.actions} style={{marginTop:24}}>
            <a className={styles.primaryButton} href="/real-estate/onboard">Start a property intake</a>
            <a className={styles.secondaryButton} href="/real-estate/compound">Open compounding simulator</a>
          </div>
        </section>

        <footer className={styles.footer}>
          <div><strong>{property.id}</strong><br />Voxel Vault spatial property-vault prototype.</div>
          <div>{rightsLabel} · current geometry is unverified demo data · direct live investing, custody and mainnet property-token deployment remain separately gated.</div>
        </footer>
      </div>
    </main>
  );
}
