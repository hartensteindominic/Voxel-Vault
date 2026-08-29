'use client';

import { useEffect, useMemo, useState } from 'react';
import { buildPropertyDraft, isPropertyDraftSaved, savePropertyDraft } from '../../../lib/property-drafts';

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

function buildingLabel(building, authoritativeEvidence) {
  const sourceAddress = [building?.tags?.houseNumber, building?.tags?.street].filter(Boolean).join(' ');
  return building?.tags?.name
    || sourceAddress
    || authoritativeEvidence?.twin?.identity?.address
    || authoritativeEvidence?.countyRecord?.sbl
    || 'Selected property';
}

export default function PropertyTruthStack({
  building = null,
  authoritativeEvidence = null,
  buffaloReference = null,
  listing = null,
  openImagery = null,
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
  const listingDerivativeMedia = Array.isArray(listing?.meshyReferences) && listing.meshyReferences.length >= 2;
  const openPhotos = Array.isArray(openImagery?.photos) ? openImagery.photos.length : 0;
  const openDerivativeMedia = Array.isArray(openImagery?.meshyReferences) && openImagery.meshyReferences.length >= 2;
  const derivativeMedia = listingDerivativeMedia || openDerivativeMedia;
  const canDraft = exactFootprint || globalFootprint || parcel || authoritativeLocation;
  const [saved, setSaved] = useState(false);
  const [saveNote, setSaveNote] = useState('');

  const draft = useMemo(() => buildPropertyDraft({
    building,
    authoritativeEvidence,
    buffaloReference,
    openImagery,
    listing,
    focusAuthority,
    fallbackLabel: buildingLabel(building, authoritativeEvidence),
  }), [building, authoritativeEvidence, buffaloReference, openImagery, listing, focusAuthority]);

  useEffect(() => {
    setSaved(Boolean(draft?.id && isPropertyDraftSaved(draft.id)));
    setSaveNote('');
  }, [draft?.id]);

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
      openDerivativeMedia ? 'ready' : openPhotos || listingPhoto ? 'reference' : 'unknown',
      openDerivativeMedia ? `${openPhotos} nearby KartaView frame${openPhotos === 1 ? '' : 's'} are available under an open derivative-compatible license; proximity still does not prove every frame depicts this exact parcel.` : openPhotos ? `${openPhotos} nearby open street frame${openPhotos === 1 ? '' : 's'} can be compared visually, but are not automatically treated as exact facade verification.` : listingPhoto ? 'Authorized listing imagery can be compared visually, but display rights do not automatically grant reconstruction rights.' : 'No visual evidence is attached yet.',
      openPhotos ? `${openImagery?.provider || 'KartaView'} · ${openImagery?.license || 'open license'}` : listingPhoto ? listing?.provider : '',
    ),
    layer(
      'Meshy 7 model',
      derivativeMedia && meshyConfigured ? 'ready' : meshyConfigured ? 'locked' : 'unknown',
      derivativeMedia && meshyConfigured ? 'Ready for controlled 2–4 view reconstruction using rights-cleared references.' : meshyConfigured ? 'Meshy is connected; generation stays locked until 2–4 rights-cleared views are present.' : 'Meshy is not configured on this deployment.',
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

  const strongest = exactFootprint ? 'PARCEL-LINKED 3D' : globalFootprint && openPhotos ? 'SOURCE 3D + OPEN STREET' : globalFootprint ? 'SOURCE 3D' : openPhotos ? 'OPEN STREET REFERENCE' : 'LOCATION ONLY';
  const makerStatus = exactFootprint && derivativeMedia && meshyConfigured
    ? 'PARCEL-LINKED 3D DRAFT · HIGH-FIDELITY UPGRADE READY'
    : exactFootprint ? 'PARCEL-LINKED 3D DRAFT'
      : globalFootprint && derivativeMedia && meshyConfigured ? 'SOURCE-BACKED 3D DRAFT · HIGH-FIDELITY UPGRADE READY'
        : globalFootprint ? 'SOURCE-BACKED 3D DRAFT'
          : parcel ? 'PARCEL 3D DRAFT' : 'LOCATION REFERENCE';

  function saveDraft() {
    if (!draft) {
      setSaveNote('This selection still needs a stable source identity before it can be saved.');
      return;
    }
    try {
      savePropertyDraft(draft);
      setSaved(true);
      setSaveNote('Saved to your 3D Property Drafts. No wallet or mint was used.');
    } catch (error) {
      setSaveNote(String(error?.message || error || 'Could not save this draft.'));
    }
  }

  function improve3d() {
    const panel = document.querySelector('.meshPanel');
    if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return <section className="truthStack">
    <div className="truthHead">
      <div><small>EVIDENCE LADDER</small><h3>What we really know.</h3></div>
      <span>{strongest}</span>
    </div>

    <div className="maker">
      <div className="makerTop">
        <div><small>PROPERTY → 3D VOXEL MAKER</small><h4>{makerStatus}</h4><p>{canDraft ? 'Voxel Vault turns the selected source evidence into a 3D property draft first. The draft can stay offchain forever.' : 'The location is selected, but Voxel Vault is still waiting for enough source evidence to create a trustworthy 3D draft.'}</p></div>
        <span className="noMint">NO MINT REQUIRED</span>
      </div>
      <div className="makerSteps" aria-label="3D property workflow">
        <div className={canDraft ? 'done' : ''}><b>01</b><span>3D DRAFT</span><small>{canDraft ? 'AUTO-CREATED' : 'WAITING'}</small></div>
        <div className={derivativeMedia && meshyConfigured ? 'readyStep' : ''}><b>02</b><span>IMPROVE</span><small>{derivativeMedia && meshyConfigured ? 'READY' : 'OPTIONAL'}</small></div>
        <div className={saved ? 'done' : ''}><b>03</b><span>SAVE</span><small>{saved ? 'IN VAULT' : 'OPTIONAL'}</small></div>
        <div><b>04</b><span>VERIFY</span><small>SEPARATE RIGHTS</small></div>
        <div className="optional"><b>05</b><span>MINT</span><small>OPTIONAL</small></div>
      </div>
      <div className="makerActions">
        <button className="primary" type="button" onClick={saveDraft} disabled={!draft}>{saved ? '✓ 3D DRAFT SAVED' : 'SAVE 3D DRAFT'}</button>
        <button type="button" onClick={improve3d} disabled={!building}>IMPROVE 3D ACCURACY</button>
        <a href="/vault/property-drafts">MY SAVED DRAFTS</a>
        <a href="/vault/properties/claim">VERIFY PROPERTY RIGHTS</a>
      </div>
      {saveNote ? <p className="saveNote" role="status">{saveNote}</p> : null}
      <div className="mintBoundary"><b>MINTING IS A LATER CHOICE, NOT THE CREATION STEP.</b><span>A future mint can add public blockchain provenance or wallet portability for the digital model. It cannot turn map data into a deed, create rent rights, or guarantee appreciation.</span></div>
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
.truthStack{display:grid;gap:12px;padding:15px;border:1px solid rgba(255,255,255,.08);border-radius:22px;background:linear-gradient(145deg,rgba(255,255,255,.025),rgba(121,239,188,.025))}.truthHead{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.truthHead small{font-size:7px;letter-spacing:.14em;color:#7ddfba;font-weight:950}.truthHead h3{font-size:22px;letter-spacing:-.04em;margin:4px 0 0}.truthHead>span{font-size:6px;letter-spacing:.11em;font-weight:950;border:1px solid rgba(121,239,188,.18);color:#a9ead1;background:rgba(121,239,188,.055);border-radius:999px;padding:7px 9px}.maker{display:grid;gap:10px;padding:14px;border:1px solid rgba(121,239,188,.16);border-radius:18px;background:radial-gradient(circle at 85% 0,rgba(121,239,188,.08),transparent 28%),rgba(0,0,0,.15)}.makerTop{display:flex;justify-content:space-between;align-items:flex-start;gap:14px}.makerTop small{font-size:6px;letter-spacing:.15em;color:#7ddfba;font-weight:950}.makerTop h4{margin:4px 0;font-size:15px;letter-spacing:-.025em}.makerTop p{max-width:700px;margin:0;color:#84918c;font-size:7px;line-height:1.55}.noMint{flex:0 0 auto;border:1px solid rgba(121,239,188,.24);border-radius:999px;padding:7px 9px;color:#a9ead1;background:rgba(121,239,188,.06);font-size:6px;font-weight:950;letter-spacing:.11em}.makerSteps{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px}.makerSteps>div{min-height:58px;padding:9px;border:1px solid rgba(255,255,255,.06);border-radius:12px;background:rgba(255,255,255,.018)}.makerSteps b{display:block;color:#56605c;font-size:7px}.makerSteps span{display:block;margin-top:5px;font-size:8px;font-weight:950;letter-spacing:.05em}.makerSteps small{display:block;margin-top:2px;color:#65716c;font-size:5px;font-weight:900;letter-spacing:.07em}.makerSteps .done{border-color:rgba(121,239,188,.22);background:rgba(121,239,188,.055)}.makerSteps .done b,.makerSteps .done small{color:#7ddfba}.makerSteps .readyStep{border-color:rgba(192,159,255,.24);background:rgba(192,159,255,.045)}.makerSteps .readyStep b,.makerSteps .readyStep small{color:#c6aff8}.makerSteps .optional{border-style:dashed}.makerActions{display:grid;grid-template-columns:1.15fr 1fr 1fr 1fr;gap:7px}.makerActions button,.makerActions a{display:grid;place-items:center;min-height:42px;border:1px solid rgba(255,255,255,.08);border-radius:11px;padding:8px 10px;background:rgba(255,255,255,.04);color:#a4afab;text-decoration:none;text-align:center;font:inherit;font-size:6px;font-weight:950;letter-spacing:.07em;cursor:pointer}.makerActions button.primary{border-color:rgba(121,239,188,.25);background:#81dfbd;color:#06100c}.makerActions button:disabled{opacity:.42;cursor:not-allowed}.saveNote{margin:0;padding:9px 10px;border-radius:10px;background:rgba(121,239,188,.055);color:#a5d8c5;font-size:7px}.mintBoundary{display:flex;gap:10px;align-items:flex-start;padding-top:9px;border-top:1px solid rgba(255,255,255,.06)}.mintBoundary b{flex:0 0 auto;color:#9ba7a2;font-size:6px;letter-spacing:.08em}.mintBoundary span{color:#68746f;font-size:6px;line-height:1.5}.truthGrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px}.truthLayer{display:grid;align-content:start;gap:6px;min-height:120px;padding:11px;border:1px solid rgba(255,255,255,.06);border-radius:15px;background:rgba(0,0,0,.13)}.layerTop{display:flex;justify-content:space-between;gap:7px;align-items:center}.layerTop b{font-size:8px}.layerTop span{font-size:5px;font-weight:950;letter-spacing:.08em;color:#7d8984}.truthLayer.authoritative{border-color:rgba(121,239,188,.22);background:rgba(121,239,188,.045)}.truthLayer.authoritative .layerTop span{color:#82e3bd}.truthLayer.source .layerTop span{color:#91badc}.truthLayer.calibrated .layerTop span{color:#dfca82}.truthLayer.reference .layerTop span{color:#c3adf0}.truthLayer.ready .layerTop span{color:#7ee5b9}.truthLayer.locked .layerTop span{color:#d9a287}.truthLayer p{margin:0;color:#85918c;font-size:7px;line-height:1.55}.truthLayer small{margin-top:auto;color:#65716c;font-size:6px;line-height:1.4}
@media(max-width:900px){.truthGrid{grid-template-columns:repeat(2,minmax(0,1fr))}.makerActions{grid-template-columns:1fr 1fr}}
@media(max-width:560px){.truthHead{display:grid}.truthHead>span{justify-self:start}.makerTop{display:grid}.noMint{justify-self:start}.makerSteps{grid-template-columns:repeat(2,minmax(0,1fr))}.makerSteps>div:last-child{grid-column:1/-1}.makerActions{grid-template-columns:1fr}.mintBoundary{display:grid}.truthGrid{grid-template-columns:1fr 1fr}.truthLayer{min-height:112px;padding:10px}.truthLayer p{font-size:7px}}
`;
