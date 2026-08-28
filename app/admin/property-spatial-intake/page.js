'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { getSupabaseBrowserAsync } from '../../../lib/supabase-browser';
import styles from './page.module.css';

const AUTH_TIMEOUT_MS = 10000;
const API_TIMEOUT_MS = 15000;

function withTimeout(promise, timeoutMs, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function fetchWithTimeout(input, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, cache: 'no-store', signal: controller.signal });
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('Erie County GIS intake timed out. No property was verified or changed.');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function money(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(number);
}

function number(value, suffix = '') {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '—';
  return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(parsed)}${suffix}`;
}

function title(value) {
  const text = String(value || 'unverified').replaceAll('_', ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function collectRings(geometry) {
  if (!geometry || !Array.isArray(geometry.coordinates)) return [];
  if (geometry.type === 'Polygon') return geometry.coordinates.length ? [geometry.coordinates[0]] : [];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.map((polygon) => polygon?.[0]).filter(Array.isArray);
  return [];
}

function ParcelPreview({ parcelGeometry, buildingGeometry }) {
  const parcelRings = collectRings(parcelGeometry);
  const buildingRings = collectRings(buildingGeometry);
  const points = [...parcelRings, ...buildingRings].flat();
  if (!points.length) return <div className={styles.emptyPreview}>No source geometry returned.</div>;

  const lons = points.map((pair) => Number(pair?.[0])).filter(Number.isFinite);
  const lats = points.map((pair) => Number(pair?.[1])).filter(Number.isFinite);
  if (!lons.length || !lats.length) return <div className={styles.emptyPreview}>Geometry could not be previewed.</div>;

  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const width = Math.max(maxLon - minLon, 0.000001);
  const height = Math.max(maxLat - minLat, 0.000001);
  const pad = 28;
  const canvasW = 520;
  const canvasH = 320;
  const scale = Math.min((canvasW - pad * 2) / width, (canvasH - pad * 2) / height);
  const offsetX = (canvasW - width * scale) / 2;
  const offsetY = (canvasH - height * scale) / 2;

  const pathFor = (ring) => ring.map((pair, index) => {
    const x = offsetX + (Number(pair[0]) - minLon) * scale;
    const y = canvasH - (offsetY + (Number(pair[1]) - minLat) * scale);
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(' ') + ' Z';

  return (
    <svg className={styles.mapSvg} viewBox={`0 0 ${canvasW} ${canvasH}`} role="img" aria-label="Source-backed parcel and building footprint preview">
      <rect className={styles.mapBackdrop} x="0" y="0" width={canvasW} height={canvasH} rx="28" />
      {parcelRings.map((ring, index) => <path className={styles.parcelShape} d={pathFor(ring)} key={`parcel-${index}`} />)}
      {buildingRings.map((ring, index) => <path className={styles.buildingShape} d={pathFor(ring)} key={`building-${index}`} />)}
    </svg>
  );
}

export default function PropertySpatialIntakePage() {
  const [token, setToken] = useState('');
  const [authState, setAuthState] = useState('loading');
  const [mode, setMode] = useState('sbl');
  const [parcelKey, setParcelKey] = useState('');
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    let subscription;
    (async () => {
      try {
        const client = await withTimeout(getSupabaseBrowserAsync(), AUTH_TIMEOUT_MS, 'Voxel Vault account setup timed out.');
        const { data: sessionData } = await withTimeout(client.auth.getSession(), AUTH_TIMEOUT_MS, 'Your owner session check timed out.');
        const accessToken = sessionData?.session?.access_token || '';
        if (cancelled) return;
        if (!accessToken) {
          setAuthState('signed-out');
          return;
        }
        setToken(accessToken);
        setAuthState('authenticated');
        const result = client.auth.onAuthStateChange((_event, session) => {
          const next = session?.access_token || '';
          setToken(next);
          if (!next) {
            setAuthState('signed-out');
            setData(null);
          }
        });
        subscription = result?.data?.subscription;
      } catch (err) {
        if (!cancelled) {
          setAuthState('auth-error');
          setError(err instanceof Error ? err.message : 'Owner authentication could not be loaded.');
        }
      }
    })();
    return () => {
      cancelled = true;
      subscription?.unsubscribe?.();
    };
  }, []);

  async function loadParcel(event) {
    event.preventDefault();
    if (!token) {
      setError('Owner sign-in is required before loading a parcel.');
      return;
    }
    const key = parcelKey.trim();
    if (!key) {
      setError(`Enter an Erie County ${mode.toUpperCase()}.`);
      return;
    }

    setBusy(true);
    setError('');
    setData(null);
    try {
      const params = new URLSearchParams({ [mode]: key });
      const response = await fetchWithTimeout(`/api/admin/property-platform/erie-county?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.ok) throw new Error(body.error || 'The parcel intake could not be loaded.');
      setData(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The parcel intake could not be loaded.');
    } finally {
      setBusy(false);
    }
  }

  const twin = data?.twin;
  const record = data?.countyRecord;
  const verification = twin?.verification;
  const referencePoint = useMemo(() => {
    const latitude = Number(twin?.location?.latitude);
    const longitude = Number(twin?.location?.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return '—';
    return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
  }, [twin?.location?.latitude, twin?.location?.longitude]);

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <nav className={styles.nav}>
          <Link className={styles.brand} href="/real-estate"><span>V</span>Voxel Vault</Link>
          <div className={styles.navLinks}>
            <Link href="/real-estate">Real estate</Link>
            <Link href="/admin/digital-reits/live">Live securities</Link>
          </div>
        </nav>

        <section className={styles.hero}>
          <div>
            <p className={styles.eyebrow}>OWNER SPATIAL INTAKE · ERIE COUNTY, NY</p>
            <h1>Turn one real parcel into a <em>source-backed Spatial Vault.</em></h1>
            <p className={styles.lead}>Enter an exact county PIN or SBL. Voxel Vault pulls official parcel geometry and building footprints, records provenance, and keeps legal ownership separate from the map.</p>
          </div>
          <div className={styles.heroBadge}>
            <strong>Reference-first</strong>
            <span>GIS ≠ deed</span>
            <span>GIS ≠ legal survey</span>
            <span>Assessment ≠ market value</span>
          </div>
        </section>

        <section className={styles.panel}>
          <form className={styles.form} onSubmit={loadParcel}>
            <div className={styles.segmented} aria-label="Parcel identifier type">
              <button type="button" className={mode === 'sbl' ? styles.activeSegment : ''} onClick={() => { setMode('sbl'); setData(null); }}>SBL</button>
              <button type="button" className={mode === 'pin' ? styles.activeSegment : ''} onClick={() => { setMode('pin'); setData(null); }}>PIN</button>
            </div>
            <label className={styles.field}>
              <span>Erie County {mode.toUpperCase()}</span>
              <input value={parcelKey} onChange={(event) => setParcelKey(event.target.value)} placeholder={mode === 'sbl' ? 'Example format: 101.01-1-1' : 'Enter exact county PIN'} autoCapitalize="characters" autoCorrect="off" spellCheck="false" />
            </label>
            <button className={styles.primaryButton} disabled={busy || authState !== 'authenticated'} type="submit">
              {busy ? 'Loading official record…' : 'Load real parcel'}
            </button>
          </form>

          <div className={styles.authLine}>
            <span className={authState === 'authenticated' ? styles.goodDot : styles.neutralDot} />
            {authState === 'loading' && 'Checking owner session…'}
            {authState === 'authenticated' && 'Owner session ready · intake stays private/no-store'}
            {authState === 'signed-out' && 'Sign in with the authorized Voxel Vault owner account first.'}
            {authState === 'auth-error' && 'Owner authentication needs attention.'}
          </div>
          {error && <div className={styles.error}>{error}</div>}
        </section>

        {data && (
          <>
            <section className={styles.truthGrid}>
              <article><small>GEOGRAPHY</small><strong>{title(verification?.geography)}</strong><span>County parcel ID + polygon + reference coordinates + provenance</span></article>
              <article><small>PHYSICAL 3D</small><strong>{title(verification?.physical)}</strong><span>Footprint loaded; trusted building height still required</span></article>
              <article><small>RIGHTS</small><strong>Reference only</strong><span>No deed, title or security interest created by this intake</span></article>
              <article><small>FULLY VERIFIED</small><strong>{verification?.fullyVerified ? 'Yes' : 'No'}</strong><span>Spatial truth and legal/economic ownership must both pass</span></article>
            </section>

            <section className={styles.twoColumn}>
              <article className={styles.mapCard}>
                <div className={styles.cardHeader}>
                  <div><p className={styles.eyebrow}>COUNTY GEOMETRY</p><h2>{record?.parcelAddress || twin?.label || 'Erie County parcel'}</h2></div>
                  <span className={styles.referencePill}>REFERENCE ONLY</span>
                </div>
                <ParcelPreview parcelGeometry={twin?.location?.parcelGeometry} buildingGeometry={twin?.structure?.buildingGeometry} />
                <div className={styles.legend}><span><i className={styles.parcelSwatch} />Parcel polygon</span><span><i className={styles.buildingSwatch} />Building footprint</span></div>
                <p className={styles.mapNote}>Visual preview uses the county-provided GIS geometry. It is not a legal survey or conveyance boundary.</p>
              </article>

              <article className={styles.detailsCard}>
                <p className={styles.eyebrow}>REAL RECORD SNAPSHOT</p>
                <div className={styles.detailRows}>
                  <div><span>SBL</span><strong>{record?.sbl || '—'}</strong></div>
                  <div><span>PIN</span><strong>{record?.pin || '—'}</strong></div>
                  <div><span>Municipality</span><strong>{record?.municipality || '—'}</strong></div>
                  <div><span>Reference point</span><strong>{referencePoint}</strong></div>
                  <div><span>Calculated acres</span><strong>{number(record?.calculatedAcres)}</strong></div>
                  <div><span>Frontage / depth</span><strong>{number(record?.frontageFt, ' ft')} / {number(record?.depthFt, ' ft')}</strong></div>
                  <div><span>Year built</span><strong>{record?.yearBuilt || '—'}</strong></div>
                  <div><span>Living area</span><strong>{number(record?.livingAreaSqFt, ' sq ft')}</strong></div>
                  <div><span>Building footprints</span><strong>{record?.buildingFootprintCount ?? '—'}</strong></div>
                </div>
              </article>
            </section>

            <section className={styles.financeCard}>
              <div><p className={styles.eyebrow}>FINANCIAL REFERENCE</p><h2>County assessment stays separate from investment value.</h2></div>
              <div className={styles.financeNumbers}>
                <div><small>Total assessed value</small><strong>{money(record?.totalAssessedValueUsd)}</strong></div>
                <div><small>Land assessed value</small><strong>{money(record?.landAssessedValueUsd)}</strong></div>
              </div>
              <p>These are county assessment fields, not a Voxel Vault market valuation, appraisal, sale price, guaranteed value, or promise that the property will appreciate.</p>
            </section>

            <section className={styles.sourceCard}>
              <div><p className={styles.eyebrow}>PROVENANCE + NEXT GATES</p><h2>What is real now—and what still has to be proven.</h2></div>
              <div className={styles.sourceGrid}>
                <div><strong>Spatial source loaded</strong><span>Erie County parcel polygon, PIN/SBL and tax-record attributes are source-backed.</span></div>
                <div><strong>Physical height missing</strong><span>We do not invent a building height. A trusted LiDAR/DSM or other authoritative height source comes next.</span></div>
                <div><strong>Title still separate</strong><span>Book/page references are only leads. Title ownership and liens require title/closing evidence.</span></div>
                <div><strong>Financial rights still separate</strong><span>No fractional security, LLC membership, deed interest or blockchain ownership is created here.</span></div>
              </div>
              <div className={styles.sourceLinks}>
                <a href={data?.provenance?.parcelLayer} target="_blank" rel="noreferrer">Official parcel layer ↗</a>
                <a href={data?.provenance?.buildingLayer} target="_blank" rel="noreferrer">Official building layer ↗</a>
                <a href={data?.provenance?.mappingDisclaimer} target="_blank" rel="noreferrer">County mapping disclaimer ↗</a>
              </div>
            </section>
          </>
        )}

        <footer className={styles.footer}>Voxel Vault · owner-only spatial intake · no deed/title/blockchain rights are changed by loading a county GIS record.</footer>
      </div>
    </main>
  );
}
