import Link from 'next/link';

export const metadata = { title: 'Privacy', description: 'How Voxel Vault handles property photos, account data, payments, maps and optional blockchain actions.' };

const sectionStyle = { marginTop: 28 };
const textStyle = { color: '#6f6873', lineHeight: 1.75, fontSize: 13, margin: 0 };

export default function PrivacyPage() {
  return (
    <main style={{ minHeight: '100vh', background: 'linear-gradient(180deg,#fffdf8,#fffaf0)', color: '#17131d', padding: '24px 18px 110px', fontFamily: 'Inter,ui-rounded,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <Link href="/" style={{ color: '#6f3df4', textDecoration: 'none', fontSize: 11, fontWeight: 900 }}>← VOXEL VAULT</Link>
        <h1 style={{ fontSize: 'clamp(42px,8vw,64px)', margin: '36px 0 5px', letterSpacing: '-.055em' }}>Privacy</h1>
        <p style={{ color: '#817987', fontSize: 11 }}>Last updated August 29, 2026.</p>

        <section style={sectionStyle}><h2>Property photos</h2><p style={textStyle}>During the normal VoxelPop property-creation flow, the authorized source photo is used in the browser and is designed to stay on your device rather than being uploaded for 3D generation. The browser may keep a private on-device copy so a paid creation can resume or a saved property can reuse its photo. Clearing browser storage, using private browsing, changing devices, or browser restrictions can remove that local copy.</p></section>
        <section style={sectionStyle}><h2>Account and purchase records</h2><p style={textStyle}>Sign-in may process account identifiers needed to associate paid creations and saved items with the correct user. Payment processors process checkout and payment information under their own privacy terms. Voxel Vault may retain payment-session identifiers, purchase status, amount, product type and other limited records needed to verify that a $4.99 digital creation was actually paid for and to avoid charging twice for the same verified creation.</p></section>
        <section style={sectionStyle}><h2>Derived digital assets</h2><p style={textStyle}>A generated preview, voxel recipe, saved property record, map context, digital collectible record or mint record may be stored separately from the original source photo. These are digital-product records and are not converted into deed, title, equity or occupancy records.</p></section>
        <section style={sectionStyle}><h2>Maps and location</h2><p style={textStyle}>If you use map or nearby features, an address, place selection, coordinates or device location may be processed by Voxel Vault and third-party mapping or geocoding providers. Map data is used as place context and is not proof of ownership, a survey or a title record.</p></section>
        <section style={sectionStyle}><h2>Optional wallets and blockchain</h2><p style={textStyle}>A wallet is not required for the normal VoxelPop creation flow. If you later choose to mint or use a blockchain feature, wallet addresses, transaction hashes and public token metadata may be visible on the relevant public blockchain and cannot be treated as private once published.</p></section>
        <section style={sectionStyle}><h2>Analytics and operations</h2><p style={textStyle}>Voxel Vault may use privacy-minimized operational or conversion events to understand whether pages load, checkout starts or completes, and creation stages succeed or fail. Public repositories and logs must not contain private keys, seed phrases, bank details, identity documents, tenant PII, private deeds or leases, or other sensitive customer data.</p></section>
        <section style={sectionStyle}><h2>Third-party services</h2><p style={textStyle}>Authentication, hosting, payments, mapping, wallet, blockchain and other optional integrations may process information under their own policies. A third-party service is only active when the corresponding feature is actually configured and used.</p></section>
        <section style={sectionStyle}><h2>Your choices</h2><p style={textStyle}>You can choose not to use location, wallet or optional minting features. You can also clear browser storage, although doing so may remove device-local source photos or local creation state needed to resume an unfinished flow.</p></section>
        <section style={sectionStyle}><h2>Questions</h2><p style={textStyle}>For public product questions, use the Contact page. Do not post account, payment, property-address, identity, banking, private-key or other sensitive information in a public GitHub issue.</p></section>

        <footer style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 36, paddingTop: 18, borderTop: '1px solid #e5ded7' }}><Link href="/terms">Terms</Link><Link href="/about">About</Link><Link href="/contact">Contact</Link><Link href="/demo">Demo</Link></footer>
      </div>
    </main>
  );
}
