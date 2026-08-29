'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { getSupabaseBrowserAsync } from '../../../lib/supabase-browser';
import {
  deletePropertyDraft,
  exportPropertyDraft,
  readPropertyDrafts,
  setPropertyDraftWorldVisibility,
} from '../../../lib/property-drafts';
import {
  deletePropertyDraftFromAccount,
  savePropertyDraftToAccount,
  syncLocalPropertyDraftsToAccount,
} from '../../../lib/property-drafts-account';
import styles from '../../property/PropertyStudio.module.css';

function clean(value) { return String(value || '').trim(); }
function dollars(cents) {
  if (!Number(cents)) return '';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(cents) / 100);
}
function directMintHref(draft) {
  const draftId = clean(draft?.voxelpop?.creationDraftId);
  const taskId = clean(draft?.visual?.modelTaskId || draft?.voxelpop?.modelTaskId);
  const modelUrl = clean(draft?.visual?.modelUrl || draft?.voxelpop?.modelUrl);
  if (!draftId || !taskId || !modelUrl) return '';
  const name = clean(draft?.label) || 'Voxel Property';
  return `/property/mint?draftId=${encodeURIComponent(draftId)}&taskId=${encodeURIComponent(taskId)}&name=${encodeURIComponent(name)}&modelUrl=${encodeURIComponent(modelUrl)}`;
}

function Topbar() {
  return <header className={styles.topbar}>
    <Link className={styles.brand} href="/">
      <span className={styles.brandMark}>V</span>
      <span>VOXEL VAULT</span>
    </Link>
    <nav className={styles.nav} aria-label="Voxel Vault navigation">
      <Link href="/property">Create</Link>
      <Link href="/world">World</Link>
    </nav>
  </header>;
}

export default function PropertyDraftsPage() {
  const [drafts, setDrafts] = useState([]);
  const [session, setSession] = useState(null);
  const [note, setNote] = useState('Every finished property voxel lives here. Minting stays optional.');
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
      if (!nextSession?.user) { refresh(); return; }
      try {
        const merged = await syncLocalPropertyDraftsToAccount(client, nextSession.user);
        if (active) setDrafts(merged);
      } catch (error) {
        if (active) setNote(String(error?.message || error || 'Account sync is unavailable. Local Inventory still works.'));
      }
    }
    getSupabaseBrowserAsync().then(async (client) => {
      clientRef.current = client;
      const { data } = await client.auth.getSession();
      await apply(client, data.session || null);
      const auth = client.auth.onAuthStateChange((_event, next) => apply(client, next));
      subscription = auth.data.subscription;
    }).catch(() => {});
    return () => { active = false; subscription?.unsubscribe?.(); };
  }, []);

  async function signIn() {
    try {
      const client = clientRef.current || await getSupabaseBrowserAsync();
      clientRef.current = client;
      const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: new URL('/vault/property-drafts', window.location.origin).toString() } });
      if (error) throw error;
    } catch (error) {
      setNote(String(error?.message || error || 'Could not sign in.'));
    }
  }

  async function toggleWorld(draft) {
    if (!session?.user) {
      setNote('Sign in to share this voxel on Public World.');
      await signIn();
      return;
    }
    setBusy(draft.id);
    try {
      const next = setPropertyDraftWorldVisibility(draft.id, draft?.world?.public !== true);
      const client = clientRef.current || await getSupabaseBrowserAsync();
      clientRef.current = client;
      await savePropertyDraftToAccount(client, session.user, next);
      refresh();
      setNote(next.world?.public ? 'This voxel is now visible on Public World.' : 'This voxel is private in your Inventory.');
    } catch (error) {
      setNote(String(error?.message || error));
    } finally {
      setBusy('');
    }
  }

  async function remove(id) {
    deletePropertyDraft(id);
    refresh();
    if (!session?.user) return;
    try {
      const client = clientRef.current || await getSupabaseBrowserAsync();
      await deletePropertyDraftFromAccount(client, session.user, id);
    } catch (error) {
      setNote(`Removed here. Account cleanup needs attention: ${String(error?.message || error)}`);
    }
  }

  return <main className={styles.inventoryPage}><section className={styles.inventoryShell}>
    <Topbar/>

    <header className={styles.inventoryHero}>
      <p className={styles.eyebrow}>YOUR INVENTORY</p>
      <h1>Your property collection.</h1>
      <p>{note}</p>
      <div className={styles.heroActions}>
        <Link className={styles.createButton} href="/property">+ Create a voxel</Link>
        {!session?.user ? <button className={styles.secondary} type="button" onClick={signIn}>Sync with Google</button> : <Link className={styles.secondary} href="/world">View Public World</Link>}
      </div>
    </header>

    {drafts.length ? <section className={styles.inventoryGrid}>{drafts.map((draft) => {
      const collected = draft?.commerce?.kind === 'property_voxel_collectible' && draft?.commerce?.status === 'paid';
      const preview = clean(draft?.visual?.thumbnailUrl);
      const mintHref = directMintHref(draft);
      const minted = draft?.blockchain?.minted === true;
      const status = collected ? 'COLLECTED' : minted ? 'MINTED' : draft?.world?.public ? 'PUBLIC' : 'IN VAULT';
      return <article className={styles.inventoryCard} key={draft.id}>
        <div className={styles.inventoryVisual}>
          {preview ? <img src={preview} alt={draft.label || 'Voxel property preview'}/> : <div className={styles.inventoryVoxel} aria-hidden="true"/>}
          <span className={styles.cardBadge}>{status}</span>
        </div>
        <div className={styles.inventoryBody}>
          <small>{minted ? 'MINTED PROPERTY VOXEL' : 'SAVED PROPERTY VOXEL'}</small>
          <h2>{draft.label || 'Saved Voxel Property'}</h2>
          <p className={styles.inventoryMeta}>{minted ? 'On-chain collectible · saved in your Voxel Vault' : mintHref ? 'Finished 3D collectible · mint whenever you want' : 'Saved digital property collectible'}</p>
          {collected ? <div className={styles.paidRow}><b>{draft.commerce?.priceLabel || 'Digital voxel'}</b><strong>{dollars(draft.commerce?.priceCents)}</strong></div> : null}
          <div className={styles.cardActions}>
            <Link href={`/vault/property-drafts/${encodeURIComponent(draft.id)}`}>OPEN 3D</Link>
            <button className={draft.world?.public ? styles.publicAction : ''} type="button" onClick={() => toggleWorld(draft)} disabled={busy === draft.id}>{draft.world?.public ? 'PUBLIC' : 'SHARE'}</button>
            {mintHref ? <Link className={styles.mintCardAction} href={mintHref}>{minted ? 'VIEW MINT' : 'MINT · OPTIONAL'}</Link> : <Link className={styles.mintCardAction} href="/vault/properties/claim">VERIFY + MINT</Link>}
          </div>
          <div className={styles.cardMore}><button type="button" onClick={() => exportPropertyDraft(draft)}>Export</button><button type="button" onClick={() => remove(draft.id)}>Remove</button></div>
        </div>
      </article>;
    })}</section> : <section className={styles.emptyCard}>
      <div className={styles.signInVoxel} aria-hidden="true"/>
      <p className={styles.eyebrow}>EMPTY VAULT</p>
      <h2>Your first property can start now.</h2>
      <p>Choose a photo, confirm its address, build the 3D voxel, then keep it here or mint it.</p>
      <Link className={styles.primary} href="/property">Create first voxel</Link>
    </section>}

    <p className={styles.truth}>Inventory stores your saved digital property voxels. Saving, sharing, or minting a voxel does not transfer deed, title, rent, equity, occupancy, or other rights in the physical property.</p>
  </section></main>;
}
