import Link from 'next/link';

export const metadata = { title: 'Privacy | Voxel Vault' };

const sectionStyle = { marginTop: 22, padding: '18px 20px', border: '1px solid #e7dee8', borderRadius: 20, background: 'rgba(255,255,255,.76)' };
const textStyle = { color: '#746b75', lineHeight: 1.65, fontSize: 12, margin: 0 };

export default function PrivacyPage() {
  return <main style={{ minHeight: '100vh', background: 'radial-gradient(circle at 10% 8%,#efffb3 0,transparent 25%),radial-gradient(circle at 92% 10%,#eee4ff 0,transparent 28%),#fffaf0', color: '#261a2a', padding: '18px 14px 12px', fontFamily: 'Inter,ui-rounded,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <Link href="/" style={{ color: '#5e37c7', textDecoration: 'none', fontSize: 10, fontWeight: 950 }}>← VOXEL VAULT</Link>
        <div style={{ display: 'flex', gap: 7 }}><Link href="/property" style={pill}>Create</Link><Link href="/terms" style={pill}>Terms</Link></div>
      </nav>
      <header style={{ padding: '42px 0 12px', textAlign: 'center' }}>
        <small style={{ color: '#7138f5', fontWeight: 1000, fontSize: 8, letterSpacing: '.15em' }}>PRIVACY</small>
        <h1 style={{ fontSize: 'clamp(44px,8vw,68px)', margin: '8px 0 6px', letterSpacing: '-.06em', lineHeight: .94 }}>Your photo.<br/><span style={{ color: '#7138f5' }}>Your choices.</span></h1>
        <p style={{ color: '#8d838d', fontSize: 10 }}>Last updated August 29, 2026.</p>
      </header>

      <section style={sectionStyle}><h2 style={heading}>Property photos</h2><p style={textStyle}>In the current guided VoxelPop property creation flow, your authorized source photo is kept in your browser/device storage through checkout and local creation instead of being uploaded to Voxel Vault for generation. If you later use a different feature or third-party integration that requires an upload, that feature should disclose it separately.</p></section>
      <section style={sectionStyle}><h2 style={heading}>Account and payments</h2><p style={textStyle}>Sign-in and payment providers may process the account and transaction information needed to authenticate you, verify purchases, prevent duplicate charges, and reconnect finished creations to your account. Their own privacy policies also apply.</p></section>
      <section style={sectionStyle}><h2 style={heading}>Product analytics</h2><p style={textStyle}>Voxel Vault may use privacy-minimized first-party analytics to understand product stages such as visits, checkout starts, completed purchases, successful local creation steps, and downloads. Funnel records may include a random session identifier and campaign attribution such as UTM source, medium, campaign, or content. They are not designed to store the text of private property photos, private keys, or banking credentials.</p></section>
      <section style={sectionStyle}><h2 style={heading}>Location and World</h2><p style={textStyle}>Location and property-address matching are optional. They may be used to place a finished digital model against source-backed map context. Public World uses privacy-rounded coordinates; a location reference is not an ownership record.</p></section>
      <section style={sectionStyle}><h2 style={heading}>Third parties</h2><p style={textStyle}>Hosting, authentication, payments, wallet providers, blockchain networks, analytics, map/data providers, and other integrations may process information under their own policies when you use those features.</p></section>
      <section style={sectionStyle}><h2 style={heading}>Your choices</h2><p style={textStyle}>You can decline optional location access, choose not to mint, disconnect wallets, and avoid optional provider-backed or experimental tools. The core property creation flow does not require a wallet.</p></section>
      <section style={sectionStyle}><h2 style={heading}>Updates</h2><p style={textStyle}>This notice may change as Voxel Vault changes. The current version will be published here.</p></section>
    </div>
  </main>;
}

const heading = { margin: '0 0 7px', fontSize: 20, letterSpacing: '-.03em' };
const pill = { padding: '8px 10px', border: '1px solid #e0d8e4', borderRadius: 999, background: '#ffffffba', color: '#655b69', textDecoration: 'none', fontSize: 8, fontWeight: 950 };
