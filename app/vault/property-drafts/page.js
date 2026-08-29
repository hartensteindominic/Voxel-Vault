'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { deletePropertyDraft, exportPropertyDraft, readPropertyDrafts } from '../../../lib/property-drafts';

function fidelityLabel(value) {
  if (value === 'parcel-linked-ready-for-high-fidelity') return 'PARCEL-LINKED · HIGH-FIDELITY READY';
  if (value === 'source-backed-ready-for-high-fidelity') return 'SOURCE-BACKED · HIGH-FIDELITY READY';
  if (value === 'parcel-linked-3d-draft') return 'PARCEL-LINKED 3D DRAFT';
  if (value === 'source-backed-3d-draft') return 'SOURCE-BACKED 3D DRAFT';
  if (value === 'parcel-3d-draft') return 'PARCEL 3D DRAFT';
  return 'LOCATION REFERENCE';
}

function coordinateText(draft) {
  const lat = Number(draft?.coordinates?.latitude);
  const lng = Number(draft?.coordinates?.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) ? `${lat.toFixed(6)}, ${lng.toFixed(6)}` : 'Coordinates not saved';
}

export default function PropertyDraftsPage() {
  const [drafts, setDrafts] = useState([]);

  function refresh() { setDrafts(readPropertyDrafts()); }
  useEffect(() => { refresh(); }, []);

  function remove(id) {
    deletePropertyDraft(id);
    refresh();
  }

  return <main className="page">
    <header><Link href="/vault/earth">← EARTH</Link><span>VOXEL VAULT · 3D PROPERTY DRAFTS</span><Link href="/vault/properties/claim">VERIFY ↗</Link></header>
    <section className="hero">
      <small>NO WALLET REQUIRED · NO MINT REQUIRED</small>
      <h1>Your property<br/><em>drafts.</em></h1>
      <p>Every saved item here is a 3D property representation built from the evidence Voxel Vault actually had. Keep it offchain forever, improve it later, verify the underlying property separately, or mint a digital provenance record only if you want to.</p>
    </section>

    {drafts.length ? <section className="grid">{drafts.map((draft) => <article key={draft.id}>
      <div className="visual"><div className="parcel"/><div className="mass"><i/><i/><i/></div><span>{fidelityLabel(draft.fidelity)}</span></div>
      <div className="body">
        <small>{draft.geometryKind?.replaceAll('-', ' ').toUpperCase()}</small>
        <h2>{draft.label || 'Saved property draft'}</h2>
        <p className="coord">{coordinateText(draft)}</p>
        <div className="facts">
          <div><b>{draft.evidence?.exactParcelLinkedBuilding ? 'YES' : draft.evidence?.sourceBackedBuilding ? 'MAP' : '—'}</b><span>3D FOOTPRINT</span></div>
          <div><b>{draft.evidence?.openStreetPhotoCount || 0}</b><span>OPEN PHOTOS</span></div>
          <div><b>{draft.evidence?.reconstructionReferenceCount || 0}</b><span>3D REFERENCES</span></div>
          <div><b>NO</b><span>MINTED</span></div>
        </div>
        <div className="actions"><Link href="/vault/earth">OPEN EARTH</Link><button type="button" onClick={() => exportPropertyDraft(draft)}>EXPORT</button><button type="button" onClick={() => remove(draft.id)}>REMOVE</button></div>
        <Link className="verify" href="/vault/properties/claim">Verify property rights before any ownership claim →</Link>
        <p className="legal">Saving this model does not create deed/title, investment rights, rent rights, or guaranteed value. Minting remains optional and does not change that.</p>
      </div>
    </article>)}</section> : <section className="empty"><b>NO SAVED 3D PROPERTY DRAFTS YET</b><span>Open Earth, select a source-backed property, and tap Save 3D Draft. No blockchain step is required.</span><Link href="/vault/earth">EXPLORE EARTH →</Link></section>}

    <style jsx>{`
      :global(body){margin:0;background:#07090c;color:#f5f7f8;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.page{min-height:100vh;padding:20px clamp(16px,4vw,58px) 88px;background:radial-gradient(circle at 72% 8%,rgba(121,239,188,.09),transparent 30%),#07090c}header{display:flex;justify-content:space-between;align-items:center;gap:14px;font-size:8px;font-weight:950;letter-spacing:.12em;color:#77827f}header a{color:#9aa5a2;text-decoration:none}.hero{max-width:900px;margin:82px 0 34px}.hero small{font-size:8px;font-weight:950;letter-spacing:.16em;color:#7fe0bb}.hero h1{font-size:clamp(56px,8vw,105px);line-height:.87;letter-spacing:-.07em;margin:14px 0 22px}.hero h1 em{font-style:normal;color:#76807d}.hero p{max-width:720px;font-size:12px;line-height:1.75;color:#87918e}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:14px}.grid article{overflow:hidden;border:1px solid rgba(255,255,255,.08);border-radius:24px;background:linear-gradient(145deg,rgba(255,255,255,.045),rgba(255,255,255,.012))}.visual{height:190px;position:relative;overflow:hidden;background:radial-gradient(circle at 50% 35%,rgba(121,239,188,.12),transparent 28%),linear-gradient(#12171b,#090b0e)}.parcel{position:absolute;left:10%;right:10%;bottom:15%;height:34%;border:2px solid rgba(121,239,188,.3);transform:perspective(330px) rotateX(60deg);border-radius:14px}.mass{position:absolute;left:28%;right:28%;bottom:30%;height:38%;background:#c9cec8;box-shadow:0 22px 45px rgba(0,0,0,.42)}.mass:before{content:'';position:absolute;left:-7%;right:-7%;top:-10%;height:13%;background:#3d4544}.mass i{position:absolute;bottom:18%;width:17%;height:32%;background:#7fe0bb;opacity:.72}.mass i:nth-child(1){left:12%}.mass i:nth-child(2){left:42%}.mass i:nth-child(3){right:12%}.visual span{position:absolute;top:14px;left:14px;right:14px;width:max-content;max-width:calc(100% - 28px);font-size:7px;line-height:1.3;font-weight:950;letter-spacing:.1em;padding:7px 9px;border-radius:999px;background:rgba(3,7,8,.72);border:1px solid rgba(255,255,255,.1);color:#b9e9d6}.body{padding:18px}.body>small{font-size:7px;font-weight:950;letter-spacing:.12em;color:#6f7c78}.body h2{font-size:23px;letter-spacing:-.045em;margin:5px 0 4px}.coord{font-size:9px;color:#7f8986;margin:0 0 15px}.facts{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:0 0 14px}.facts div{border:1px solid rgba(255,255,255,.06);border-radius:12px;padding:9px;background:rgba(0,0,0,.12)}.facts b{display:block;font-size:12px}.facts span{display:block;margin-top:3px;font-size:5px;font-weight:950;letter-spacing:.08em;color:#65716d}.actions{display:grid;grid-template-columns:1fr auto auto;gap:7px}.actions a,.actions button{border:0;border-radius:11px;padding:11px 12px;font:inherit;font-size:7px;font-weight:950;letter-spacing:.09em;text-align:center;text-decoration:none;background:#eef3f1;color:#0a0d0c;cursor:pointer}.actions button{background:rgba(255,255,255,.07);color:#a7b1ae}.verify{display:block;margin-top:10px;color:#8cdabd;text-decoration:none;font-size:8px;font-weight:850}.legal{margin:10px 0 0;color:#616c68;font-size:7px;line-height:1.5}.empty{max-width:760px;padding:28px;border:1px dashed rgba(121,239,188,.22);border-radius:22px;background:rgba(121,239,188,.025)}.empty b{display:block;font-size:12px;letter-spacing:.08em}.empty span{display:block;color:#7f8b87;font-size:10px;line-height:1.6;margin:8px 0 18px}.empty a{display:inline-block;padding:12px 14px;border-radius:12px;background:#7fe0bb;color:#06100c;text-decoration:none;font-size:8px;font-weight:950;letter-spacing:.1em}@media(max-width:620px){.page{padding:16px 14px 76px}.hero{margin-top:55px}.hero h1{font-size:56px}.grid{grid-template-columns:1fr}.facts{grid-template-columns:1fr 1fr}.actions{grid-template-columns:1fr 1fr}.actions a{grid-column:1/-1}}
    `}</style>
  </main>;
}
