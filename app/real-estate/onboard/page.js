import styles from '../real-estate.module.css';

const steps = [
  ['Property identity', 'Street address, parcel/APN reference, jurisdiction and proposed property ID. Do not upload private tenant data into public metadata.'],
  ['Title + entity review', 'Confirm recorded owner, liens, mortgage restrictions, taxes, insurance and whether the property will be conveyed into a dedicated issuer/property LLC.'],
  ['Operating package', 'Document the property manager, reserve policy, debt obligations, insurance, historical/underwritten operating data and the bank/accounting flow.'],
  ['Legal rights map', 'Securities counsel defines exactly what the investment units represent: economic or membership rights, voting, distributions, transfer restrictions and exit mechanics.'],
  ['Offering path', 'Select and document the exemption/registration path. The default first retail target is Regulation Crowdfunding through one registered broker-dealer or funding portal.'],
  ['Registered intermediary', 'The selected intermediary accepts the issuer/offering and controls the regulated investor-subscription workflow appropriate to its authorization.'],
  ['3D Property Passport', 'Create the building/parcel model, verified public facts, document hashes and a private document vault. The Passport is the property identity layer, not the deed or a separate promise of appreciation.'],
  ['Investor controls', 'Connect provider-backed identity, KYC/AML/sanctions checks, investor limits or accreditation verification, subscription documents and wallet/custody eligibility.'],
  ['Escrow + closing', 'Investor funds move only through approved payment/escrow rails. Ownership units are created from provider-authoritative closing allocations, never from client-side payment claims.'],
  ['Distribution + reinvestment', 'Connect property accounting, reserves, approved net-income statements, record-date/cap-table snapshots and the provider-approved distribution workflow. Start with cash or confirm-each reinvestment.'],
];

export const metadata = {
  title: 'Property Intake | Voxel Vault',
  description: 'Regulated-launch real-property tokenization intake checklist for Voxel Vault.',
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
            <span className={styles.statusPill}><span className={styles.statusDot} />PROPERTY #0001 · LAUNCH INTAKE</span>
            <a className={styles.ghostPill} href="/real-estate/launch">Legal launch</a>
            <a className={styles.ghostPill} href="/">Back home</a>
          </div>
        </nav>

        <section className={styles.intakeHero}>
          <p className={styles.eyebrow}>One real property at a time</p>
          <h1>Build the property, offering and settlement package before the token.</h1>
          <p>
            The first legally live milestone is one actual property that survives title diligence, issuer/entity setup, intermediary review, offering approval, investor onboarding, regulated settlement and reconciled rent accounting. Blockchain minting comes after those authoritative records—not before them.
          </p>
          <div className={styles.heroNote}>
            <span>🔒 No public investment checkout yet.</span>
            <span>🔒 No production/mainnet property mint yet.</span>
            <span>🔒 No unrestricted token transfers.</span>
            <span>🔒 No automatic reinvestment without provider approval.</span>
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
          <div><strong>Current engineering target:</strong><br />One U.S. property + registered intermediary + Base Sepolia proof of the ownership/distribution layer.</div>
          <div>Before accepting investment money, the actual offering must be approved by licensed securities counsel, property/title professionals and the selected registered intermediary.</div>
        </footer>
      </div>
    </main>
  );
}
