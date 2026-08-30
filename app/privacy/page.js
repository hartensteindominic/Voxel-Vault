import Link from 'next/link';

export const metadata = {
  title: 'Privacy',
  description: 'Privacy information for the Galactic Trust financial technology application.',
  alternates: { canonical: '/privacy' },
};

const sectionStyle = {
  padding: '22px 0',
  borderTop: '1px solid rgba(255,255,255,0.12)',
};

export default function PrivacyPage() {
  return (
    <main style={{ minHeight: '100vh', background: '#07103d', color: '#f7f8ff', fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', padding: '48px 20px 80px' }}>
      <article style={{ width: 'min(860px, 100%)', margin: '0 auto' }}>
        <nav style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', marginBottom: 44 }}>
          <Link href="/" style={{ color: '#fff', textDecoration: 'none', fontWeight: 800, letterSpacing: '-0.02em' }}>✦ Galactic Trust</Link>
          <Link href="/bank/readiness" style={{ color: '#b7c5ff', textDecoration: 'none', fontWeight: 700 }}>Launch status</Link>
        </nav>

        <p style={{ color: '#9fb0ff', fontWeight: 800, letterSpacing: '0.12em', fontSize: 12 }}>GALACTIC TRUST PRIVACY</p>
        <h1 style={{ fontSize: 'clamp(42px, 8vw, 72px)', lineHeight: 0.96, letterSpacing: '-0.055em', margin: '12px 0 22px' }}>Collect less. Keep provider secrets off the client.</h1>
        <p style={{ color: '#cbd3ff', fontSize: 18, lineHeight: 1.7, maxWidth: 760 }}>Effective August 30, 2026. This notice describes the current Galactic Trust demo and sandbox application. It is not a future sponsor bank&apos;s privacy notice.</p>

        <section style={sectionStyle}>
          <h2>1. Current account information</h2>
          <p style={{ color: '#cbd3ff', lineHeight: 1.75 }}>When you sign in, Galactic Trust uses authentication information needed to maintain your session, such as the account identifier, email address made available through the sign-in provider, and session credentials. Browser authentication may use local storage or similar browser mechanisms through the configured authentication provider.</p>
        </section>

        <section style={sectionStyle}>
          <h2>2. Increase sandbox information</h2>
          <p style={{ color: '#cbd3ff', lineHeight: 1.75 }}>For authorized owner testing, Galactic Trust may store server-side references that bind an authenticated user to an Increase sandbox Entity and Account. Browser responses are deliberately limited and do not expose full provider Entity or Account identifiers, API keys, raw account numbers, or routing numbers.</p>
        </section>

        <section style={sectionStyle}>
          <h2>3. Hosted sandbox onboarding</h2>
          <p style={{ color: '#cbd3ff', lineHeight: 1.75 }}>The current integration uses provider-hosted sandbox onboarding so Galactic Trust does not need ordinary application forms for sensitive identity fields. Sandbox validation is simulated test behavior and is not a real KYC, CIP, AML, sanctions, credit, or bank-account approval decision.</p>
        </section>

        <section style={sectionStyle}>
          <h2>4. Provider event and reconciliation records</h2>
          <p style={{ color: '#cbd3ff', lineHeight: 1.75 }}>Galactic Trust records limited Increase sandbox event metadata needed for webhook verification, idempotency, reconciliation, and operational status. The application is designed to retain a payload fingerprint rather than raw webhook payloads in its reconciliation ledger.</p>
        </section>

        <section style={sectionStyle}>
          <h2>5. Service providers</h2>
          <p style={{ color: '#cbd3ff', lineHeight: 1.75 }}>Galactic Trust currently relies on infrastructure providers for application hosting and authentication, and on Increase for the pretend-money banking sandbox. Those providers process information under their own applicable terms and privacy practices. A future live banking program would require its own approved privacy disclosures and sponsor-bank/provider responsibilities.</p>
        </section>

        <section style={sectionStyle}>
          <h2>6. Sensitive information and secrets</h2>
          <p style={{ color: '#cbd3ff', lineHeight: 1.75 }}>Do not paste passwords, API keys, private keys, bank credentials, Social Security numbers, or other sensitive secrets into Galactic Trust chat or ordinary text fields. Increase provider credentials are intended to remain server-only and must not be exposed through browser-visible environment variables.</p>
        </section>

        <section style={sectionStyle}>
          <h2>7. Demo and sandbox data</h2>
          <p style={{ color: '#cbd3ff', lineHeight: 1.75 }}>Current balances, cards, transfers, rewards, and provider-backed banking data are demo or pretend-money sandbox information. Galactic Trust does not currently use this application to hold real customer deposits or move real customer money.</p>
        </section>

        <section style={sectionStyle}>
          <h2>8. Future production changes</h2>
          <p style={{ color: '#cbd3ff', lineHeight: 1.75 }}>If Galactic Trust later launches an approved production banking program, this notice will need to be updated to reflect the actual sponsor bank, production providers, categories of information, retention practices, customer rights, required notices, and regulated data-handling responsibilities before those live services are represented as available.</p>
        </section>

        <footer style={{ ...sectionStyle, display: 'flex', flexWrap: 'wrap', gap: 18, color: '#9fb0ff' }}>
          <Link href="/terms" style={{ color: '#b7c5ff' }}>Terms</Link>
          <Link href="/bank/status" style={{ color: '#b7c5ff' }}>My account status</Link>
          <Link href="/bank/readiness" style={{ color: '#b7c5ff' }}>Regulated launch status</Link>
        </footer>
      </article>
    </main>
  );
}
