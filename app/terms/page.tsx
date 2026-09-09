import styles from '../legal.module.css';

const contactEmail = 'connectedtechpartners@gmail.com';

export const metadata = {
  title: 'Terms | ORXYZ',
  description: 'Terms and service-role information for the ORXYZ public website.',
};

export default function TermsPage() {
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <a className={styles.back} href="/">← ORXYZ home</a>

        <header className={styles.hero}>
          <div className={styles.kicker}>Service-role information</div>
          <h1>Terms</h1>
          <p>
            A clear summary of ORXYZ's role, how third-party provider terms work, and what an introduction does — and does not — mean.
          </p>
          <span className={styles.updated}>Last updated: September 9, 2026</span>
        </header>

        <div className={styles.content}>
          <section className={styles.section}>
            <h2>ORXYZ's role</h2>
            <p>ORXYZ provides independent technology sourcing, introduction, and coordination services. ORXYZ is not, by default, the manufacturer, installer, lender, carrier, payment processor, technical support provider, or equipment owner for third-party products and services introduced through the business.</p>
          </section>

          <section className={styles.section}>
            <h2>Provider terms control</h2>
            <p>Pricing, availability, service area, equipment specifications, installation, warranties, financing, customer support, contract duration, revenue share, and other provider-specific obligations are determined by the applicable third-party provider and remain subject to that provider's current written approval and agreement with the business customer.</p>
          </section>

          <section className={styles.section}>
            <h2>No commitment without approval</h2>
            <p>An inquiry, fit check, evaluation, referral, or introduction does not by itself create a purchase obligation, installation commitment, or deployment. Businesses should review the applicable provider's written terms before accepting any commercial commitment.</p>
          </section>

          <section className={styles.section}>
            <h2>Referral compensation</h2>
            <p>ORXYZ may receive referral, introducer, affiliate, or similar compensation from a third-party provider when a documented provider milestone is reached. The existence of potential compensation does not authorize ORXYZ to bind a business to a provider or approve provider terms on the business's behalf.</p>
          </section>

          <section className={styles.section}>
            <h2>Information and accuracy</h2>
            <p>ORXYZ aims to communicate provider and business information accurately, but third-party offerings can change. Material commercial terms should be confirmed directly in current written provider documentation before reliance.</p>
          </section>

          <section className={styles.section}>
            <h2>AI-assisted administration</h2>
            <p>Routine research, drafting, scheduling, and administrative communication may be AI-assisted. Consequential provider terms, payment, tax, account, contractual, and business commitments are reviewed personally by Dominic Hartenstein.</p>
          </section>

          <section className={styles.section}>
            <h2>Contact</h2>
            <p>Questions about these terms can be sent to <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.</p>
          </section>
        </div>

        <footer className={styles.footer}>
          <span>ORXYZ · Buffalo, New York</span>
          <span>Independent technology sourcing & coordination</span>
        </footer>
      </div>
    </main>
  );
}
