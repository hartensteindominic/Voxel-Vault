const contactEmail = 'connectedtechpartners@gmail.com';

export const metadata = {
  title: 'Terms | ORXYZ',
  description: 'Terms and service-role information for the ORXYZ public website.',
};

export default function TermsPage() {
  return (
    <main style={{ minHeight: '100vh', background: '#08090d', color: '#f5f7fb', padding: '64px 20px', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ maxWidth: 820, margin: '0 auto' }}>
        <a href="/" style={{ color: 'rgba(255,255,255,.82)', textDecoration: 'none', fontWeight: 700 }}>← ORXYZ</a>
        <h1 style={{ margin: '34px 0 10px', fontSize: 'clamp(44px,8vw,72px)', letterSpacing: '-.055em', lineHeight: 1 }}>Terms</h1>
        <p style={{ color: 'rgba(255,255,255,.36)', fontSize: 13 }}>Last updated: September 9, 2026</p>

        <div style={{ marginTop: 48, display: 'grid', gap: 34, color: 'rgba(255,255,255,.58)', lineHeight: 1.75, fontSize: 15 }}>
          <section>
            <h2 style={{ color: '#fff', fontSize: 21, marginBottom: 8 }}>ORXYZ's role</h2>
            <p>ORXYZ provides independent technology sourcing, introduction, and coordination services. ORXYZ is not, by default, the manufacturer, installer, lender, carrier, payment processor, technical support provider, or equipment owner for third-party products and services introduced through the business.</p>
          </section>
          <section>
            <h2 style={{ color: '#fff', fontSize: 21, marginBottom: 8 }}>Provider terms control</h2>
            <p>Pricing, availability, service area, equipment specifications, installation, warranties, financing, customer support, contract duration, revenue share, and other provider-specific obligations are determined by the applicable third-party provider and remain subject to that provider's current written approval and agreement with the business customer.</p>
          </section>
          <section>
            <h2 style={{ color: '#fff', fontSize: 21, marginBottom: 8 }}>No commitment without approval</h2>
            <p>An inquiry, fit check, evaluation, referral, or introduction does not by itself create a purchase obligation, installation commitment, or deployment. Businesses should review the applicable provider's written terms before accepting any commercial commitment.</p>
          </section>
          <section>
            <h2 style={{ color: '#fff', fontSize: 21, marginBottom: 8 }}>Referral compensation</h2>
            <p>ORXYZ may receive referral, introducer, affiliate, or similar compensation from a third-party provider when a documented provider milestone is reached. The existence of potential compensation does not authorize ORXYZ to bind a business to a provider or approve provider terms on the business's behalf.</p>
          </section>
          <section>
            <h2 style={{ color: '#fff', fontSize: 21, marginBottom: 8 }}>Information and accuracy</h2>
            <p>ORXYZ aims to communicate provider and business information accurately, but third-party offerings can change. Material commercial terms should be confirmed directly in current written provider documentation before reliance.</p>
          </section>
          <section>
            <h2 style={{ color: '#fff', fontSize: 21, marginBottom: 8 }}>AI-assisted administration</h2>
            <p>Routine research, drafting, scheduling, and administrative communication may be AI-assisted. Consequential provider terms, payment, tax, account, contractual, and business commitments are reviewed personally by Dominic Hartenstein.</p>
          </section>
          <section>
            <h2 style={{ color: '#fff', fontSize: 21, marginBottom: 8 }}>Contact</h2>
            <p>Questions about these terms can be sent to <a href={`mailto:${contactEmail}`} style={{ color: '#fff' }}>{contactEmail}</a>.</p>
          </section>
        </div>
      </div>
    </main>
  );
}
