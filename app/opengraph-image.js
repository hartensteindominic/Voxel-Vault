import { ImageResponse } from 'next/og';

export const alt = 'Voxel Vault — property photo to 3D preview to voxel';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', display: 'flex', background: 'linear-gradient(135deg,#fffdf8 0%,#f4ecff 52%,#efffc9 100%)', color: '#17131d', fontFamily: 'Arial, sans-serif', padding: '64px 70px', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ width: 650, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', fontSize: 20, fontWeight: 800, letterSpacing: 4, color: '#6f3df4' }}>VOXEL VAULT · VOXELPOP</div>
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 25, fontSize: 70, lineHeight: .96, fontWeight: 900, letterSpacing: -4 }}>
          <span>Your property photo.</span><span style={{ color: '#6f3df4' }}>First 3D. Then voxel.</span>
        </div>
        <div style={{ display: 'flex', marginTop: 28, fontSize: 25, color: '#675e6b' }}>$4.99 digital creation · source photo stays on-device · mint optional</div>
        <div style={{ display: 'flex', gap: 10, marginTop: 32 }}>
          {['PHOTO','3D PREVIEW','APPROVE','VOXEL'].map((label) => <div key={label} style={{ display: 'flex', padding: '12px 16px', borderRadius: 999, background: '#241631', color: '#c9ff54', fontSize: 16, fontWeight: 900 }}>{label}</div>)}
        </div>
      </div>
      <div style={{ width: 360, height: 420, borderRadius: 42, background: 'rgba(255,255,255,.78)', border: '2px solid #e4dbe8', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', boxShadow: '0 24px 55px rgba(83,53,111,.14)' }}>
        <div style={{ position: 'absolute', left: 45, right: 45, bottom: 45, height: 85, borderRadius: 999, background: '#9dd35e', display: 'flex' }}/>
        <div style={{ width: 235, height: 220, position: 'relative', display: 'flex' }}>
          <div style={{ position: 'absolute', left: 45, top: 34, width: 145, height: 64, borderRadius: 18, background: '#6f3df4', transform: 'rotate(-8deg)', boxShadow: '10px 10px 0 #4c258f', display: 'flex' }}/>
          <div style={{ position: 'absolute', left: 48, top: 102, width: 145, height: 105, borderRadius: 8, background: '#f0d6a8', boxShadow: '14px 14px 0 #b58e60', display: 'flex' }}>
            <div style={{ position: 'absolute', left: 19, top: 28, width: 31, height: 31, background: '#73c8e4', border: '6px solid #fff3d8', display: 'flex' }}/>
            <div style={{ position: 'absolute', right: 19, top: 28, width: 31, height: 31, background: '#73c8e4', border: '6px solid #fff3d8', display: 'flex' }}/>
            <div style={{ position: 'absolute', left: 60, bottom: 0, width: 28, height: 54, background: '#91613b', display: 'flex' }}/>
          </div>
        </div>
        <div style={{ position: 'absolute', right: 24, bottom: 22, padding: '12px 15px', borderRadius: 18, background: '#241631', color: '#c9ff54', fontSize: 18, fontWeight: 900, display: 'flex' }}>$4.99</div>
      </div>
    </div>,
    size,
  );
}
