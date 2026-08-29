'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import MeshyModelViewer from '../../vault/earth/MeshyModelViewer';
import { getSupabaseBrowserAsync } from '../../../lib/supabase-browser';
import { readPropertyDrafts } from '../../../lib/property-drafts';
import { connectVoxelFlipWallet, mintVoxelFlip } from '../../../lib/voxelflip';
import styles from '../PropertyStudio.module.css';

function clean(value) { return String(value || '').trim(); }
function short(value) {
  const text = clean(value);
  return text ? `${text.slice(0, 7)}…${text.slice(-5)}` : '';
}
function errorText(error) {
  return String(error?.reason || error?.shortMessage || error?.message || error || 'Minting failed.');
}
function storageKey(draftId, taskId) { return `voxelpop:property-mint:${draftId}:${taskId}`; }

function Topbar() {
  return <header className={styles.topbar}>
    <Link className={styles.brand} href="/">
      <span className={styles.brandMark}>V</span>
      <span>VOXEL VAULT</span>
    </Link>
    <nav className={styles.nav} aria-label="Voxel Vault navigation">
      <Link href="/property">Create</Link>
      <Link href="/vault/property-drafts">Inventory</Link>
    </nav>
  </header>;
}

function Progress({ complete = false }) {
  const items = [
    ['✓', 'PHOTO', 'Done'],
    ['✓', 'ADDRESS', 'Confirmed'],
    ['✓', 'VOXEL', 'Built'],
    [complete ? '✓' : '4', 'MINT', complete ? 'Complete' : 'Optional'],
    ['5', 'VAULT', 'Inventory'],
  ];
  return <div className={styles.progressWrap}><div className={styles.progress}>
    {items.map(([number, label, detail], index) => {
      const isDone = index < 3 || (complete && index === 3);
      const isCurrent = !complete && index === 3;
      const className = isDone
        ? `${styles.progressItem} ${styles.progressDone}`
        : isCurrent
          ? `${styles.progressItem} ${styles.progressCurrent}`
          : styles.progressItem;
      return <div className={className} key={label}>
        <span>{number}</span><div><b>{label}</b><small>{detail}</small></div>
      </div>;
    })}
  </div></div>;
}

export default function PropertyVoxelMintPage() {
  const [authReady, setAuthReady] = useState(false);
  const [session, setSession] = useState(null);
  const [params, setParams] = useState({ draftId: '', taskId: '', name: 'Voxel Property', modelUrl: '' });
  const [wallet, setWallet] = useState('');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('Opening your finished voxel…');
  const [minted, setMinted] = useState(null);
  const clientRef = useRef(null);

  const modelUrl = useMemo(() => clean(params.modelUrl), [params.modelUrl]);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const draftId = clean(query.get('draftId'));
    const taskId = clean(query.get('taskId'));
    let resolvedModelUrl = clean(query.get('modelUrl'));
    let resolvedName = clean(query.get('name')) || 'Voxel Property';

    if ((!resolvedModelUrl || resolvedName === 'Voxel Property') && draftId && taskId) {
      try {
        const found = readPropertyDrafts().find((draft) => {
          const savedDraftId = clean(draft?.voxelpop?.creationDraftId);
          const savedTaskId = clean(draft?.visual?.modelTaskId || draft?.voxelpop?.modelTaskId);
          return savedDraftId === draftId && savedTaskId === taskId;
        });
        if (found) {
          resolvedModelUrl = resolvedModelUrl || clean(found?.visual?.modelUrl || found?.voxelpop?.modelUrl);
          resolvedName = clean(found?.label) || resolvedName;
        }
      } catch {}
    }

    const next = { draftId, taskId, name: resolvedName, modelUrl: resolvedModelUrl };
    setParams(next);
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey(next.draftId, next.taskId)) || 'null');
      if (saved?.verified && saved?.tokenId) {
        setMinted(saved);
        setWallet(saved.owner || '');
        setMessage(`Voxel #${saved.tokenId} is already verified for this collectible.`);
      } else {
        setMessage('Your finished voxel is ready. Minting is optional.');
      }
    } catch {
      setMessage('Your finished voxel is ready. Minting is optional.');
    }
  }, []);

  useEffect(() => {
    let active = true;
    let subscription = null;
    getSupabaseBrowserAsync().then(async (client) => {
      if (!active) return;
      clientRef.current = client;
      const { data } = await client.auth.getSession();
      if (!active) return;
      setSession(data.session || null);
      setAuthReady(true);
      const auth = client.auth.onAuthStateChange((_event, next) => {
        if (!active) return;
        setSession(next || null);
        setAuthReady(true);
      });
      subscription = auth.data.subscription;
    }).catch(() => {
      if (active) {
        setAuthReady(true);
        setMessage('Sign-in setup is unavailable on this deployment.');
      }
    });
    return () => { active = false; subscription?.unsubscribe?.(); };
  }, []);

  async function signIn() {
    setBusy('signin');
    try {
      const client = clientRef.current || await getSupabaseBrowserAsync();
      clientRef.current = client;
      const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.href } });
      if (error) throw error;
    } catch (error) {
      setBusy('');
      setMessage(errorText(error));
    }
  }

  async function mint() {
    if (!session?.access_token || !params.draftId || !params.taskId || !modelUrl || busy || minted) return;
    let connected = null;
    setBusy('wallet');
    setMessage('Connect the wallet that should own this digital voxel. Nothing is sent yet.');
    try {
      connected = await connectVoxelFlipWallet();
      setWallet(connected.address);
      setBusy('prepare');
      setMessage('Preparing the one-time mint for this finished voxel…');
      const response = await fetch('/api/property-voxel-nft/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ draftId: params.draftId, taskId: params.taskId, wallet: connected.address, name: params.name }),
      });
      const prepared = await response.json().catch(() => ({}));
      if (!response.ok || !prepared?.ready || !prepared?.signature) throw new Error(prepared?.error || 'This finished voxel could not be prepared for minting.');

      setBusy('mint');
      setMessage('Confirm the one-of-one mint in your wallet.');
      const result = await mintVoxelFlip({ metadataUrl: prepared.metadataUrl, voucherId: prepared.voucherId, signature: prepared.signature });
      if (!result?.tokenId || !result?.hash) throw new Error('The wallet transaction completed, but the token ID could not be read.');

      setBusy('verify');
      setMessage(`Voxel #${result.tokenId} was submitted. Verifying it…`);
      const confirm = await fetch('/api/property-voxel-nft/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          draftId: params.draftId,
          taskId: params.taskId,
          name: params.name,
          wallet: result.owner || connected.address,
          tokenId: result.tokenId,
          txHash: result.hash,
        }),
      });
      const verified = await confirm.json().catch(() => ({}));
      if (!confirm.ok || !verified?.verified) throw new Error(verified?.error || `Voxel #${result.tokenId} was submitted, but verification is not complete. Do not mint it again.`);
      const finalResult = { ...result, ...verified, verified: true };
      setMinted(finalResult);
      setWallet(finalResult.owner || connected.address);
      try { localStorage.setItem(storageKey(params.draftId, params.taskId), JSON.stringify(finalResult)); } catch {}
      setMessage(`Done. Voxel #${finalResult.tokenId} is verified and owned by ${short(finalResult.owner)}.`);
    } catch (error) {
      if (error?.code === 'NO_WALLET_PROVIDER' && error?.deepLink) {
        window.location.href = error.deepLink;
        return;
      }
      setMessage(errorText(error));
    } finally {
      setBusy('');
    }
  }

  const invalid = !params.draftId || !params.taskId || !modelUrl;

  if (!authReady) return <main className={styles.page}><section className={styles.shell}><Topbar/><div className={styles.signInCard}><div className={styles.signInVoxel} aria-hidden="true"/><p className={styles.eyebrow}>MINT STUDIO</p><h1>Opening your voxel…</h1></div></section></main>;

  return <main className={styles.page}><section className={styles.shell}>
    <Topbar/>
    <Progress complete={Boolean(minted)}/>

    {invalid ? <div className={styles.emptyCard}>
      <div className={styles.signInVoxel} aria-hidden="true"/>
      <p className={styles.eyebrow}>MINT STUDIO</p>
      <h2>Open Mint from a saved voxel.</h2>
      <p>The model link is missing from this mint request. Open the collectible from Inventory and choose Mint again.</p>
      <Link className={styles.primary} href="/vault/property-drafts">Open Inventory</Link>
    </div> : <>
      <header className={styles.mintHeader}>
        <p className={styles.eyebrow}>{minted ? 'MINT COMPLETE' : 'OPTIONAL MINT'}</p>
        <h1>{minted ? 'Your voxel is on-chain.' : 'Mint the one-of-one.'}</h1>
        <p>{minted ? 'The digital collectible is verified and remains visible in your Voxel Vault Inventory.' : 'Your voxel is already safe in Inventory. Minting simply gives this digital collectible an on-chain owner.'}</p>
      </header>

      <section className={`${styles.mintCard} ${styles.mintLayout}`}>
        <div className={styles.mintViewer}><div className={styles.viewerShell}><MeshyModelViewer modelUrl={modelUrl}/><span className={styles.viewerBadge}>{minted ? `MINTED #${minted.tokenId}` : 'YOUR 3D VOXEL'}</span></div></div>
        <div className={styles.mintPanel}>
          {minted ? <>
            <div className={styles.successMark}>✓</div>
            <p className={styles.eyebrow}>VERIFIED COLLECTIBLE</p>
            <h2>Voxel #{minted.tokenId}</h2>
            <p>Owned by {short(minted.owner)}. You can keep it in Inventory or open the public transaction details.</p>
            <div className={styles.successBox}><b>Mint complete</b><span>{params.name}</span><div className={styles.successLinks}>{minted.openSeaUrl ? <a href={minted.openSeaUrl} target="_blank" rel="noreferrer">OpenSea ↗</a> : null}{minted.explorerUrl ? <a href={minted.explorerUrl} target="_blank" rel="noreferrer">Transaction ↗</a> : null}</div></div>
            <div className={styles.mintActions}><Link className={styles.primary} href="/vault/property-drafts">Back to Inventory</Link><Link className={styles.secondary} href="/property">Create another property</Link></div>
          </> : <>
            <p className={styles.eyebrow}>READY TO MINT</p>
            <h2>{params.name}</h2>
            <p>One property can have one Voxel Vault mint. You will connect a wallet only after you choose to mint.</p>
            <div className={styles.mintActions}>
              {!session?.user
                ? <button className={styles.primary} type="button" onClick={signIn} disabled={busy === 'signin'}>{busy === 'signin' ? 'Opening Google…' : 'Sign in to mint'}</button>
                : <button className={styles.primary} type="button" onClick={mint} disabled={Boolean(busy)}>{busy === 'wallet' ? 'Connecting…' : busy === 'prepare' ? 'Preparing mint…' : busy === 'mint' ? 'Confirm in wallet…' : busy === 'verify' ? 'Verifying…' : 'Mint this voxel'}</button>}
              <Link className={styles.secondary} href="/vault/property-drafts">Keep in Inventory</Link>
            </div>
            {wallet ? <p className={styles.walletLine}>Connected wallet · {short(wallet)}</p> : null}
          </>}
        </div>
      </section>
      <p className={styles.status} role="status">{message}</p>
      <p className={styles.truth}>The NFT represents the digital voxel only. It is not the deed, title, equity, rent, occupancy, investment rights, or ownership of the physical property.</p>
    </>}
  </section></main>;
}
