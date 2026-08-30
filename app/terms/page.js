import Link from 'next/link';

export const metadata = {
  title: 'Terms',
  description: 'Terms for the Galactic Trust financial technology application.',
  alternates: { canonical: '/terms' },
};

const sectionStyle = {
  padding: '22px 0',
  borderTop: '1px solid rgba(255,255,255,0.12)',
};

export default function TermsPage() {
  return (
    <main style={{ minHeight: '100vh', background: '#07103d', color: '#f7f8ff', fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', padding: '48px 20px 80px' }}>
      <article style={{ width: 'min(860px, 100%)', margin: '0 auto' }}>
        <nav style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', marginBottom: 44 }}>
          <Link href="/" style={{ color: '#fff', textDecoration: 'none', fontWeight: 800, letterSpacing: '-0.02em' }}>✦ Galactic Trust</Link>
          <Link href="/bank/readiness" style={{ color: '#b7c5ff', textDecoration: 'none', fontWeight: 700 }}>Launch status</Link>
        </nav>

        <p style={{ color: '#9fb0ff', fontWeight: 800, letterSpacing: '0.12em', fontSize: 12 }}>GALACTIC TRUST TERMS</p>
        <h1 style={{ fontSize: 'clamp(42px, 8vw, 72px)', lineHeight: 0.96, letterSpacing: '-0.055em', margin: '12px 0 22px' }}>Clear terms for a product that is still sandbox-first.</h1>
        <p style={{ color: '#cbd3ff', fontSize: 18, lineHeight: 1.7, maxWidth: 760 }}>Effective August 30, 2026. These terms apply to the Galactic Trust application and its current demo and sandbox features.</p>

        <section style={sectionStyle}>
          <h2>1. Galactic Trust is not a bank</h2>
          <p style={{ color: '#cbd3ff', lineHeight: 1.75 }}>Galactic Trust is a financial technology product, not a bank. Galactic Trust does not currently accept or hold real customer deposits, open production deposit accounts, issue live payment cards, or move real customer money.</p>
        </section>

        <section style={sectionStyle}>
          <h2>2. Current financial features are demo or sandbox features</h2>
          <p style={{ color: '#cbd3ff', lineHeight: 1.75 }}>Balances, transfers, cards, rewards, account activity, and similar experiences may be illustrative demo data or provider-backed test data. The connected Increase environment is a pretend-money sandbox. Sandbox transfers do not debit or credit real external bank accounts.</p>
        </section>

        <section style={sectionStyle}>
          <h2>3. No deposit-insurance representation</h2>
          <p style={{ color: '#cbd3ff', lineHeight: 1.75 }}>Galactic Trust is not an FDIC-insured institution and does not currently make a deposit-insurance claim. If a live banking program is launched in the future, the actual sponsor bank, banking services, account terms, and any applicable deposit-insurance disclosure must be identified in separate bank-approved materials.</p>
        </section>

        <section style={sectionStyle}>
          <h2>4. Accounts and access</h2>
          <p style={{ color: '#cbd3ff', lineHeight: 1.75 }}>You are responsible for keeping access to your sign-in account and device secure. Do not provide API keys, passwords, private keys, bank credentials, Social Security numbers, or other sensitive secrets to Galactic Trust chat or ordinary application text fields.</p>
        </section>

        <section style={sectionStyle}>
          <h2>5. Sandbox onboarding is not real KYC approval</h2>
          <p style={{ color: '#cbd3ff', lineHeight: 1.75 }}>Any current Increase sandbox onboarding, entity validation, account creation, account numbers, funding simulation, or transfer simulation is test infrastructure only. A sandbox validation state is not a real KYC, CIP, AML, sanctions, credit, or bank-account approval decision.</p>
        </section>

        <section style={sectionStyle}>
          <h2>6. Future regulated services require separate approval</h2>
          <p style={{ color: '#cbd3ff', lineHeight: 1.75 }}>Environment variables, software switches, authentication, or an application status screen cannot make a regulated banking service live. A future production launch requires an approved provider and sponsor-bank program, production acceptance, required consumer disclosures, operational controls, and any separate terms required by those providers.</p>
        </section>

        <section style={sectionStyle}>
          <h2>7. Availability and changes</h2>
          <p style={{ color: '#cbd3ff', lineHeight: 1.75 }}>Demo and sandbox features may change, be unavailable, be reset, or be removed. Galactic Trust may update these terms as the product changes. A material future production banking launch should be accompanied by the appropriate live-program agreements and disclosures rather than silently converting sandbox terms into bank-account terms.</p>
        </section>

        <section style={sectionStyle}>
          <h2>8. No investment, tax, or legal advice</h2>
          <p style={{ color: '#cbd3ff', lineHeight: 1.75 }}>The application and its demo information are provided for product use and evaluation. They are not personalized investment, tax, legal, or credit advice.</p>
        </section>

        <footer style={{ ...sectionStyle, display: 'flex', flexWrap: 'wrap', gap: 18, color: '#9fb0ff' }}>
          <Link href="/privacy" style={{ color: '#b7c5ff' }}>Privacy</Link>
          <Link href="/bank/status" style={{ color: '#b7c5ff' }}>My account status</Link>
          <Link href="/bank/readiness" style={{ color: '#b7c5ff' }}>Regulated launch status</Link>
        </footer>
      </article>
    </main>
  );
}
