import Link from 'next/link';

export const metadata = {
  title: 'Contact',
  description: 'Public support and product contact information for Voxel Vault.',
};

const box = { border: '1px solid #e5dce8', borderRadius: 22, padding: 22, background: '#fff', boxShadow: '0 14px 34px rgba(75,55,90,.06)' };

export default function ContactPage() {
  return (
    <main style={{ minHeight: '100vh', background: 'linear-gradient(180deg,#fffdf8,#fffaf0)', color: '#17131d', padding: '24px 18px 110px', fontFamily: 'Inter,ui-rounded,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>
      <div style={{ width: 'min(760px,100%)', margin: '0 auto' }}>
        <Link href="/" style={{ color: '#6f3df4', textDecoration: 'none', fontSize: 11, fontWeight: 900 }}>← VOXEL VAULT</Link>
        <p style={{ margin: '42px 0 8px', color: '#6f3df4', fontSize: 9, fontWeight: 950, letterSpacing: '.14em' }}>CONTACT</p>
        <h1 style={{ margin: 0, fontSize: 'clamp(42px,8vw,66px)', lineHeight: .96, letterSpacing: '-.055em' }}>Questions, bugs or product feedback?</h1>
        <p style={{ color: '#706873', lineHeight: 1.7, fontSize: 14, margin: '18px 0 26px' }}>For public product questions and reproducible bugs, use the Voxel Vault GitHub issue tracker. Account, payment, property-address, identity, banking, private-key or other sensitive information should never be posted in a public issue.</p>

        <section style={box}>
          <h2 style={{ margin: '0 0 8px', fontSize: 24 }}>Public support</h2>
          <p style={{ color: '#736b76', fontSize: 13, lineHeight: 1.65, margin: '0 0 16px' }}>Describe what happened, the page you were on, your device/browser, and the exact non-sensitive error message. Screenshots should be checked for addresses, payment details, emails, wallet secrets or other private data before posting.</p>
          <a href="https://github.com/hartensteindominic/Voxel-Vault/issues" target="_blank" rel="noreferrer" style={{ minHeight: 48, padding: '0 17px', borderRadius: 14, background: '#6f3df4', color: '#fff', textDecoration: 'none', fontSize: 10, fontWeight: 950, display: 'inline-flex', alignItems: 'center' }}>OPEN GITHUB ISSUES →</a>
        </section>

        <section style={{ ...box, marginTop: 12, background: '#251832', color: '#fff' }}>
          <h2 style={{ margin: '0 0 8px', fontSize: 22 }}>Keep private information private</h2>
          <p style={{ color: '#d0c5d7', fontSize: 13, lineHeight: 1.65, margin: 0 }}>Do not publish private keys, seed phrases, bank details, identity documents, full payment information, private deeds or leases, tenant information, or an unredacted property-address support history in GitHub issues. Use the private support method shown by the relevant account/payment provider when one is required.</p>
        </section>

        <footer style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 34, paddingTop: 18, borderTop: '1px solid #e5ded7' }}><Link href="/about">About</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/demo">Demo</Link></footer>
      </div>
    </main>
  );
}
