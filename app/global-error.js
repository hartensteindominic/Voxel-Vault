'use client';

export default function GlobalError({ reset }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: '100vh', background: '#fffaf0', color: '#171221', fontFamily: 'Inter,ui-rounded,system-ui,sans-serif' }}>
        <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: 'radial-gradient(circle at 10% 15%,#efffb6 0,transparent 26%),radial-gradient(circle at 90% 10%,#eee5ff 0,transparent 28%),#fffaf0' }}>
          <section style={{ width: 'min(560px,100%)', boxSizing: 'border-box', padding: 32, borderRadius: 30, border: '1px solid #e4dfea', background: 'rgba(255,255,255,.94)', boxShadow: '0 26px 80px rgba(83,55,123,.15)', textAlign: 'center' }}>
            <div style={{ color: '#7138f5', fontSize: 10, letterSpacing: '.16em', fontWeight: 1000 }}>✦ VOXEL VAULT · RECOVERY ✦</div>
            <h1 style={{ fontSize: 36, lineHeight: 1.02, letterSpacing: '-.05em', margin: '15px 0' }}>Voxel Vault can recover this.</h1>
            <p style={{ color: '#746d7a', lineHeight: 1.7, margin: '0 auto 22px', maxWidth: 450 }}>The recovery screen runs separately from the 3D experience, so a rendering problem does not have to leave the whole app blank.</p>
            <button type="button" onClick={() => reset()} style={{ width: 'min(320px,100%)', minHeight: 54, border: 0, borderRadius: 18, padding: '13px 20px', background: 'linear-gradient(#7d42ff,#6630e9)', boxShadow: '0 7px 0 #4d1bc5,0 14px 28px rgba(116,72,244,.22)', color: '#fff', fontWeight: 1000, cursor: 'pointer' }}>TRY AGAIN →</button>
          </section>
        </main>
      </body>
    </html>
  );
}
