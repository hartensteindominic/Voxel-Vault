import Link from 'next/link';
import {
  FIRST_REAL_ERIE_PARCEL,
  fetchFirstRealErieParcel,
} from '../../../../lib/real-estate/erie-county-evidence.js';
import {
  FIRST_REAL_BUFFALO_PRESERVATION_RECORD,
  validateFirstRealBuffaloPreservationRecord,
} from '../../../../lib/real-estate/buffalo-preservation-evidence.js';
import {
  NYS_ERIE_LIDAR_INDEX_LAYER,
  fetchNysErieLidarCoverage,
} from '../../../../lib/real-estate/nys-lidar-evidence.js';
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
  if (!points.length) return <div className={styles.error}>No accepted source geometry is available. The page will not substitute a generic model.</div>;

  const lons = points.map((pair) => Number(pair?.[0])).filter(Number.isFinite);
  const lats = points.map((pair) => Number(pair?.[1])).filter(Number.isFinite);
  if (!lons.length || !lats.length) return <div className={styles.error}>Accepted source geometry could not be rendered.</div>;

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
      <svg
        className={styles.mapSvg}
        viewBox={`0 0 ${canvasW} ${canvasH}`}
        role="img"
        aria-label={buildingRings.length
          ? 'Official Erie County parcel polygon with accepted parcel-linked building footprint evidence'
          : 'Official Erie County parcel polygon; no parcel-specific building footprint is currently accepted'}
      >
        <rect width={canvasW} height={canvasH} rx="24" fill="#f5f3ee" />
        {parcelRings.map((ring, index) => <path key={`parcel-${index}`} d={pathFor(ring)} fill="rgba(17,17,17,.08)" stroke="#111" strokeWidth="4" />)}
        {buildingRings.map((ring, index) => <path key={`building-${index}`} d={pathFor(ring)} fill="rgba(141,139,131,.66)" stroke="#5f5d57" strokeWidth="3" />)}
      </svg>
      <div className={styles.legend}>
        <span><i className={styles.parcelSwatch} />Official parcel polygon</span>
        {buildingRings.length ? <span><i className={styles.buildingSwatch} />Accepted parcel-linked building footprint</span> : null}
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
  const cityRecord = validateFirstRealBuffaloPreservationRecord(FIRST_REAL_BUFFALO_PRESERVATION_RECORD);
  let evidence;
  let lidarEvidence;
  let error = '';
  let lidarError = '';
  try {
    evidence = await fetchFirstRealErieParcel();
    try {
      lidarEvidence = await fetchNysErieLidarCoverage({
        latitude: evidence?.twin?.location?.latitude,
        longitude: evidence?.twin?.location?.longitude,
      });
    } catch (err) {
      lidarError = err instanceof Error ? err.message : 'NYS LiDAR coverage could not be loaded.';
    }
  } catch (err) {
    error = err instanceof Error ? err.message : 'Erie County evidence could not be loaded.';
  }

  const twin = evidence?.twin;
  const record = evidence?.countyRecord;
  const labels = evidence?.truthLabels;
  const buildingAccepted = Boolean(twin?.structure?.buildingGeometry && record?.buildingFootprintCount > 0);
  const buildingCandidateCount = Number(record?.buildingCandidateCount || 0);
  const lidarCovered = lidarEvidence?.coverageStatus === 'covered';
  const lidarTileNames = lidarEvidence?.tiles?.map((tile) => tile.filename).filter(Boolean) || [];
  const citySblMatches = cityRecord.sbl === record?.sbl;

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
            <p className={styles.lead}>This page anchors the property to the exact Erie County parcel and independently cross-references the City of Buffalo&apos;s published historic inventory. The City identifies SBL {cityRecord.sbl} as {cityRecord.address}, also {cityRecord.alternativeAddress}, the {cityRecord.propertyName}, an office building recorded as built in {cityRecord.yearBuilt}. That historic identity evidence does not substitute for a current parcel-specific footprint or measured height.</p>
          </article>
          <aside className={styles.statusCard}>
            <div>
              <p className={styles.eyebrow}>FORCING FUNCTION</p>
              <strong>{error ? 'EVIDENCE UNAVAILABLE' : 'LIVE SOURCE EVIDENCE'}</strong>
            </div>
            <div className={styles.statusList}>
              <span>COUNTY SBL · {FIRST_REAL_ERIE_PARCEL.countySbl}</span>
              <span>PIN · {FIRST_REAL_ERIE_PARCEL.pin}</span>
              <span>CITY RECORD · {citySblMatches ? 'SBL MATCH' : 'MISMATCH'}</span>
              <span>BUILDING · {buildingAccepted ? 'PARCEL-LINKED' : 'FOOTPRINT UNVERIFIED'}</span>
              <span>LIDAR · {lidarCovered ? 'COVERAGE FOUND' : lidarError ? 'SOURCE UNAVAILABLE' : 'NO COVERAGE FOUND'}</span>
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
              <article><small>PHYSICAL</small><strong>{labels?.physical}</strong><span>{buildingAccepted ? 'A parcel-linked footprint is accepted, but measured height is still required.' : 'The City historic identity matches, but no current parcel-specific building footprint is accepted. Broad spatial candidates remain diagnostic only.'}</span></article>
              <article><small>SPATIAL TWIN</small><strong>{labels?.spatialTwin}</strong><span>Full spatial verification requires defensible parcel-specific building geometry and measured height, not just a historical record.</span></article>
              <article><small>OWNERSHIP</small><strong>{labels?.ownership}</strong><span>County GIS, City preservation records and LiDAR do not establish deed, title, LLC membership or investment rights.</span></article>
            </section>

            <section className={styles.twoCol}>
              <article className={styles.panel}>
                <div className={styles.panelHeader}>
                  <div><p className={styles.eyebrow}>ACCEPTED SOURCE GEOMETRY</p><h2>{record?.parcelAddress || twin?.label}</h2></div>
                  <span className={styles.pill}>REFERENCE ONLY</span>
                </div>
                <EvidenceMap parcelGeometry={twin?.location?.parcelGeometry} buildingGeometry={twin?.structure?.buildingGeometry} />
                <p className={styles.note}>{buildingAccepted
                  ? 'The drawing contains the source-backed parcel and an exact parcel-linked building footprint. It is still a GIS reference, not a legal survey or conveyance boundary.'
                  : 'Only the exact source-backed parcel polygon is rendered. The County building layer returned a broader spatial candidate without the parcel identifier, so Voxel Vault refuses to draw it as 618 Main. The City historic inventory confirms building identity, not current geometry. No generic house or fake 3D extrusion is substituted.'}</p>
              </article>

              <article className={styles.panel}>
                <p className={styles.eyebrow}>EVIDENCE SNAPSHOT</p>
                <div className={styles.detailRows}>
                  <div><span>County SBL</span><strong>{record?.sbl || '—'}</strong></div>
                  <div><span>City raw SBL</span><strong>{FIRST_REAL_ERIE_PARCEL.cityScheduleRawSbl}</strong></div>
                  <div><span>PIN</span><strong>{record?.pin || '—'}</strong></div>
                  <div><span>Municipality</span><strong>{record?.municipality || '—'}</strong></div>
                  <div><span>City historic address</span><strong>{cityRecord.address}</strong></div>
                  <div><span>Alternative address</span><strong>{cityRecord.alternativeAddress}</strong></div>
                  <div><span>Historic building name</span><strong>{cityRecord.propertyName}</strong></div>
                  <div><span>Historic use</span><strong>{cityRecord.propertyDescription}</strong></div>
                  <div><span>City survey year built</span><strong>{cityRecord.yearBuilt}</strong></div>
                  <div><span>Architect</span><strong>{cityRecord.architect}</strong></div>
                  <div><span>Style</span><strong>{cityRecord.style}</strong></div>
                  <div><span>Historic district</span><strong>{cityRecord.historicDistrictName}</strong></div>
                  <div><span>Reference point</span><strong>{Number(twin?.location?.latitude).toFixed(6)}, {Number(twin?.location?.longitude).toFixed(6)}</strong></div>
                  <div><span>Accepted building footprints</span><strong>{record?.buildingFootprintCount ?? '—'}</strong></div>
                  <div><span>Unverified spatial candidates</span><strong>{record?.buildingCandidateCount ?? '—'}</strong></div>
                  <div><span>Building match</span><strong>{record?.buildingMatchStrategy || '—'}</strong></div>
                  <div><span>NYS LiDAR coverage</span><strong>{lidarCovered ? 'FOUND' : lidarError ? 'UNAVAILABLE' : 'NOT FOUND'}</strong></div>
                  <div><span>LAS tiles</span><strong>{lidarEvidence?.tiles?.length ?? '—'}</strong></div>
                  <div><span>County assessment</span><strong>{money(record?.totalAssessedValueUsd)}</strong></div>
                  <div><span>Height state</span><strong>{twin?.verification?.heightStatus || 'missing'}</strong></div>
                </div>
                {lidarError ? <p className={styles.note}>LiDAR check failed closed for this request: {lidarError}</p> : null}
              </article>
            </section>

            <section className={styles.panel} style={{ marginTop: 18 }}>
              <div className={styles.panelHeader}>
                <div><p className={styles.eyebrow}>PROVENANCE + LIMITS</p><h2>What this parcel proves today.</h2></div>
                <span className={styles.pill}>NO OWNERSHIP CLAIM</span>
              </div>
              <div className={styles.sourceGrid}>
                <div><strong>Parcel identity + polygon</strong><span>{twin?.location?.source?.authority} · record {twin?.location?.source?.recordId}</span></div>
                <div><strong>Historic building identity</strong><span>{cityRecord.source.authority} · {cityRecord.address} / {cityRecord.alternativeAddress} · {cityRecord.yearBuilt}</span></div>
                <div><strong>Parcel-specific building footprint</strong><span>{buildingAccepted ? `${twin?.structure?.source?.authority} · record ${twin?.structure?.source?.recordId}` : `Not accepted · ${buildingCandidateCount} spatial candidate${buildingCandidateCount === 1 ? '' : 's'} retained only for diagnosis`}</span></div>
                <div><strong>NYS LiDAR coverage</strong><span>{lidarCovered ? `${lidarEvidence?.source?.authority} · ${lidarTileNames.join(', ') || `${lidarEvidence?.tiles?.length || 0} tile(s)`}` : lidarError || 'No intersecting source tile was returned.'}</span></div>
                <div><strong>Measured height</strong><span>{twin?.structure?.heightUnavailableReason}</span></div>
                <div><strong>Legal rights</strong><span>Ownership remains unverified and the rights type remains REFERENCE ONLY.</span></div>
              </div>
              <div className={styles.links}>
                <a href={evidence?.provenance?.parcelLayer} target="_blank" rel="noreferrer">Erie parcel layer ↗</a>
                <a href={evidence?.provenance?.buildingLayer} target="_blank" rel="noreferrer">Erie building source ↗</a>
                <a href={cityRecord.source.sourceUrl} target="_blank" rel="noreferrer">Buffalo preservation survey ↗</a>
                <a href={NYS_ERIE_LIDAR_INDEX_LAYER} target="_blank" rel="noreferrer">NYS LiDAR index ↗</a>
                <a href={FIRST_REAL_ERIE_PARCEL.identifierSourceUrl} target="_blank" rel="noreferrer">Buffalo identifier source ↗</a>
              </div>
              <p className={styles.note}>Identifier reconciliation: Erie County GIS returns SBL {FIRST_REAL_ERIE_PARCEL.countySbl}; the City schedule stores the same parcel as raw SBL {FIRST_REAL_ERIE_PARCEL.cityScheduleRawSbl}; the City preservation survey publishes SBL {cityRecord.sbl} for {cityRecord.address}. These sources converge on the same parcel identity while retaining their original identifier formats.</p>
              <p className={styles.note}>The City preservation survey is useful evidence of historical building identity, use, age, architect and style. It does not certify the current footprint, height, condition, ownership or title.</p>
              <p className={styles.note}>A spatial intersection is not enough to identify a building. The current County candidate is preserved in provenance for investigation but is excluded from the property twin until a parcel-specific geometry relationship can be defended.</p>
              <p className={styles.note}>LiDAR tile discovery proves authoritative point-cloud coverage only. Voxel Vault will not mark height as measured until accepted building geometry exists and a reproducible roof-versus-ground method passes its quality and uncertainty gates.</p>
            </section>
          </>
        )}

        <footer className={styles.footer}>Voxel Vault · first real Erie County parcel evidence path · geography verified when source checks pass · City historic identity cross-referenced · parcel-specific physical geometry currently unverified · LiDAR coverage separate · ownership unverified.</footer>
      </div>
    </main>
  );
}
