'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

let googleMapsPromise = null;

function mapsUrl(latitude, longitude, label = '') {
  const query = Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude))
    ? `${Number(latitude)},${Number(longitude)}`
    : label || '';
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function loadGoogleMaps(apiKey) {
  if (typeof window === 'undefined') return Promise.reject(new Error('Google Maps is browser-only.'));
  if (window.google?.maps?.importLibrary) return Promise.resolve(window.google.maps);
  if (!apiKey) return Promise.reject(new Error('Google 3D Maps is not configured yet.'));
  if (googleMapsPromise) return googleMapsPromise;

  googleMapsPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-voxel-google-maps]');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.google?.maps));
      existing.addEventListener('error', () => reject(new Error('Google Maps could not load.')));
      return;
    }
    const script = document.createElement('script');
    script.dataset.voxelGoogleMaps = '1';
    script.async = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&loading=async`;
    script.onload = () => window.google?.maps?.importLibrary
      ? resolve(window.google.maps)
      : reject(new Error('Google Maps loaded without the 3D library loader.'));
    script.onerror = () => reject(new Error('Google Maps could not load.'));
    document.head.appendChild(script);
  });
  return googleMapsPromise;
}

export default function GoogleRealityMap({ latitude, longitude, label = 'Selected property', active = true }) {
  const mountRef = useRef(null);
  const mapRef = useRef(null);
  const [state, setState] = useState('idle');
  const [message, setMessage] = useState('');
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY || '';
  const pointReady = Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude));
  const externalUrl = useMemo(() => mapsUrl(latitude, longitude, label), [latitude, longitude, label]);

  useEffect(() => {
    if (!active || !pointReady || !mountRef.current) return undefined;
    let cancelled = false;
    let map = null;
    const mount = mountRef.current;

    async function start() {
      if (!apiKey) {
        setState('not-configured');
        setMessage('Google Photorealistic 3D is ready in the app, but this deployment still needs a browser-restricted Google Maps API key.');
        return;
      }
      setState('loading');
      setMessage('Loading Google Photorealistic 3D…');
      try {
        await loadGoogleMaps(apiKey);
        if (cancelled || !mountRef.current) return;
        const { Map3DElement } = await window.google.maps.importLibrary('maps3d');
        if (cancelled) return;
        map = new Map3DElement({
          center: { lat: Number(latitude), lng: Number(longitude), altitude: 35 },
          range: 260,
          tilt: 67,
          heading: 28,
          mode: 'HYBRID',
          gestureHandling: 'COOPERATIVE',
        });
        map.style.width = '100%';
        map.style.height = '100%';
        map.style.display = 'block';
        map.setAttribute('aria-label', `Google photorealistic 3D view for ${label}`);
        map.addEventListener?.('gmp-error', () => {
          setState('error');
          setMessage('Google 3D could not render this location. The source-backed Voxel and Globe views still work.');
        });
        mount.innerHTML = '';
        mount.appendChild(map);
        mapRef.current = map;
        setState('ready');
        setMessage('Live Google Photorealistic 3D · visual reference only');
      } catch (error) {
        if (cancelled) return;
        setState('error');
        setMessage(String(error?.message || error || 'Google 3D could not load.'));
      }
    }

    start();
    return () => {
      cancelled = true;
      if (map?.parentNode) map.parentNode.removeChild(map);
      if (mapRef.current === map) mapRef.current = null;
    };
  }, [active, apiKey, pointReady, latitude, longitude, label]);

  if (!pointReady) {
    return <div className="googleRealityFallback"><b>REALITY VIEW</b><span>Select a mapped building or authoritative property location first.</span><style jsx>{styles}</style></div>;
  }

  return <div className="googleRealityShell">
    <div className="googleRealityMount" ref={mountRef} />
    {state !== 'ready' ? <div className="googleRealityFallback">
      <b>{state === 'loading' ? 'LOADING REALITY VIEW…' : 'GOOGLE 3D REALITY VIEW'}</b>
      <span>{message}</span>
      <a href={externalUrl} target="_blank" rel="noreferrer">OPEN IN GOOGLE MAPS ↗</a>
    </div> : null}
    <div className="googleRealityStatus"><span>{message || 'Google 3D reality layer'}</span><a href={externalUrl} target="_blank" rel="noreferrer">GOOGLE MAPS ↗</a></div>
    <style jsx>{styles}</style>
  </div>;
}

const styles = `
.googleRealityShell{position:relative;min-height:430px;height:min(58vh,650px);border-radius:24px;overflow:hidden;background:radial-gradient(circle at 50% 38%,#18372f 0,#091714 56%,#050908 100%);border:1px solid rgba(255,255,255,.09)}
.googleRealityMount{position:absolute;inset:0}.googleRealityFallback{position:absolute;inset:0;display:grid;place-content:center;justify-items:center;text-align:center;gap:9px;padding:28px;background:radial-gradient(circle at 50% 36%,rgba(80,148,124,.2),rgba(4,8,7,.96) 68%);z-index:2}.googleRealityFallback>b{font-size:10px;letter-spacing:.14em}.googleRealityFallback>span{max-width:520px;color:#8f9c97;font-size:11px;line-height:1.55}.googleRealityFallback>a{margin-top:4px;color:#0a0d0c;background:#fff;text-decoration:none;border-radius:12px;padding:11px 14px;font-size:8px;font-weight:950;letter-spacing:.1em}.googleRealityStatus{position:absolute;left:10px;right:10px;bottom:10px;z-index:3;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 10px;border:1px solid rgba(255,255,255,.09);border-radius:12px;background:rgba(4,8,7,.76);backdrop-filter:blur(12px);font-size:7px;font-weight:850;letter-spacing:.08em;color:#a8b5af}.googleRealityStatus>a{color:#d9f8ea;text-decoration:none;white-space:nowrap}
@media(max-width:680px){.googleRealityShell{min-height:360px;height:50vh;border-radius:20px}.googleRealityFallback{padding:22px}.googleRealityStatus{font-size:6px}}
`;
