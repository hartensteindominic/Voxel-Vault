import styles from '../legal.module.css';

const contactEmail = 'connectedtechpartners@gmail.com';

export const metadata = {
  title: 'Privacy | ORXYZ',
  description: 'Privacy information for the ORXYZ public website.',
};

export default function PrivacyPage() {
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <a className={styles.back} href="/">← ORXYZ home</a>

        <header className={styles.hero}>
          <div className={styles.kicker}>Public website notice</div>
          <h1>Privacy</h1>
          <p>
            A plain-language summary of how ORXYZ handles information shared through the public website and written business inquiries.
          </p>
          <span className={styles.updated}>Last updated: September 9, 2026</span>
        </header>

        <div className={styles.content}>
          <section className={styles.section}>
            <h2>Information you provide</h2>
            <p>If you contact ORXYZ by email, you may provide your name, email address, company information, business needs, or other information you choose to include. ORXYZ uses that information to review and respond to the inquiry and, where appropriate, coordinate potential technology opportunities.</p>
          </section>

          <section className={styles.section}>
            <h2>Third-party providers</h2>
            <p>When an opportunity may require a third-party technology provider, ORXYZ aims to keep identifying or confidential business information limited to what is appropriate for evaluation and to obtain permission before a substantive provider handoff when practical.</p>
          </section>

          <section className={styles.section}>
            <h2>Website data</h2>
            <p>This version of the ORXYZ website does not intentionally use advertising trackers or sell visitor information. Hosting, security, domain, and infrastructure providers may process standard technical information required to deliver and protect the site.</p>
          </section>

          <section className={styles.section}>
            <h2>AI-assisted administration</h2>
            <p>Routine research, drafting, scheduling, and administrative communication may be AI-assisted. ORXYZ does not treat an AI-generated message as authority to approve provider pricing, contracts, payments, tax matters, or other consequential business commitments.</p>
          </section>

          <section className={styles.section}>
            <h2>Contact</h2>
            <p>Questions about this notice can be sent to <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.</p>
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
