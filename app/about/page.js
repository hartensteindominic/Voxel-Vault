import Link from 'next/link';

export const metadata = {
  title: 'About',
  description: 'What Voxel Vault currently ships: a focused property-photo to 3D VoxelPop creator with optional downstream mapping and minting.',
};

const card = { border: '1px solid #e7dfe9', borderRadius: 22, padding: 22, background: 'rgba(255,255,255,.86)', boxShadow: '0 14px 34px rgba(75,55,90,.06)' };
const copy = { color: '#6f6873', fontSize: 13, lineHeight: 1.7, margin: 0 };

export default function AboutPage() {
  return (
    <main style={{ minHeight: '100vh', background: 'linear-gradient(180deg,#fffdf8,#fffaf0)', color: '#17131d', padding: '24px 18px 110px', fontFamily: 'Inter,ui-rounded,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>
      <div style={{ width: 'min(820px,100%)', margin: '0 auto' }}>
        <Link href="/" style={{ color: '#6f3df4', textDecoration: 'none', fontSize: 11, fontWeight: 900 }}>← VOXEL VAULT</Link>
        <p style={{ margin: '42px 0 8px', color: '#6f3df4', fontSize: 9, fontWeight: 950, letterSpacing: '.14em' }}>ABOUT THE PRODUCT</p>
        <h1 style={{ margin: 0, fontSize: 'clamp(42px,8vw,68px)', lineHeight: .95, letterSpacing: '-.055em' }}>One clear job:<br/>turn your property photo into a 3D voxel.</h1>
        <p style={{ ...copy, fontSize: 16, marginTop: 18, maxWidth: 720 }}>Voxel Vault's consumer front door is VoxelPop: upload a property photo you took or are allowed to use, pay $4.99 for one digital creation, review the recognizable 3D preview, approve it, then build the separate movable voxel. Minting is optional.</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 12, marginTop: 28 }}>
          <section style={card}><b style={{ color: '#6f3df4' }}>CREATIVE</b><h2 style={{ fontSize: 21, margin: '6px 0 8px' }}>Photo → 3D → voxel</h2><p style={copy}>The source photo remains device-local during normal creation. The local voxel build does not require Meshy credits.</p></section>
          <section style={card}><b style={{ color: '#6f3df4' }}>OPTIONAL</b><h2 style={{ fontSize: 21, margin: '6px 0 8px' }}>World, Vault and mint</h2><p style={copy}>After creation, you can save the digital item, add source-backed map context, or choose a separate wallet mint flow.</p></section>
          <section style={card}><b style={{ color: '#6f3df4' }}>SEPARATE</b><h2 style={{ fontSize: 21, margin: '6px 0 8px' }}>Real property and finance</h2><p style={copy}>A VoxelPop item, NFT, map marker or payment is not a deed, equity position, rent right or bank account. Regulated or title-based actions require their own verified rails.</p></section>
        </div>

        <section style={{ ...card, marginTop: 12, background: '#251832', color: '#fff' }}><p style={{ margin: 0, color: '#c9ff54', fontSize: 9, fontWeight: 950, letterSpacing: '.13em' }}>WHY THE REPO IS BIGGER THAN THE PRODUCT</p><h2 style={{ fontSize: 25, margin: '7px 0 8px' }}>Research code can exist without becoming the public promise.</h2><p style={{ ...copy, color: '#d1c6d8' }}>The repository contains sandbox, blockchain, map, provider and real-estate research. Those systems should fail closed unless their exact legal/provider requirements are satisfied. They do not change what the $4.99 consumer purchase buys.</p></section>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 24 }}><Link href="/demo" style={{ minHeight: 48, padding: '0 17px', borderRadius: 14, background: '#6f3df4', color: '#fff', textDecoration: 'none', fontSize: 10, fontWeight: 950, display: 'inline-flex', alignItems: 'center' }}>TRY PUBLIC DEMO →</Link><Link href="/property" style={{ minHeight: 48, padding: '0 17px', borderRadius: 14, background: '#fff', border: '1px solid #ddd5e4', color: '#4d4353', textDecoration: 'none', fontSize: 10, fontWeight: 950, display: 'inline-flex', alignItems: 'center' }}>CREATE FROM MY PHOTO</Link></div>
        <footer style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 34, paddingTop: 18, borderTop: '1px solid #e5ded7' }}><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/contact">Contact</Link></footer>
      </div>
    </main>
  );
}
