'use client';

export default function GlobalError({ reset }) {
  return (
    <main style={{ minHeight: '100vh', background: 'radial-gradient(circle at 10% 15%,#efffb6 0,transparent 26%),radial-gradient(circle at 90% 10%,#eee5ff 0,transparent 28%),#fffaf0', color: '#171221', display: 'grid', placeItems: 'center', padding: 24, fontFamily: 'Inter,ui-rounded,system-ui,sans-serif' }}>
      <section style={{ width: 'min(540px,100%)', boxSizing: 'border-box', padding: 30, border: '1px solid #e4dfea', borderRadius: 30, background: 'rgba(255,255,255,.92)', boxShadow: '0 24px 70px rgba(83,55,123,.12)', textAlign: 'center' }}>
        <div style={{ color: '#7138f5', fontSize: 10, letterSpacing: '.16em', fontWeight: 1000 }}>✦ VOXEL VAULT ✦</div>
        <h1 style={{ fontSize: 38, lineHeight: 1, letterSpacing: '-.05em', margin: '15px 0' }}>That page hit a snag.</h1>
        <p style={{ color: '#746d7a', lineHeight: 1.65, margin: '0 auto', maxWidth: 430 }}>Your Vault is still here. A 3D or data component had trouble loading, so try the page again.</p>
        <button onClick={() => reset()} style={{ width: 'min(320px,100%)', minHeight: 54, marginTop: 22, border: 0, borderRadius: 18, padding: '13px 20px', background: 'linear-gradient(#7d42ff,#6630e9)', boxShadow: '0 7px 0 #4d1bc5,0 14px 28px rgba(116,72,244,.22)', color: '#fff', fontWeight: 1000, cursor: 'pointer' }}>TRY AGAIN →</button>
      </section>
    </main>
  );
}
