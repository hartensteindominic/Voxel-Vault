import { ImageResponse } from 'next/og';

export const alt = 'Voxel Vault — turn a house photo into a 3D voxel';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', display: 'flex', background: '#fffaf0', color: '#17131d', fontFamily: 'Arial, sans-serif', padding: 54, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', width: 430, height: 430, borderRadius: 999, background: '#e7dfff', top: -155, right: -70 }}/>
      <div style={{ position: 'absolute', width: 390, height: 390, borderRadius: 999, background: '#e8ffb9', bottom: -190, left: -70 }}/>
      <div style={{ width: '58%', display: 'flex', flexDirection: 'column', justifyContent: 'center', zIndex: 2 }}>
        <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: 3, color: '#7138f5', marginBottom: 18 }}>VOXEL VAULT · VOXELPOP</div>
        <div style={{ fontSize: 68, lineHeight: .96, fontWeight: 900, letterSpacing: -4 }}>Turn a house photo into a movable 3D voxel.</div>
        <div style={{ display: 'flex', gap: 12, marginTop: 30 }}>
          {['PHOTO', '3D VOXEL PHOTO', 'MOVABLE VOXEL'].map((label) => <div key={label} style={{ padding: '12px 16px', borderRadius: 999, background: label === 'MOVABLE VOXEL' ? '#7138f5' : '#ffffff', color: label === 'MOVABLE VOXEL' ? '#ffffff' : '#574e59', border: '1px solid #ded6e3', fontSize: 16, fontWeight: 800 }}>{label}</div>)}
        </div>
        <div style={{ marginTop: 20, fontSize: 20, color: '#746c76' }}>$4.99 digital creation · source photo stays on device · mint optional</div>
      </div>
      <div style={{ width: '42%', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
        <div style={{ width: 360, height: 360, borderRadius: 42, background: '#21172c', border: '8px solid #ffffff', boxShadow: '0 24px 50px rgba(62,36,96,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          <div style={{ position: 'absolute', bottom: 42, width: 270, height: 74, borderRadius: 999, background: '#91cf54' }}/>
          <div style={{ position: 'absolute', width: 210, height: 138, bottom: 90, background: '#f0d3a0', borderRadius: 10 }}/>
          <div style={{ position: 'absolute', width: 258, height: 120, bottom: 199, background: '#6d47bc', clipPath: 'polygon(50% 0,100% 65%,82% 100%,18% 100%,0 65%)' }}/>
          <div style={{ position: 'absolute', width: 42, height: 70, bottom: 90, background: '#925c37' }}/>
          <div style={{ position: 'absolute', width: 42, height: 42, bottom: 148, left: 103, background: '#8ed8e8', border: '7px solid #fff5dc' }}/>
          <div style={{ position: 'absolute', width: 42, height: 42, bottom: 148, right: 103, background: '#8ed8e8', border: '7px solid #fff5dc' }}/>
          <div style={{ position: 'absolute', top: 18, left: 18, padding: '10px 14px', borderRadius: 999, background: '#c9ff54', color: '#2f4509', fontSize: 16, fontWeight: 900 }}>SEE IT FIRST</div>
        </div>
      </div>
    </div>,
    size,
  );
}
