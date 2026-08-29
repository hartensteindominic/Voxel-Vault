import Link from 'next/link';

export const metadata = { title: 'Terms', description: 'Terms for Voxel Vault and the $4.99 VoxelPop digital property-photo creation flow.' };

const sectionStyle = { marginTop: 28 };
const textStyle = { color: '#6f6873', lineHeight: 1.75, fontSize: 13, margin: 0 };

export default function TermsPage() {
  return (
    <main style={{ minHeight: '100vh', background: 'linear-gradient(180deg,#fffdf8,#fffaf0)', color: '#17131d', padding: '24px 18px 110px', fontFamily: 'Inter,ui-rounded,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <Link href="/" style={{ color: '#6f3df4', textDecoration: 'none', fontSize: 11, fontWeight: 900 }}>← VOXEL VAULT</Link>
        <h1 style={{ fontSize: 'clamp(42px,8vw,64px)', margin: '36px 0 5px', letterSpacing: '-.055em' }}>Terms</h1>
        <p style={{ color: '#817987', fontSize: 11 }}>Last updated August 29, 2026.</p>

        <section style={sectionStyle}><h2>The $4.99 VoxelPop purchase</h2><p style={textStyle}>The $4.99 checkout buys one digital VoxelPop creation. The intended sequence is authorized property photo, paid session verification, recognizable 3D preview, user approval, movable voxel, and then optional downstream actions such as saving, mapping or minting.</p></section>
        <section style={sectionStyle}><h2>No physical-property rights</h2><p style={textStyle}>A VoxelPop creation, 3D preview, voxel, NFT, digital collectible, map marker, Property Passport, payment or wallet transaction does not transfer a house or land and does not create deed or title ownership, equity, rent, occupancy, tenancy, mortgage, lien, appraisal, investment, dividend or guaranteed appreciation rights in physical property.</p></section>
        <section style={sectionStyle}><h2>Photo authorization</h2><p style={textStyle}>You may submit only photos you took or otherwise have permission to use for this purpose. You are responsible for avoiding images that unlawfully expose private people, private documents, access credentials or other sensitive information.</p></section>
        <section style={sectionStyle}><h2>3D output limitations</h2><p style={textStyle}>A model inferred from a single photo is a digital visual creation, not a survey, architectural plan, inspection, appraisal, complete digital twin or guaranteed exact reconstruction of unseen geometry. Voxel Vault may reject a photo when there is not enough usable building evidence instead of inventing unsupported property details.</p></section>
        <section style={sectionStyle}><h2>Payments and resuming a creation</h2><p style={textStyle}>A paid creation is unlocked only after the payment session is verified. Device or browser limitations may prevent a source photo from being retained through checkout; when the paid session can still be verified, you may be asked to re-select the same authorized photo rather than pay a second creation charge.</p></section>
        <section style={sectionStyle}><h2>Optional minting and blockchain</h2><p style={textStyle}>Minting is separate from the normal creation purchase and may require a compatible wallet. Blockchain transactions can be public and irreversible, and network availability or fees can change. A token represents the digital item described by its metadata; it does not replace county or other official land-title systems.</p></section>
        <section style={sectionStyle}><h2>Demo, partner and title states</h2><p style={textStyle}>Demo or sandbox balances are not money and do not create real property or investment rights. Provider-backed financial or investment actions are live only when the exact approved provider, eligibility, disclosure, settlement and verification path is active. Physical-property ownership changes only through ordinary legal closing and recorded title.</p></section>
        <section style={sectionStyle}><h2>No banking or investment service</h2><p style={textStyle}>Voxel Vault is not itself a bank, broker, exchange, custodian, escrow service, title company or deed registry. Research code or interface experiments in the repository do not make a regulated product live.</p></section>
        <section style={sectionStyle}><h2>Availability</h2><p style={textStyle}>The service is evolving. Browser capabilities, third-party services, maps, wallets, blockchain networks and local graphics performance can affect availability. Features may change, fail closed or be removed when their technical, provider or legal requirements are not satisfied.</p></section>
        <section style={sectionStyle}><h2>Updates</h2><p style={textStyle}>These terms may change as Voxel Vault develops. The current version will be published here.</p></section>

        <footer style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 36, paddingTop: 18, borderTop: '1px solid #e5ded7' }}><Link href="/privacy">Privacy</Link><Link href="/about">About</Link><Link href="/contact">Contact</Link><Link href="/demo">Demo</Link></footer>
      </div>
    </main>
  );
}
