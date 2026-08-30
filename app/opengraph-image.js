import { ImageResponse } from 'next/og';

export const alt = 'Galactic Trust — your money, your galaxy';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', display: 'flex', background: '#07103d', color: '#ffffff', fontFamily: 'Arial, sans-serif', padding: 58, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', width: 560, height: 560, borderRadius: 999, background: '#273cf0', opacity: .38, top: -260, right: -130 }} />
      <div style={{ position: 'absolute', width: 440, height: 440, borderRadius: 999, background: '#7a3cff', opacity: .25, bottom: -260, left: 250 }} />
      <div style={{ position: 'absolute', top: 65, right: 130, fontSize: 30, color: '#b8c6ff' }}>✦</div>
      <div style={{ position: 'absolute', top: 155, right: 78, fontSize: 18, color: '#ffffff' }}>✦</div>
      <div style={{ width: '59%', display: 'flex', flexDirection: 'column', justifyContent: 'center', zIndex: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 22 }}>
          <div style={{ width: 52, height: 52, borderRadius: 999, background: 'linear-gradient(135deg,#7d5cff,#2de1da)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 27, fontWeight: 900 }}>✦</div>
          <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: 2.5 }}>GALACTIC TRUST</div>
        </div>
        <div style={{ fontSize: 70, lineHeight: .98, fontWeight: 900, letterSpacing: -4 }}>Your money.<br />Your galaxy.</div>
        <div style={{ marginTop: 24, fontSize: 22, lineHeight: 1.35, color: '#cfd7ff' }}>A clear, cosmic digital banking demo with fast actions, cards, spending insights, and Orbit assistance.</div>
        <div style={{ display: 'flex', gap: 10, marginTop: 28 }}>
          {['DEPOSIT', 'SEND', 'SWAP'].map((label, index) => <div key={label} style={{ padding: '11px 15px', borderRadius: 999, background: index === 0 ? '#ffffff' : 'rgba(255,255,255,.10)', color: index === 0 ? '#25309d' : '#ffffff', border: '1px solid rgba(255,255,255,.22)', fontSize: 15, fontWeight: 900 }}>{label}</div>)}
        </div>
        <div style={{ marginTop: 20, fontSize: 15, color: '#aeb8e9' }}>SIMULATED BANKING · NO REAL DEPOSITS · NO REAL MONEY MOVES</div>
      </div>
      <div style={{ width: '41%', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
        <div style={{ width: 390, height: 250, borderRadius: 34, background: 'linear-gradient(145deg,#263bff,#7440e9)', border: '1px solid rgba(255,255,255,.28)', boxShadow: '0 28px 70px rgba(0,0,0,.28)', padding: 28, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', width: 190, height: 190, borderRadius: 999, background: 'rgba(255,255,255,.12)', right: -45, top: -62 }} />
          <div style={{ fontSize: 15, color: '#dfe5ff' }}>TOTAL BALANCE</div>
          <div style={{ marginTop: 12, fontSize: 48, fontWeight: 900 }}>$24,350.72</div>
          <div style={{ marginTop: 9, display: 'flex', gap: 9, alignItems: 'center', fontSize: 16 }}><span style={{ color: '#bfffd2', fontWeight: 900 }}>↑ 12.4%</span><span style={{ color: '#d3d9ff' }}>demo trend</span></div>
          <div style={{ marginTop: 'auto', display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            {[26,36,31,48,42,62,55,74,69,91].map((height, index) => <div key={index} style={{ width: 22, height, borderRadius: 8, background: 'rgba(255,255,255,.78)' }} />)}
          </div>
        </div>
      </div>
    </div>,
    size,
  );
}
