'use client';

import { useMemo, useState } from 'react';

function distanceLabel(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 'distance unknown';
  if (number < 1000) return `${Math.round(number)} m away`;
  return `${(number / 1000).toFixed(1)} km away`;
}

export default function OpenRealityPanel({ imagery = null, loading = false, label = '', latitude = null, longitude = null }) {
  const photos = Array.isArray(imagery?.photos) ? imagery.photos : [];
  const [selectedId, setSelectedId] = useState('');
  const selected = useMemo(() => photos.find((item) => item.id === selectedId) || photos[0] || null, [photos, selectedId]);
  const locationReady = Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude));

  return <section className="openReality">
    <div className="head">
      <div><small>FREE OPEN STREET REALITY</small><h3>{label || 'Selected Earth location'}</h3></div>
      <span>{imagery?.provider || 'KartaView'} · {imagery?.license || 'CC BY-SA 4.0'}</span>
    </div>

    {loading ? <div className="empty"><b>CHECKING OPEN STREET IMAGERY…</b><span>No paid Google key is required.</span></div> : selected ? <>
      <div className="hero">
        <img src={selected.imageUrl} alt={`Open street-level reference near ${label || 'selected location'}`} referrerPolicy="no-referrer"/>
        <div className="overlay"><b>OPEN-LICENSED STREET VIEW</b><span>{distanceLabel(selected.distanceMeters)}{selected.shotDate ? ` · ${selected.shotDate}` : ''}{Number.isFinite(Number(selected.heading)) ? ` · heading ${Math.round(Number(selected.heading))}°` : ''}</span></div>
      </div>
      {photos.length > 1 ? <div className="thumbs">{photos.map((photo, index) => <button type="button" key={photo.id} className={selected.id === photo.id ? 'active' : ''} onClick={() => setSelectedId(photo.id)} aria-label={`Open street view ${index + 1}`}><img src={photo.thumbnailUrl || photo.imageUrl} alt="" referrerPolicy="no-referrer"/><span>{index + 1}</span></button>)}</div> : null}
      <div className="meta"><div><b>{photos.length} OPEN VIEW{photos.length === 1 ? '' : 'S'}</b><span>Closest distinct-heading frames are prioritized. Proximity does not prove a frame depicts the exact selected parcel.</span></div><a href={imagery?.termsUrl || 'https://kartaview.org/terms'} target="_blank" rel="noreferrer">LICENSE + ATTRIBUTION ↗</a></div>
    </> : <div className="empty"><b>{locationReady ? 'NO OPEN STREET PHOTO HERE YET' : 'RESOLVING LOCATION…'}</b><span>{imagery?.error || imagery?.note || 'The atlas still works from parcel/map geometry and Meshy can still use user-owned photos. Nothing is substituted or fabricated.'}</span><a href="https://kartaview.org/" target="_blank" rel="noreferrer">OPEN KARTAVIEW ↗</a></div>}

    <style jsx>{`
      .openReality{height:100%;min-height:500px;border:1px solid rgba(255,255,255,.08);border-radius:25px;overflow:hidden;background:#07110f;display:grid;grid-template-rows:auto minmax(0,1fr) auto auto}.head{display:flex;justify-content:space-between;gap:14px;align-items:end;padding:14px 15px;border-bottom:1px solid rgba(255,255,255,.06);background:rgba(255,255,255,.02)}.head small{font-size:7px;color:#80dfbb;font-weight:950;letter-spacing:.14em}.head h3{margin:4px 0 0;font-size:17px;letter-spacing:-.035em}.head>span{font-size:6px;color:#7c8983;letter-spacing:.08em}.hero{position:relative;min-height:0;background:#0b1714;overflow:hidden}.hero img{width:100%;height:100%;min-height:360px;object-fit:cover;display:block}.overlay{position:absolute;left:12px;right:12px;bottom:12px;display:grid;gap:3px;padding:10px 11px;border:1px solid rgba(255,255,255,.08);border-radius:12px;background:rgba(4,10,8,.74);backdrop-filter:blur(12px)}.overlay b{font-size:7px;letter-spacing:.11em}.overlay span{font-size:7px;color:#b6c2bd}.thumbs{display:flex;gap:6px;padding:8px 10px;overflow-x:auto;border-top:1px solid rgba(255,255,255,.05)}.thumbs button{position:relative;width:82px;height:58px;flex:0 0 auto;padding:0;border:1px solid rgba(255,255,255,.08);border-radius:10px;overflow:hidden;background:#0b1714}.thumbs button.active{border-color:rgba(121,239,188,.7);box-shadow:0 0 0 1px rgba(121,239,188,.2)}.thumbs img{width:100%;height:100%;object-fit:cover}.thumbs span{position:absolute;right:4px;bottom:4px;background:rgba(0,0,0,.68);border-radius:999px;padding:3px 5px;font-size:6px;color:#fff}.meta{display:flex;justify-content:space-between;gap:14px;align-items:center;padding:11px 13px;border-top:1px solid rgba(255,255,255,.06)}.meta div{display:grid;gap:3px}.meta b{font-size:7px;letter-spacing:.1em}.meta span{font-size:7px;line-height:1.45;color:#75827c}.meta a,.empty a{color:#bfeeda;text-decoration:none;font-size:7px;font-weight:900;letter-spacing:.08em;white-space:nowrap}.empty{height:100%;min-height:420px;display:grid;place-content:center;gap:7px;text-align:center;padding:24px;background:radial-gradient(circle at 50% 34%,rgba(121,239,188,.08),transparent 36%)}.empty b{font-size:8px;letter-spacing:.11em}.empty span{max-width:520px;font-size:8px;line-height:1.55;color:#77847e}.empty a{justify-self:center;margin-top:4px}
      @media(max-width:680px){.openReality{min-height:390px}.head{display:grid;align-items:start}.hero img{min-height:310px}.meta{display:grid}.meta a{white-space:normal}.empty{min-height:330px}}
    `}</style>
  </section>;
}
