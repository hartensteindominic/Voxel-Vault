export const metadata = {
  title: 'Galactic Trust Business Support',
  description: 'Support for the Galactic Trust Business iOS app.'
};

const card = {
  background: '#ffffff',
  border: '1px solid rgba(70, 55, 180, 0.10)',
  borderRadius: 24,
  padding: 24,
  boxShadow: '0 18px 55px rgba(42, 34, 120, 0.08)'
};

export default function BusinessSupport() {
  return (
    <main style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#f8f9ff,#f3f0ff)', color: '#0b123a', padding: '48px 18px', fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif' }}>
      <div style={{ width: 'min(900px, 100%)', margin: '0 auto' }}>
        <a href="/business" style={{ color: '#4b32df', textDecoration: 'none', fontWeight: 700 }}>← Galactic Trust Business</a>

        <section style={{ ...card, marginTop: 20, background: 'linear-gradient(135deg,#0a155d,#3d22e8 58%,#8c31ee)', color: '#fff' }}>
          <p style={{ margin: 0, opacity: 0.78, fontWeight: 800, letterSpacing: '0.08em', fontSize: 12 }}>BUSINESS APP SUPPORT</p>
          <h1 style={{ fontSize: 'clamp(36px,7vw,58px)', lineHeight: 1.04, margin: '12px 0' }}>Help with Galactic Trust Business.</h1>
          <p style={{ fontSize: 18, lineHeight: 1.6, marginBottom: 0, opacity: 0.88 }}>Support for the native iPhone and iPad business-finance monitor.</p>
        </section>

        <div style={{ display: 'grid', gap: 16, marginTop: 16 }}>
          <section style={card}>
            <h2>Importing transactions</h2>
            <p>Open Transactions, tap the import icon, and choose a CSV from Files. Common Date, Description or Merchant, Amount, Debit, Credit, Type, and Category columns are recognized. If the import fails, confirm the file has a header row and at least one non-zero transaction.</p>
          </section>

          <section style={card}>
            <h2>AI answers look incomplete</h2>
            <p>The financial manager can only analyze the records present in the app. Import a more complete transaction history and verify categories before relying on trend or runway estimates. Tap an insight to inspect its transaction evidence.</p>
          </section>

          <section style={card}>
            <h2>Security</h2>
            <p>Version 1.0 keeps imported business records in protected local app storage and does not initiate financial transactions. Never put bank passwords, card PINs, CVVs, one-time codes, or recovery secrets into transaction memos.</p>
          </section>

          <section style={card}>
            <h2>Report a problem</h2>
            <p>Please include the app version, iOS version, device model, what you expected to happen, and the steps that reproduce the issue. Do not include private financial records, passwords, account numbers, card numbers, or authentication codes.</p>
            <a href="https://github.com/hartensteindominic/Galactic/issues" style={{ display: 'inline-block', marginTop: 8, color: '#4b32df', fontWeight: 800 }}>Open the Galactic issue tracker →</a>
          </section>

          <section style={card}>
            <h2>Privacy</h2>
            <p>Read the policy specific to the native business app.</p>
            <a href="/business/privacy" style={{ color: '#4b32df', fontWeight: 800 }}>Business App Privacy Policy →</a>
          </section>
        </div>
      </div>
    </main>
  );
}
