import { ImageResponse } from 'next/og';

export const alt = 'Voxel Vault — turn a house photo into a 3D voxel photo, then a movable voxel';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', display: 'flex', background: '#fffaf0', color: '#17131d', fontFamily: 'Arial, sans-serif', padding: 54, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', width: 430, height: 430, borderRadius: 999, background: '#e7dfff', top: -155, right: -70 }}/>
      <div style={{ position: 'absolute', width: 390, height: 390, borderRadius: 999, background: '#e8ffb9', bottom: -190, left: -70 }}/>
      <div style={{ width: '58%', display: 'flex', flexDirection: 'column', justifyContent: 'center', zIndex: 2 }}>
        <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: 3, color: '#7138f5', marginBottom: 18 }}>VOXELPOP · BY VOXEL VAULT</div>
        <div style={{ fontSize: 64, lineHeight: .96, fontWeight: 900, letterSpacing: -4 }}>Your house. Built from voxels.</div>
        <div style={{ display: 'flex', gap: 10, marginTop: 30, flexWrap: 'wrap' }}>
          {['PHOTO', '3D VOXEL PHOTO', 'MOVABLE VOXEL'].map((label) => <div key={label} style={{ padding: '11px 14px', borderRadius: 999, background: label === '3D VOXEL PHOTO' ? '#7138f5' : '#ffffff', color: label === '3D VOXEL PHOTO' ? '#ffffff' : '#574e59', border: '1px solid #ded6e3', fontSize: 15, fontWeight: 800 }}>{label}</div>)}
        </div>
        <div style={{ marginTop: 20, fontSize: 20, color: '#746c76' }}>$4.99 digital creation · photo stays on device · mint optional</div>
      </div>
      <div style={{ width: '42%', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
        <div style={{ width: 360, height: 360, borderRadius: 42, background: '#f4efff', border: '8px solid #ffffff', boxShadow: '0 24px 50px rgba(62,36,96,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          <div style={{ position: 'absolute', bottom: 42, width: 270, height: 74, borderRadius: 999, background: '#c9ff54' }}/>
          <div style={{ position: 'absolute', width: 210, height: 138, bottom: 90, background: '#f0d3a0', borderRadius: 10, boxShadow: '14px 14px 0 #c5a879' }}/>
          <div style={{ position: 'absolute', width: 258, height: 120, bottom: 199, background: '#6d47bc', clipPath: 'polygon(50% 0,100% 65%,82% 100%,18% 100%,0 65%)', filter: 'drop-shadow(12px 10px 0 #4f328f)' }}/>
          <div style={{ position: 'absolute', width: 42, height: 70, bottom: 90, background: '#925c37', boxShadow: '8px 8px 0 #67412a' }}/>
          <div style={{ position: 'absolute', width: 42, height: 42, bottom: 148, left: 103, background: '#8ed8e8', border: '7px solid #fff5dc', boxShadow: '7px 7px 0 #679eaa' }}/>
          <div style={{ position: 'absolute', width: 42, height: 42, bottom: 148, right: 103, background: '#8ed8e8', border: '7px solid #fff5dc', boxShadow: '7px 7px 0 #679eaa' }}/>
          <div style={{ position: 'absolute', top: 18, left: 18, padding: '10px 14px', borderRadius: 999, background: '#ffffff', color: '#7138f5', fontSize: 16, fontWeight: 900 }}>REAL VOXEL PHOTO</div>
        </div>
      </div>
    </div>,
    size,
  );
}
