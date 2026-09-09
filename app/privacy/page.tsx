const contactEmail = 'connectedtechpartners@gmail.com';

export const metadata = {
  title: 'Privacy | ORXYZ',
  description: 'Privacy information for the ORXYZ public website.',
};

export default function PrivacyPage() {
  return (
    <main style={{ minHeight: '100vh', background: '#08090d', color: '#f5f7fb', padding: '64px 20px', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ maxWidth: 820, margin: '0 auto' }}>
        <a href="/" style={{ color: 'rgba(255,255,255,.82)', textDecoration: 'none', fontWeight: 700 }}>← ORXYZ</a>
        <h1 style={{ margin: '34px 0 10px', fontSize: 'clamp(44px,8vw,72px)', letterSpacing: '-.055em', lineHeight: 1 }}>Privacy</h1>
        <p style={{ color: 'rgba(255,255,255,.36)', fontSize: 13 }}>Last updated: September 9, 2026</p>

        <div style={{ marginTop: 48, display: 'grid', gap: 34, color: 'rgba(255,255,255,.58)', lineHeight: 1.75, fontSize: 15 }}>
          <section>
            <h2 style={{ color: '#fff', fontSize: 21, marginBottom: 8 }}>Information you provide</h2>
            <p>If you contact ORXYZ by email, you may provide your name, email address, company information, business needs, or other information you choose to include. ORXYZ uses that information to review and respond to the inquiry and, where appropriate, coordinate potential technology opportunities.</p>
          </section>
          <section>
            <h2 style={{ color: '#fff', fontSize: 21, marginBottom: 8 }}>Third-party providers</h2>
            <p>When an opportunity may require a third-party technology provider, ORXYZ aims to keep identifying or confidential business information limited to what is appropriate for evaluation and to obtain permission before a substantive provider handoff when practical.</p>
          </section>
          <section>
            <h2 style={{ color: '#fff', fontSize: 21, marginBottom: 8 }}>Website data</h2>
            <p>This version of the ORXYZ website does not intentionally use advertising trackers or sell visitor information. Hosting, security, domain, and infrastructure providers may process standard technical information required to deliver and protect the site.</p>
          </section>
          <section>
            <h2 style={{ color: '#fff', fontSize: 21, marginBottom: 8 }}>AI-assisted administration</h2>
            <p>Routine research, drafting, scheduling, and administrative communication may be AI-assisted. ORXYZ does not treat an AI-generated message as authority to approve provider pricing, contracts, payments, tax matters, or other consequential business commitments.</p>
          </section>
          <section>
            <h2 style={{ color: '#fff', fontSize: 21, marginBottom: 8 }}>Contact</h2>
            <p>Questions about this notice can be sent to <a href={`mailto:${contactEmail}`} style={{ color: '#fff' }}>{contactEmail}</a>.</p>
          </section>
        </div>
      </div>
    </main>
  );
}
