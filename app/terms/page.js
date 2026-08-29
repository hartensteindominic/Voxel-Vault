import Link from 'next/link';

export const metadata = { title: 'Terms | Voxel Vault' };

const sectionStyle = { marginTop: 22, padding: '18px 20px', border: '1px solid #e7dee8', borderRadius: 20, background: 'rgba(255,255,255,.76)' };
const textStyle = { color: '#746b75', lineHeight: 1.65, fontSize: 12, margin: 0 };

export default function TermsPage() {
  return <main style={{ minHeight: '100vh', background: 'radial-gradient(circle at 10% 8%,#efffb3 0,transparent 25%),radial-gradient(circle at 92% 10%,#eee4ff 0,transparent 28%),#fffaf0', color: '#261a2a', padding: '18px 14px 12px', fontFamily: 'Inter,ui-rounded,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <Link href="/" style={{ color: '#5e37c7', textDecoration: 'none', fontSize: 10, fontWeight: 950 }}>← VOXEL VAULT</Link>
        <div style={{ display: 'flex', gap: 7 }}><Link href="/property" style={pill}>Create</Link><Link href="/privacy" style={pill}>Privacy</Link></div>
      </nav>
      <header style={{ padding: '42px 0 12px', textAlign: 'center' }}>
        <small style={{ color: '#7138f5', fontWeight: 1000, fontSize: 8, letterSpacing: '.15em' }}>TERMS</small>
        <h1 style={{ fontSize: 'clamp(44px,8vw,68px)', margin: '8px 0 6px', letterSpacing: '-.06em', lineHeight: .94 }}>Digital creation.<br/><span style={{ color: '#7138f5' }}>Clear boundaries.</span></h1>
        <p style={{ color: '#8d838d', fontSize: 10 }}>Last updated August 29, 2026.</p>
      </header>

      <section style={sectionStyle}><h2 style={heading}>The current VoxelPop creation</h2><p style={textStyle}>The guided property product lets an eligible signed-in user choose an authorized property photo, pay $4.99 for one digital VoxelPop creation, view the 3D photo preview, approve it, build the movable voxel, and optionally mint the finished digital voxel.</p></section>
      <section style={sectionStyle}><h2 style={heading}>What the $4.99 payment does not buy</h2><p style={textStyle}>The digital creation payment does not buy the physical house or land and does not create deed/title ownership, equity, rent, occupancy, fractional investment rights, guaranteed appreciation, or guaranteed income.</p></section>
      <section style={sectionStyle}><h2 style={heading}>3D accuracy</h2><p style={textStyle}>A single photo can support a recognizable visible-side preview, but it is not a survey or a guaranteed exact reconstruction of hidden sides, dimensions, structural conditions, or legal boundaries. Source-backed map geometry is a separate evidence layer.</p></section>
      <section style={sectionStyle}><h2 style={heading}>Minting and blockchain</h2><p style={textStyle}>Minting is optional and happens only after a finished digital voxel exists. Blockchain transactions may be irreversible and can involve network fees. An NFT, token, map marker, preview, listing, or payment is not a deed or proof of physical-property ownership.</p></section>
      <section style={sectionStyle}><h2 style={heading}>World and sharing</h2><p style={textStyle}>World may display saved digital models at mapped locations. Public sharing is separate from private account storage. Location or map data does not establish real-property rights.</p></section>
      <section style={sectionStyle}><h2 style={heading}>Experimental and provider-backed tools</h2><p style={textStyle}>Sandbox, marketplace, financial, investment, banking, custody, property-verification, and other advanced features may be experimental, unavailable, or provider-dependent. Live regulated or real-property transactions require the applicable provider, eligibility, legal, settlement, custody, and verification rails.</p></section>
      <section style={sectionStyle}><h2 style={heading}>Updates</h2><p style={textStyle}>These terms may change as Voxel Vault changes. The current version will be published here.</p></section>
    </div>
  </main>;
}

const heading = { margin: '0 0 7px', fontSize: 20, letterSpacing: '-.03em' };
const pill = { padding: '8px 10px', border: '1px solid #e0d8e4', borderRadius: 999, background: '#ffffffba', color: '#655b69', textDecoration: 'none', fontSize: 8, fontWeight: 950 };
