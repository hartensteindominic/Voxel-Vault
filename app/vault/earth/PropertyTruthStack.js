'use client';

function has(value) { return value !== null && value !== undefined && String(value).trim() !== ''; }

function layer(label, status, detail, source = '') {
  return { label, status, detail, source };
}

function statusLabel(status) {
  if (status === 'authoritative') return 'AUTHORITATIVE';
  if (status === 'source') return 'SOURCE-BACKED';
  if (status === 'calibrated') return 'CALIBRATED';
  if (status === 'reference') return 'REFERENCE';
  if (status === 'ready') return 'READY';
  if (status === 'locked') return 'LOCKED';
  return 'UNKNOWN';
}

export default function PropertyTruthStack({
  building = null,
  authoritativeEvidence = null,
  buffaloReference = null,
  listing = null,
  googleConfigured = false,
  meshyConfigured = false,
  focusAuthority = '',
}) {
  const twin = authoritativeEvidence?.twin || null;
  const county = authoritativeEvidence?.countyRecord || null;
  const exactFootprint = Boolean(twin?.structure?.buildingGeometry);
  const globalFootprint = Boolean(building?.geometry);
  const parcel = Boolean(twin?.location?.parcelGeometry);
  const authoritativeLocation = Boolean(twin?.location?.source?.authority || focusAuthority);
  const calibratedHeight = Number(buffaloReference?.visualHeightReferenceMeters) > 0;
  const globalHeight = Number(building?.height?.referenceHeightMeters) > 0;
  const listingPhoto = Boolean(listing?.imageUrl);
  const derivativeMedia = Array.isArray(listing?.meshyReferences) && listing.meshyReferences.length >= 2;

  const layers = [
    layer(
      'Location',
      authoritativeLocation ? 'authoritative' : globalFootprint ? 'source' : 'unknown',
      authoritativeLocation ? 'Jurisdiction/source coordinates attached.' : globalFootprint ? 'Map-source center point attached.' : 'Exact location is still resolving.',
      twin?.location?.source?.authority || focusAuthority || building?.source?.authority || '',
    ),
    layer(
      'Parcel identity',
      parcel ? 'authoritative' : 'unknown',
      parcel ? `${county?.sbl || county?.pin || twin?.identity?.parcelId || 'Parcel'} is attached to jurisdiction GIS geometry.` : 'No jurisdiction parcel polygon is attached to this view yet.',
      twin?.location?.source?.authority || '',
    ),
    layer(
      'Building footprint',
      exactFootprint ? 'authoritative' : globalFootprint ? 'source' : 'unknown',
      exactFootprint ? 'Exact parcel-linked BUILDING geometry is driving the selected structure.' : globalFootprint ? 'Overture/OSM reference geometry is available, but is not a cadastral building survey.' : 'No footprint is being invented.',
      exactFootprint ? twin?.structure?.source?.authority : building?.source?.authority,
    ),
    layer(
      'Height + massing',
      calibratedHeight ? 'calibrated' : globalHeight ? 'source' : 'unknown',
      calibratedHeight ? `${buffaloReference?.stories || 'City-reported'} stories calibrate display massing; not a measured roof height.` : globalHeight ? 'Map-source/derived display height is available.' : 'Measured/credible display height is not attached yet.',
      calibratedHeight ? buffaloReference?.source?.authority : building?.height?.heightSource || '',
    ),
    layer(
      'Exterior appearance',
      derivativeMedia ? 'ready' : listingPhoto || googleConfigured ? 'reference' : 'unknown',
      derivativeMedia ? 'The provider supplied media with explicit derivative-generation rights.' : listingPhoto || googleConfigured ? 'Live/listing imagery can be compared visually, but does not automatically verify windows, roof, porch, color or materials.' : 'No rights-cleared visual evidence is attached yet.',
      derivativeMedia ? 'Derivative-licensed provider media' : listingPhoto ? listing?.provider : googleConfigured ? 'Google live visualization' : '',
    ),
    layer(
      'Meshy 7 model',
      derivativeMedia && meshyConfigured ? 'ready' : meshyConfigured ? 'locked' : 'unknown',
      derivativeMedia && meshyConfigured ? 'Ready for controlled 2–4 view reconstruction.' : meshyConfigured ? 'Meshy is connected; generation stays locked until 2–4 rights-cleared views are present.' : 'Meshy is not configured on this deployment.',
      meshyConfigured ? 'Meshy 7' : '',
    ),
    layer(
      'Market listing',
      listing ? 'source' : 'unknown',
      listing ? 'A current result from a connected authorized market provider is attached.' : 'A mapped building is not automatically for sale or rent.',
      listing?.provider || '',
    ),
    layer(
      'Ownership / title',
      'locked',
      'Map data, photos, a 3D twin or an NFT do not establish deed/title ownership. Legal rights stay separate until verified through the property/legal workflow.',
      '',
    ),
  ];

  const strongest = exactFootprint ? 'PARCEL-LINKED 3D' : globalFootprint ? 'SOURCE 3D' : googleConfigured ? 'REALITY REFERENCE' : 'LOCATION ONLY';

  return <section className="truthStack">
    <div className="truthHead">
      <div><small>EVIDENCE LADDER</small><h3>What we really know.</h3></div>
      <span>{strongest}</span>
    </div>
    <div className="truthGrid">
      {layers.map((item) => <div className={`truthLayer ${item.status}`} key={item.label}>
        <div className="layerTop"><b>{item.label}</b><span>{statusLabel(item.status)}</span></div>
        <p>{item.detail}</p>
        {has(item.source) ? <small>{item.source}</small> : null}
      </div>)}
    </div>
    <style jsx>{styles}</style>
  </section>;
}

const styles = `
.truthStack{display:grid;gap:12px;padding:15px;border:1px solid rgba(255,255,255,.08);border-radius:22px;background:linear-gradient(145deg,rgba(255,255,255,.025),rgba(121,239,188,.025))}.truthHead{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.truthHead small{font-size:7px;letter-spacing:.14em;color:#7ddfba;font-weight:950}.truthHead h3{font-size:22px;letter-spacing:-.04em;margin:4px 0 0}.truthHead>span{font-size:6px;letter-spacing:.11em;font-weight:950;border:1px solid rgba(121,239,188,.18);color:#a9ead1;background:rgba(121,239,188,.055);border-radius:999px;padding:7px 9px}.truthGrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px}.truthLayer{display:grid;align-content:start;gap:6px;min-height:120px;padding:11px;border:1px solid rgba(255,255,255,.06);border-radius:15px;background:rgba(0,0,0,.13)}.layerTop{display:flex;justify-content:space-between;gap:7px;align-items:center}.layerTop b{font-size:8px}.layerTop span{font-size:5px;font-weight:950;letter-spacing:.08em;color:#7d8984}.truthLayer.authoritative{border-color:rgba(121,239,188,.22);background:rgba(121,239,188,.045)}.truthLayer.authoritative .layerTop span{color:#82e3bd}.truthLayer.source .layerTop span{color:#91badc}.truthLayer.calibrated .layerTop span{color:#dfca82}.truthLayer.reference .layerTop span{color:#c3adf0}.truthLayer.ready .layerTop span{color:#7ee5b9}.truthLayer.locked .layerTop span{color:#d9a287}.truthLayer p{margin:0;color:#85918c;font-size:7px;line-height:1.55}.truthLayer small{margin-top:auto;color:#65716c;font-size:6px;line-height:1.4}
@media(max-width:900px){.truthGrid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:560px){.truthHead{display:grid}.truthHead>span{justify-self:start}.truthGrid{grid-template-columns:1fr 1fr}.truthLayer{min-height:112px;padding:10px}.truthLayer p{font-size:7px}}
`;
