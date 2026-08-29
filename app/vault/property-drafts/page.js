'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { getSupabaseBrowserAsync } from '../../../lib/supabase-browser';
import { deletePropertyDraft, exportPropertyDraft, readPropertyDrafts } from '../../../lib/property-drafts';
import { deletePropertyDraftFromAccount, syncLocalPropertyDraftsToAccount } from '../../../lib/property-drafts-account';

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
  const [session, setSession] = useState(null);
  const [syncStatus, setSyncStatus] = useState('Saved drafts work on this device without an account.');
  const [busy, setBusy] = useState('');
  const clientRef = useRef(null);

  function refresh() { setDrafts(readPropertyDrafts()); }

  useEffect(() => {
    let active = true;
    let subscription = null;
    refresh();
    async function apply(client, nextSession) {
      if (!active) return;
      setSession(nextSession || null);
      if (!nextSession?.user) {
        refresh();
        setSyncStatus('Local mode · sign in with Google to sync these drafts between iPhone and desktop.');
        return;
      }
      setBusy('sync');
      setSyncStatus('Merging browser + account property drafts…');
      try {
        const merged = await syncLocalPropertyDraftsToAccount(client, nextSession.user);
        if (!active) return;
        setDrafts(merged);
        setSyncStatus(`Google sync active · ${merged.length} property draft${merged.length === 1 ? '' : 's'} available on this account.`);
      } catch (error) {
        if (active) {
          refresh();
          setSyncStatus(String(error?.message || error || 'Cloud sync is unavailable. Your local drafts are still safe on this device.'));
        }
      } finally {
        if (active) setBusy('');
      }
    }
    getSupabaseBrowserAsync().then(async (client) => {
      if (!active) return;
      clientRef.current = client;
      const { data } = await client.auth.getSession();
      await apply(client, data.session || null);
      const auth = client.auth.onAuthStateChange((_event, next) => apply(client, next));
      subscription = auth.data.subscription;
    }).catch(() => { if (active) setSyncStatus('Local mode · account sync is not configured on this deployment.'); });
    return () => { active = false; subscription?.unsubscribe?.(); };
  }, []);

  async function signIn() {
    setBusy('signin');
    try {
      const client = clientRef.current || await getSupabaseBrowserAsync();
      clientRef.current = client;
      const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: new URL('/vault/property-drafts', window.location.origin).toString() } });
      if (error) throw error;
    } catch (error) {
      setSyncStatus(String(error?.message || error || 'Could not start Google sign-in.'));
      setBusy('');
    }
  }

  async function signOut() {
    setBusy('signout');
    try {
      const client = clientRef.current || await getSupabaseBrowserAsync();
      clientRef.current = client;
      const { error } = await client.auth.signOut();
      if (error) throw error;
      setSession(null);
      refresh();
      setSyncStatus('Signed out · local drafts remain on this device.');
    } catch (error) {
      setSyncStatus(String(error?.message || error || 'Could not sign out.'));
    } finally { setBusy(''); }
  }

  async function remove(id) {
    deletePropertyDraft(id);
    refresh();
    if (!session?.user) return;
    setBusy(id);
    try {
      const client = clientRef.current || await getSupabaseBrowserAsync();
      clientRef.current = client;
      await deletePropertyDraftFromAccount(client, session.user, id);
      setSyncStatus('Draft removed from this device and your synced account library.');
    } catch (error) {
      setSyncStatus(`Removed locally, but account deletion needs attention: ${String(error?.message || error)}`);
    } finally { setBusy(''); }
  }

  return <main className="page">
    <header><Link href="/vault/earth">← EARTH</Link><span>VOXEL VAULT · 3D PROPERTY DRAFTS</span><Link href="/vault/properties/claim">VERIFY ↗</Link></header>
    <section className="hero">
      <small>NO WALLET REQUIRED · NO MINT REQUIRED</small>
      <h1>Your property<br/><em>drafts.</em></h1>
      <p>Every saved item here is a 3D property representation built from the evidence Voxel Vault actually had. Open the exact saved model, keep it offchain forever, improve it later, or verify the underlying property separately.</p>
      <div className="sync"><div><b>{session?.user ? 'ACCOUNT SYNC ON' : 'LOCAL + OPTIONAL CLOUD'}</b><span>{syncStatus}</span></div>{session?.user ? <button onClick={signOut} disabled={Boolean(busy)}>{busy === 'signout' ? 'SIGNING OUT…' : 'SIGN OUT'}</button> : <button onClick={signIn} disabled={Boolean(busy)}>{busy === 'signin' ? 'CONNECTING…' : 'CONTINUE WITH GOOGLE'}</button>}</div>
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
          <div><b>{draft.blockchain?.minted ? 'YES' : 'NO'}</b><span>MINTED</span></div>
        </div>
        <div className="actions"><Link href={`/vault/property-drafts/${encodeURIComponent(draft.id)}`}>OPEN EXACT 3D</Link><button type="button" onClick={() => exportPropertyDraft(draft)}>EXPORT</button><button type="button" onClick={() => remove(draft.id)} disabled={busy === draft.id}>{busy === draft.id ? 'REMOVING…' : 'REMOVE'}</button></div>
        <Link className="verify" href="/vault/properties/claim">Verify property rights before any ownership claim →</Link>
        <p className="legal">Saving this model does not create deed/title, investment rights, rent rights, or guaranteed value. Minting remains optional and does not change that.</p>
      </div>
    </article>)}</section> : <section className="empty"><b>NO SAVED 3D PROPERTY DRAFTS YET</b><span>Open Earth, select a source-backed property, and tap Save 3D Draft. No blockchain step is required.</span><Link href="/vault/earth">EXPLORE EARTH →</Link></section>}

    <style jsx>{`
      :global(body){margin:0;background:#07090c;color:#f5f7f8;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.page{min-height:100vh;padding:20px clamp(16px,4vw,58px) 88px;background:radial-gradient(circle at 72% 8%,rgba(121,239,188,.09),transparent 30%),#07090c}header{display:flex;justify-content:space-between;align-items:center;gap:14px;font-size:8px;font-weight:950;letter-spacing:.12em;color:#77827f}header a{color:#9aa5a2;text-decoration:none}.hero{max-width:900px;margin:82px 0 34px}.hero small{font-size:8px;font-weight:950;letter-spacing:.16em;color:#7fe0bb}.hero h1{font-size:clamp(56px,8vw,105px);line-height:.87;letter-spacing:-.07em;margin:14px 0 22px}.hero h1 em{font-style:normal;color:#76807d}.hero>p{max-width:720px;font-size:12px;line-height:1.75;color:#87918e}.sync{margin-top:18px;max-width:760px;display:flex;justify-content:space-between;align-items:center;gap:14px;padding:12px 13px;border:1px solid rgba(121,239,188,.16);border-radius:15px;background:rgba(121,239,188,.035)}.sync b{display:block;font-size:7px;letter-spacing:.12em;color:#9bdcc4}.sync span{display:block;margin-top:4px;color:#74817c;font-size:8px;line-height:1.45}.sync button{flex:0 0 auto;border:0;border-radius:10px;padding:10px 12px;background:#7fe0bb;color:#06100c;font-size:7px;font-weight:950;letter-spacing:.08em}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:14px}.grid article{overflow:hidden;border:1px solid rgba(255,255,255,.08);border-radius:24px;background:linear-gradient(145deg,rgba(255,255,255,.045),rgba(255,255,255,.012))}.visual{height:190px;position:relative;overflow:hidden;background:radial-gradient(circle at 50% 35%,rgba(121,239,188,.12),transparent 28%),linear-gradient(#12171b,#090b0e)}.parcel{position:absolute;left:10%;right:10%;bottom:15%;height:34%;border:2px solid rgba(121,239,188,.3);transform:perspective(330px) rotateX(60deg);border-radius:14px}.mass{position:absolute;left:28%;right:28%;bottom:30%;height:38%;background:#c9cec8;box-shadow:0 22px 45px rgba(0,0,0,.42)}.mass:before{content:'';position:absolute;left:-7%;right:-7%;top:-10%;height:13%;background:#3d4544}.mass i{position:absolute;bottom:18%;width:17%;height:32%;background:#7fe0bb;opacity:.72}.mass i:nth-child(1){left:12%}.mass i:nth-child(2){left:42%}.mass i:nth-child(3){right:12%}.visual span{position:absolute;top:14px;left:14px;right:14px;width:max-content;max-width:calc(100% - 28px);font-size:7px;line-height:1.3;font-weight:950;letter-spacing:.1em;padding:7px 9px;border-radius:999px;background:rgba(3,7,8,.72);border:1px solid rgba(255,255,255,.1);color:#b9e9d6}.body{padding:18px}.body>small{font-size:7px;font-weight:950;letter-spacing:.12em;color:#6f7c78}.body h2{font-size:23px;letter-spacing:-.045em;margin:5px 0 4px}.coord{font-size:9px;color:#7f8986;margin:0 0 15px}.facts{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:0 0 14px}.facts div{border:1px solid rgba(255,255,255,.06);border-radius:12px;padding:9px;background:rgba(0,0,0,.12)}.facts b{display:block;font-size:12px}.facts span{display:block;margin-top:3px;font-size:5px;font-weight:950;letter-spacing:.08em;color:#65716d}.actions{display:grid;grid-template-columns:1fr auto auto;gap:7px}.actions a,.actions button{border:0;border-radius:11px;padding:11px 12px;font:inherit;font-size:7px;font-weight:950;letter-spacing:.09em;text-align:center;text-decoration:none;background:#eef3f1;color:#0a0d0c;cursor:pointer}.actions button{background:rgba(255,255,255,.07);color:#a7b1ae}.verify{display:block;margin-top:10px;color:#8cdabd;text-decoration:none;font-size:8px;font-weight:850}.legal{margin:10px 0 0;color:#616c68;font-size:7px;line-height:1.5}.empty{max-width:760px;padding:28px;border:1px dashed rgba(121,239,188,.22);border-radius:22px;background:rgba(121,239,188,.025)}.empty b{display:block;font-size:12px;letter-spacing:.08em}.empty span{display:block;color:#7f8b87;font-size:10px;line-height:1.6;margin:8px 0 18px}.empty a{display:inline-block;padding:12px 14px;border-radius:12px;background:#7fe0bb;color:#06100c;text-decoration:none;font-size:8px;font-weight:950;letter-spacing:.1em}@media(max-width:620px){.page{padding:16px 14px 76px}.hero{margin-top:55px}.hero h1{font-size:56px}.sync{display:grid}.sync button{justify-self:start}.grid{grid-template-columns:1fr}.facts{grid-template-columns:1fr 1fr}.actions{grid-template-columns:1fr 1fr}.actions a{grid-column:1/-1}}
    `}</style>
  </main>;
}
