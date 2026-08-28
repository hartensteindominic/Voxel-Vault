import Link from 'next/link';
import {
  FIRST_REAL_ERIE_PARCEL,
  fetchFirstRealErieParcel,
} from '../../../../lib/real-estate/erie-county-evidence.js';
import styles from './page.module.css';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function collectRings(geometry) {
  if (!geometry || !Array.isArray(geometry.coordinates)) return [];
  if (geometry.type === 'Polygon') return geometry.coordinates.length ? [geometry.coordinates[0]] : [];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.map((polygon) => polygon?.[0]).filter(Array.isArray);
  return [];
}

function EvidenceMap({ parcelGeometry, buildingGeometry }) {
  const parcelRings = collectRings(parcelGeometry);
  const buildingRings = collectRings(buildingGeometry);
  const points = [...parcelRings, ...buildingRings].flat();
  if (!points.length) return <div className={styles.error}>No source geometry is available. The page will not substitute a generic model.</div>;

  const lons = points.map((pair) => Number(pair?.[0])).filter(Number.isFinite);
  const lats = points.map((pair) => Number(pair?.[1])).filter(Number.isFinite);
  if (!lons.length || !lats.length) return <div className={styles.error}>Source geometry could not be rendered.</div>;

  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const width = Math.max(maxLon - minLon, 0.000001);
  const height = Math.max(maxLat - minLat, 0.000001);
  const canvasW = 720;
  const canvasH = 430;
  const pad = 38;
  const scale = Math.min((canvasW - pad * 2) / width, (canvasH - pad * 2) / height);
  const offsetX = (canvasW - width * scale) / 2;
  const offsetY = (canvasH - height * scale) / 2;

  const pathFor = (ring) => ring.map((pair, index) => {
    const x = offsetX + (Number(pair[0]) - minLon) * scale;
    const y = canvasH - (offsetY + (Number(pair[1]) - minLat) * scale);
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(' ') + ' Z';

  return (
    <>
      <svg className={styles.mapSvg} viewBox={`0 0 ${canvasW} ${canvasH}`} role="img" aria-label="Official Erie County parcel polygon and building footprint evidence">
        <rect width={canvasW} height={canvasH} rx="24" fill="#f5f3ee" />
        {parcelRings.map((ring, index) => <path key={`parcel-${index}`} d={pathFor(ring)} fill="rgba(17,17,17,.08)" stroke="#111" strokeWidth="4" />)}
        {buildingRings.map((ring, index) => <path key={`building-${index}`} d={pathFor(ring)} fill="rgba(141,139,131,.66)" stroke="#5f5d57" strokeWidth="3" />)}
      </svg>
      <div className={styles.legend}>
        <span><i className={styles.parcelSwatch} />Official parcel polygon</span>
        <span><i className={styles.buildingSwatch} />Official building footprint</span>
      </div>
    </>
  );
}

function money(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(number);
}

export default async function FirstRealErieParcelPage() {
  let evidence;
  let error = '';
  try {
    evidence = await fetchFirstRealErieParcel();
  } catch (err) {
    error = err instanceof Error ? err.message : 'Erie County evidence could not be loaded.';
  }

  const twin = evidence?.twin;
  const record = evidence?.countyRecord;
  const labels = evidence?.truthLabels;

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <nav className={styles.nav}>
          <Link className={styles.brand} href="/real-estate">Voxel Vault</Link>
          <Link className={styles.navLink} href="/real-estate/property/0001">Reference demos</Link>
        </nav>

        <section className={styles.hero}>
          <article className={styles.heroCard}>
            <p className={styles.eyebrow}>FIRST REAL PARCEL · ERIE COUNTY, NEW YORK</p>
            <h1>618 Main Street.<br /><em>Evidence before ownership.</em></h1>
            <p className={styles.lead}>This page does not use the generic house model. It loads the exact County SBL from Erie County GIS at request time and renders only the parcel and building geometry the county actually returns.</p>
          </article>
          <aside className={styles.statusCard}>
            <div>
              <p className={styles.eyebrow}>FORCING FUNCTION</p>
              <strong>{error ? 'EVIDENCE UNAVAILABLE' : 'LIVE COUNTY EVIDENCE'}</strong>
            </div>
            <div className={styles.statusList}>
              <span>COUNTY SBL · {FIRST_REAL_ERIE_PARCEL.countySbl}</span>
              <span>PIN · {FIRST_REAL_ERIE_PARCEL.pin}</span>
              <span>RIGHTS · REFERENCE ONLY</span>
            </div>
          </aside>
        </section>

        {error ? (
          <div className={styles.error}>
            <strong>Fail closed.</strong> {error} No geometry, height or ownership claim is substituted while the authoritative source is unavailable.
          </div>
        ) : (
          <>
            <section className={styles.truthGrid} aria-label="Spatial truth status">
              <article><small>GEOGRAPHY</small><strong>{labels?.geography}</strong><span>Exact parcel ID, coordinates, polygon and source lineage must all pass.</span></article>
              <article><small>PHYSICAL</small><strong>{labels?.physical}</strong><span>County footprint is present; measured building height is still absent.</span></article>
              <article><small>SPATIAL TWIN</small><strong>{labels?.spatialTwin}</strong><span>Full spatial verification stays false until measured height is attached.</span></article>
              <article><small>OWNERSHIP</small><strong>{labels?.ownership}</strong><span>County GIS does not establish deed, title, LLC membership or investment rights.</span></article>
            </section>

            <section className={styles.twoCol}>
              <article className={styles.panel}>
                <div className={styles.panelHeader}>
                  <div><p className={styles.eyebrow}>SOURCE GEOMETRY</p><h2>{record?.parcelAddress || twin?.label}</h2></div>
                  <span className={styles.pill}>REFERENCE ONLY</span>
                </div>
                <EvidenceMap parcelGeometry={twin?.location?.parcelGeometry} buildingGeometry={twin?.structure?.buildingGeometry} />
                <p className={styles.note}>The drawing is generated from the returned county GeoJSON. It is a GIS reference, not a legal survey or conveyance boundary.</p>
              </article>

              <article className={styles.panel}>
                <p className={styles.eyebrow}>EVIDENCE SNAPSHOT</p>
                <div className={styles.detailRows}>
                  <div><span>County SBL</span><strong>{record?.sbl || '—'}</strong></div>
                  <div><span>City raw SBL</span><strong>{FIRST_REAL_ERIE_PARCEL.cityScheduleRawSbl}</strong></div>
                  <div><span>PIN</span><strong>{record?.pin || '—'}</strong></div>
                  <div><span>Municipality</span><strong>{record?.municipality || '—'}</strong></div>
                  <div><span>Reference point</span><strong>{Number(twin?.location?.latitude).toFixed(6)}, {Number(twin?.location?.longitude).toFixed(6)}</strong></div>
                  <div><span>Building footprints</span><strong>{record?.buildingFootprintCount ?? '—'}</strong></div>
                  <div><span>Year built</span><strong>{record?.yearBuilt || '—'}</strong></div>
                  <div><span>Living area</span><strong>{record?.livingAreaSqFt ? `${record.livingAreaSqFt.toLocaleString()} sq ft` : '—'}</strong></div>
                  <div><span>County assessment</span><strong>{money(record?.totalAssessedValueUsd)}</strong></div>
                  <div><span>Height state</span><strong>{twin?.verification?.heightStatus || 'missing'}</strong></div>
                </div>
              </article>
            </section>

            <section className={styles.panel} style={{ marginTop: 18 }}>
              <div className={styles.panelHeader}>
                <div><p className={styles.eyebrow}>PROVENANCE + LIMITS</p><h2>What this parcel proves today.</h2></div>
                <span className={styles.pill}>NO OWNERSHIP CLAIM</span>
              </div>
              <div className={styles.sourceGrid}>
                <div><strong>Parcel identity + polygon</strong><span>{twin?.location?.source?.authority} · record {twin?.location?.source?.recordId}</span></div>
                <div><strong>Building footprint</strong><span>{twin?.structure?.source?.authority} · record {twin?.structure?.source?.recordId}</span></div>
                <div><strong>Measured height</strong><span>{twin?.structure?.heightUnavailableReason}</span></div>
                <div><strong>Legal rights</strong><span>Ownership remains unverified and the rights type remains REFERENCE ONLY.</span></div>
              </div>
              <div className={styles.links}>
                <a href={evidence?.provenance?.parcelLayer} target="_blank" rel="noreferrer">Erie parcel layer ↗</a>
                <a href={evidence?.provenance?.buildingLayer} target="_blank" rel="noreferrer">Erie building layer ↗</a>
                <a href={FIRST_REAL_ERIE_PARCEL.identifierSourceUrl} target="_blank" rel="noreferrer">Buffalo identifier source ↗</a>
              </div>
              <p className={styles.note}>Identifier reconciliation: Erie County GIS returns SBL {FIRST_REAL_ERIE_PARCEL.countySbl}; the City schedule stores the same parcel as raw SBL {FIRST_REAL_ERIE_PARCEL.cityScheduleRawSbl}. Both use PIN {FIRST_REAL_ERIE_PARCEL.pin}. The County-formatted SBL is the runtime geometry lookup key.</p>
            </section>
          </>
        )}

        <footer className={styles.footer}>Voxel Vault · first real Erie County parcel evidence path · geography may verify, physical truth remains partial until measured height exists, ownership remains unverified.</footer>
      </div>
    </main>
  );
}
