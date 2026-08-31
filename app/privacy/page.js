import Link from 'next/link';

export const metadata = {
  title: 'Privacy',
  description: 'Privacy information for the current Galactic Trust demo and Increase sandbox experience.',
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
        <nav aria-label="Privacy navigation" style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', marginBottom: 44 }}>
          <Link href="/" style={{ color: '#fff', textDecoration: 'none', fontWeight: 800, letterSpacing: '-0.02em' }}>✦ Galactic Trust</Link>
          <Link href="/bank/readiness" style={{ color: '#b7c5ff', textDecoration: 'none', fontWeight: 700 }}>Launch status</Link>
        </nav>

        <p style={{ color: '#9fb0ff', fontWeight: 800, letterSpacing: '0.12em', fontSize: 12 }}>GALACTIC TRUST PRIVACY</p>
        <h1 style={{ fontSize: 'clamp(42px, 8vw, 72px)', lineHeight: 0.96, letterSpacing: '-0.055em', margin: '12px 0 22px' }}>Privacy in the current demo.</h1>
        <p style={{ color: '#cbd3ff', fontSize: 18, lineHeight: 1.7, maxWidth: 760 }}>Effective August 30, 2026. This page describes the Galactic Trust demo and authorized Increase sandbox testing that exist today. It is not a bank privacy notice, and it does not describe a future live banking program.</p>

        <section style={sectionStyle}>
          <h2>1. What the app uses when you sign in</h2>
          <p style={{ color: '#cbd3ff', lineHeight: 1.75 }}>Galactic Trust uses the authentication information needed to keep you signed in, such as an account identifier, an email address made available by the sign-in provider, and session credentials. The configured authentication provider may use local storage or similar browser mechanisms to maintain that session.</p>
        </section>

        <section style={sectionStyle}>
          <h2>2. Demo data stays demo data</h2>
          <p style={{ color: '#cbd3ff', lineHeight: 1.75 }}>Illustrative balances, cards, rewards, activity, crypto practice, and ordinary demo transfers are simulated product data. Galactic Trust does not currently use this application to hold real customer deposits or move real customer money. The current application also does not execute real crypto trades.</p>
        </section>

        <section style={sectionStyle}>
          <h2>3. Increase sandbox owner testing</h2>
          <p style={{ color: '#cbd3ff', lineHeight: 1.75 }}>Authorized owner testing can connect Galactic Trust to Increase&apos;s sandbox, where all balances and ACH activity use pretend money. When a durable provider binding is available, Galactic Trust can store limited server-side references that associate the signed-in owner with the sandbox Account. Browser responses are intentionally sanitized and do not expose API keys, full provider Account or Entity identifiers, raw account numbers, or routing numbers.</p>
        </section>

        <section style={sectionStyle}>
          <h2>4. Sandbox recovery without hosted onboarding</h2>
          <p style={{ color: '#cbd3ff', lineHeight: 1.75 }}>If Increase Programs or Entities are unavailable as private sandbox features, the owner recovery flow can use a deterministic, user-scoped idempotency key to find or create one dedicated sandbox Account. That fallback can work without storing a database binding. The marker <code>SANDBOX_ACCOUNT_ONLY</code> describes this test-account path only; it is not KYC, CIP, AML, sanctions, credit, or bank-account approval.</p>
        </section>

        <section style={sectionStyle}>
          <h2>5. Hosted sandbox onboarding, when available</h2>
          <p style={{ color: '#cbd3ff', lineHeight: 1.75 }}>Where provider-hosted sandbox onboarding is available, Galactic Trust can use it instead of collecting ordinary identity fields directly in the application. Any sandbox validation remains simulated provider test behavior. It must not be treated as a real identity, compliance, credit, or banking approval decision.</p>
        </section>

        <section style={sectionStyle}>
          <h2>6. Operational records</h2>
          <p style={{ color: '#cbd3ff', lineHeight: 1.75 }}>Galactic Trust may keep limited Increase sandbox event metadata needed for webhook verification, idempotency, reconciliation, account status, and operational troubleshooting. The reconciliation design favors fingerprints and limited metadata instead of retaining raw provider webhook payloads unnecessarily.</p>
        </section>

        <section style={sectionStyle}>
          <h2>7. Service providers and secrets</h2>
          <p style={{ color: '#cbd3ff', lineHeight: 1.75 }}>Galactic Trust currently relies on infrastructure providers for hosting and authentication and on Increase for authorized pretend-money sandbox testing. Provider credentials are intended to remain server-only. Do not paste passwords, API keys, private keys, bank credentials, Social Security numbers, PINs, CVVs, recovery codes, or one-time codes into Orbit or ordinary text fields.</p>
        </section>

        <section style={sectionStyle}>
          <h2>8. What must change before any live customer program</h2>
          <p style={{ color: '#cbd3ff', lineHeight: 1.75 }}>A future live banking or crypto program would require separate provider approvals and a fresh privacy/compliance review before launch. The privacy notice would need to be updated for the actual sponsor bank or regulated provider, production data flows, retention practices, customer rights, required disclosures, security operations, and support responsibilities. The current demo privacy posture is not a substitute for that work.</p>
        </section>

        <footer style={{ ...sectionStyle, display: 'flex', flexWrap: 'wrap', gap: 18, color: '#9fb0ff' }}>
          <Link href="/terms" style={{ color: '#b7c5ff' }}>Terms</Link>
          <Link href="/bank" style={{ color: '#b7c5ff' }}>Dashboard</Link>
          <Link href="/bank/status" style={{ color: '#b7c5ff' }}>My account status</Link>
          <Link href="/bank/readiness" style={{ color: '#b7c5ff' }}>Regulated launch status</Link>
        </footer>
      </article>
    </main>
  );
}
