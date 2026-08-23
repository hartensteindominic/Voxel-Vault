'use client';

import { useEffect, useMemo, useState } from 'react';

const RINGS = [1000, 500, 250, 100, 50, 20, 8];

function distanceMeters(a, b) {
  if (!a || !b) return null;
  const r = 6371000, rad = (n) => n * Math.PI / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(x));
}

function bearing(a, b) {
  if (!a || !b) return 0;
  const r = Math.PI / 180;
  const y = Math.sin((b.lng - a.lng) * r) * Math.cos(b.lat * r);
  const x = Math.cos(a.lat * r) * Math.sin(b.lat * r) - Math.sin(a.lat * r) * Math.cos(b.lat * r) * Math.cos((b.lng - a.lng) * r);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function loadSpots(wallet) {
  try {
    const raw = localStorage.getItem(`voxel-vault-spots:${String(wallet || '').toLowerCase()}`);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export default function TreasureMode({ wallet = '', spot = null, onFound }) {
  const [position, setPosition] = useState(null);
  const [error, setError] = useState('');
  const [watching, setWatching] = useState(false);
  const [spots, setSpots] = useState([]);

  useEffect(() => setSpots(wallet ? loadSpots(wallet) : []), [wallet]);

  const target = spot || spots[0] || null;
  const distance = useMemo(() => distanceMeters(position, target), [position, target]);
  const heading = useMemo(() => bearing(position, target), [position, target]);
  const ring = RINGS.find((r) => distance !== null && distance <= r) || 1000;
  const found = distance !== null && distance <= 8;

  useEffect(() => {
    if (!watching || !navigator.geolocation) return undefined;
    const id = navigator.geolocation.watchPosition(
      (p) => { setPosition({ lat: p.coords.latitude, lng: p.coords.longitude }); setError(''); },
      (e) => setError(e?.code === 1 ? 'Location permission is needed for Treasure Mode.' : 'Location signal unavailable.'),
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [watching]);

  useEffect(() => { if (found && target) onFound?.(target); }, [found, target, onFound]);

  if (!wallet) return <section className="treasureMode"><div className="treasureCard"><span className="treasureEyebrow">TREASURE MODE</span><h2>Your wallet is the key.</h2><p>Connect your Voxel Vault wallet to hunt for your saved spots.</p></div></section>;
  if (!target) return <section className="treasureMode"><div className="treasureCard"><span className="treasureEyebrow">TREASURE MODE</span><h2>Nothing hidden yet.</h2><p>Save a Vault Spot first. Then come back here when you're ready to hunt.</p></div></section>;

  return <section className={`treasureMode ${found ? 'found' : ''}`}>
    <div className="treasureCard">
      <div className="treasureEyebrow">✦ TREASURE MODE · {wallet.slice(0, 6)}…{wallet.slice(-4)}</div>
      {found ? <><div className="foundBurst">✦</div><h2>VAULT FOUND</h2><p>{target.name || 'Your hidden collectible'} is here.</p><button type="button" onClick={() => onFound?.(target)}>Reveal collectible</button></> : <>
        <div className="compass" style={{ transform: `rotate(${heading}deg)` }}><span>↑</span></div>
        <div className="distance">{distance === null ? '—' : distance < 1000 ? `${Math.round(distance)} m` : `${(distance / 1000).toFixed(1)} km`}</div>
        <h2>{distance === null ? 'Find your signal.' : distance <= 50 ? 'Almost there.' : 'Something is waiting.'}</h2>
        <p>{distance === null ? 'Turn on location to start the hunt.' : `Head ${Math.round(heading)}° toward your Vault Spot.`}</p>
        <div className="treasureProgress"><span style={{ width: `${Math.max(6, Math.min(100, 100 - (distance === null ? 100 : (distance / ring) * 100)))}%` }} /></div>
        <small>{distance === null ? 'Location required' : `Next discovery ring · ${ring >= 1000 ? `${ring / 1000} km` : `${ring} m`}`}</small>
        {!watching && <button type="button" onClick={() => setWatching(true)}>Start hunting</button>}
        {error && <p role="alert">{error}</p>}
      </>}
    </div>
  </section>;
}
