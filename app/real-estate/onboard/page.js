import styles from '../real-estate.module.css';

const steps = [
  ['Property identity', 'Street address, parcel/APN reference, jurisdiction and proposed property ID. Do not upload private tenant data into public metadata.'],
  ['Title + entity review', 'Confirm recorded owner, liens, mortgage restrictions, taxes, insurance and whether the property will be conveyed into a dedicated LLC.'],
  ['Legal rights map', 'Counsel defines exactly what the token represents: membership/economic rights, voting, distributions, transfer restrictions and exit mechanics.'],
  ['3D twin package', 'Create the building/parcel model, verified public facts, document hashes and a private document vault for sensitive closing records.'],
  ['Investor controls', 'Configure KYC/AML/sanctions checks, investor eligibility, wallet allowlisting, transfer-agent or equivalent operating procedures.'],
  ['Distribution operations', 'Connect property accounting, reserves, approved net-income statements and the distribution workflow before enabling any claim.'],
];

export const metadata = {
  title: 'Property Intake | Voxel Vault',
  description: 'Real-property tokenization pilot intake checklist for Voxel Vault.',
};

export default function PropertyIntakePage() {
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <nav className={styles.nav}>
          <a className={styles.brand} href="/">
            <span className={styles.brandMark}>V</span>
            Voxel Vault
          </a>
          <div className={styles.navActions}>
            <span className={styles.statusPill}><span className={styles.statusDot} />PROPERTY INTAKE · PILOT</span>
            <a className={styles.ghostPill} href="/">Back home</a>
          </div>
        </nav>

        <section className={styles.intakeHero}>
          <p className={styles.eyebrow}>One property at a time</p>
          <h1>Build the legal package before the token.</h1>
          <p>
            The first real-world pilot should start with a property that can be fully diligence-checked. This page is the operational checklist for getting a building or parcel ready for counsel, title review, digital-twin creation and testnet configuration.
          </p>
          <div className={styles.heroNote}>
            <span>🔒 No public investment checkout.</span>
            <span>🔒 No mainnet deployment.</span>
            <span>🔒 No anonymous token transfers.</span>
          </div>
        </section>

        <section className={styles.intakeGrid}>
          {steps.map(([title, copy], index) => (
            <article className={styles.intakeCard} key={title}>
              <strong>Gate {String(index + 1).padStart(2, '0')}</strong>
              <h2>{title}</h2>
              <p>{copy}</p>
            </article>
          ))}
        </section>

        <footer className={styles.footer}>
          <div><strong>Current build target:</strong><br />Base Sepolia + sample property LLC linkage.</div>
          <div>Before a real property is accepted, use licensed real-estate/title and securities counsel appropriate to the property and offering jurisdiction.</div>
        </footer>
      </div>
    </main>
  );
}
