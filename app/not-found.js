import Link from 'next/link';

export default function NotFound() {
  return (
    <main style={{ minHeight: '100vh', padding: '24px 18px calc(110px + env(safe-area-inset-bottom))', display: 'grid', placeItems: 'center', background: 'radial-gradient(circle at 8% 15%,#efffb6 0,transparent 25%),radial-gradient(circle at 92% 10%,#eee5ff 0,transparent 27%),#fffaf0', color: '#171221', fontFamily: 'Inter,ui-rounded,system-ui,-apple-system,BlinkMacSystemFont,sans-serif' }}>
      <section style={{ width: 'min(560px,100%)', boxSizing: 'border-box', padding: 30, border: '1px solid #e4dfea', borderRadius: 30, background: 'rgba(255,255,255,.92)', boxShadow: '0 24px 70px rgba(83,55,123,.12)', textAlign: 'center' }}>
        <div style={{ fontSize: 42, lineHeight: 1 }}>◇</div>
        <p style={{ margin: '12px 0 0', color: '#7138f5', fontSize: 9, letterSpacing: '.15em', fontWeight: 1000 }}>404 · LOST VOXEL</p>
        <h1 style={{ margin: '10px 0 12px', fontSize: 38, lineHeight: 1, letterSpacing: '-.05em' }}>That little world isn’t here.</h1>
        <p style={{ maxWidth: 420, margin: '0 auto', color: '#746d7a', fontSize: 14, lineHeight: 1.6 }}>The link may have moved, or the page may not exist yet. Your Vault and saved work are unaffected.</p>
        <div style={{ marginTop: 22, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
          <Link href="/" style={{ minHeight: 52, display: 'grid', placeItems: 'center', borderRadius: 17, background: 'linear-gradient(#7d42ff,#6630e9)', boxShadow: '0 7px 0 #4d1bc5', color: '#fff', textDecoration: 'none', fontSize: 12, fontWeight: 1000 }}>GO HOME →</Link>
          <Link href="/more" style={{ minHeight: 52, display: 'grid', placeItems: 'center', border: '1px solid #ddd5e5', borderRadius: 17, background: '#fff', color: '#6330dc', textDecoration: 'none', fontSize: 12, fontWeight: 1000 }}>FIND A TOOL</Link>
        </div>
      </section>
    </main>
  );
}
