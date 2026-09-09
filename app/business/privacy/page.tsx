export const metadata = {
  title: 'Galactic Trust Business Privacy Policy',
  description: 'Privacy policy for the Galactic Trust Business iOS app.'
};

const card = {
  background: '#ffffff',
  border: '1px solid rgba(70, 55, 180, 0.10)',
  borderRadius: 24,
  padding: 24,
  boxShadow: '0 18px 55px rgba(42, 34, 120, 0.08)'
};

export default function BusinessPrivacyPolicy() {
  return (
    <main style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#f8f9ff,#f3f0ff)', color: '#0b123a', padding: '48px 18px', fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif' }}>
      <div style={{ width: 'min(920px, 100%)', margin: '0 auto' }}>
        <a href="/business" style={{ color: '#4b32df', textDecoration: 'none', fontWeight: 700 }}>← Galactic Trust Business</a>

        <section style={{ ...card, marginTop: 20, background: 'linear-gradient(135deg,#0a155d,#3d22e8 58%,#8c31ee)', color: '#fff' }}>
          <p style={{ margin: 0, opacity: 0.78, fontWeight: 800, letterSpacing: '0.08em', fontSize: 12 }}>PRIVACY POLICY · NATIVE iOS APP</p>
          <h1 style={{ fontSize: 'clamp(34px,7vw,58px)', lineHeight: 1.02, margin: '12px 0' }}>Your business financial records stay on your device.</h1>
          <p style={{ fontSize: 18, lineHeight: 1.6, maxWidth: 720, marginBottom: 0, opacity: 0.88 }}>This policy covers Galactic Trust Business for iPhone and iPad, version 1.0. Last updated August 31, 2026.</p>
        </section>

        <div style={{ display: 'grid', gap: 16, marginTop: 16 }}>
          <section style={card}>
            <h2>Data the iOS app processes</h2>
            <p>The app can process business transaction records, merchant or customer names, memos, amounts, dates, categories, recurring-cost flags, invoice information, and a business display name that you manually enter or import from a CSV file.</p>
          </section>

          <section style={card}>
            <h2>Where that data goes</h2>
            <p>Version 1.0 does not upload those business financial records to a Galactic server. Records are stored inside the app container on your Apple device using iOS file protection. The financial intelligence and question-and-answer features in this version operate on the records stored by the app.</p>
          </section>

          <section style={card}>
            <h2>Data collection and tracking</h2>
            <p>The native iOS version 1.0 does not include an advertising SDK, cross-app tracking, or a Galactic analytics SDK, and it does not intentionally collect the financial records you enter or import. Apple may independently process App Store, crash, device, or diagnostics information under Apple’s own terms and settings.</p>
          </section>

          <section style={card}>
            <h2>AI financial manager</h2>
            <p>The AI Financial Manager in version 1.0 is read-only financial intelligence. It summarizes and explains the records stored in the app and can show supporting transaction evidence. It cannot initiate transfers, debit accounts, approve payments, trade securities or crypto, or make changes at a bank.</p>
          </section>

          <section style={card}>
            <h2>Deleting data</h2>
            <p>You can delete individual transaction records inside the app, clear the local financial workspace from the app settings, or remove all app data by deleting the app from the device. The app does not require a Galactic account in version 1.0.</p>
          </section>

          <section style={card}>
            <h2>Future integrations</h2>
            <p>If a future release adds cloud AI, bank-account connections, authentication, analytics, team sync, or other network services, the app, privacy manifest, App Store privacy disclosures, and this policy must be updated before those features are released.</p>
          </section>

          <section style={card}>
            <h2>Financial-services boundary</h2>
            <p>Galactic Trust Business is financial-management software. The native business app does not hold customer deposits, move money, provide bank accounts, issue cards, make loans, execute investments, or provide tax or accounting services.</p>
          </section>

          <section style={card}>
            <h2>Questions</h2>
            <p>For product or privacy questions, use the Galactic support page.</p>
            <a href="/business/support" style={{ color: '#4b32df', fontWeight: 800 }}>Open Business Support →</a>
          </section>
        </div>
      </div>
    </main>
  );
}
