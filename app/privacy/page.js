export const metadata = { title: 'Privacy | Voxel Vault' };

const sectionStyle = { marginTop: 28 };
const textStyle = { color: '#a4abbb', lineHeight: 1.7, fontSize: 13, margin: 0 };

export default function PrivacyPage() {
  return (
    <main style={{ minHeight: '100vh', background: '#070912', color: '#eef0f7', padding: '24px 18px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <a href="/" style={{ color: '#9b7cff', textDecoration: 'none', fontSize: 13 }}>← Voxel Vault</a>
        <h1 style={{ fontSize: 42, margin: '28px 0 4px', letterSpacing: '-.04em' }}>Privacy</h1>
        <p style={{ color: '#737c8f', fontSize: 12 }}>Last updated August 24, 2026.</p>
        <section style={sectionStyle}><h2>What we use</h2><p style={textStyle}>Voxel Vault may process account, wallet, transaction, device, and gameplay information needed to operate the service.</p></section>
        <section style={sectionStyle}><h2>VoxelPop conversion analytics</h2><p style={textStyle}>VoxelPop uses privacy-minimized first-party conversion analytics to understand stages such as studio visits, checkout starts, completed purchases, successful image generation, completed 3D meshes, and GLB downloads. These funnel records may include a randomly generated session identifier and campaign attribution such as UTM source, medium, campaign, or content. The VoxelPop conversion analytics table is not designed to store the text of your prompt, your email address, or your IP address.</p></section>
        <section style={sectionStyle}><h2>Location</h2><p style={textStyle}>Location is optional and may power nearby discovery when enabled. Precise location is not intended to become an on-chain ownership record.</p></section>
        <section style={sectionStyle}><h2>Third parties</h2><p style={textStyle}>Blockchain networks, wallet providers, hosting, analytics, payments, storage, AI generation providers, and other integrations may process information under their own policies.</p></section>
        <section style={sectionStyle}><h2>Your choices</h2><p style={textStyle}>You can deny location access and disconnect your wallet from the application.</p></section>
        <section style={sectionStyle}><h2>Updates</h2><p style={textStyle}>This notice may change as the platform grows. The current version will be published here.</p></section>
      </div>
    </main>
  );
}
