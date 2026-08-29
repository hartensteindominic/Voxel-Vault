'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import MeshyModelViewer from '../../vault/earth/MeshyModelViewer';
import { connectVoxelFlipWallet, mintVoxelFlip } from '../../../lib/voxelflip';
import { getSupabaseBrowserAsync } from '../../../lib/supabase-browser';
import { readPropertyDraft, savePropertyDraft } from '../../../lib/property-drafts';
import { savePropertyDraftToAccount } from '../../../lib/property-drafts-account';

function clean(value) { return String(value || '').trim(); }
function short(value) {
  const text = clean(value);
  return text.length > 15 ? `${text.slice(0, 7)}…${text.slice(-5)}` : text;
}
function pendingKey(creationId) { return `voxelpop-property-mint:${creationId}`; }

export default function PropertyVoxelMintPage() {
  const [authReady, setAuthReady] = useState(false);
  const [session, setSession] = useState(null);
  const [savedId, setSavedId] = useState('');
  const [creationId, setCreationId] = useState('');
  const [taskId, setTaskId] = useState('');
  const [generationSessionId, setGenerationSessionId] = useState('');
  const [draft, setDraft] = useState(null);
  const [wallet, setWallet] = useState('');
  const [pending, setPending] = useState(null);
  const [minted, setMinted] = useState(null);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('Opening your finished voxel…');
  const [walletLink, setWalletLink] = useState('');
  const clientRef = useRef(null);

  const modelUrl = useMemo(() => draft?.visual?.modelUrl || (taskId ? `/api/property-local-voxel?taskId=${encodeURIComponent(taskId)}` : ''), [draft, taskId]);
  const ready = Boolean(session?.access_token && creationId && taskId.startsWith('local-v1:') && generationSessionId);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const selectedSavedId = clean(params.get('saved'));
    const localDraft = selectedSavedId ? readPropertyDraft(selectedSavedId) : null;
    const nextCreation = clean(params.get('creation')) || clean(localDraft?.voxelpop?.creationDraftId);
    const nextTask = clean(params.get('task')) || clean(localDraft?.voxelpop?.modelTaskId) || clean(localDraft?.visual?.modelTaskId);
    const nextPayment = clean(params.get('generation_session')) || clean(localDraft?.voxelpop?.paymentSessionId);
    setSavedId(selectedSavedId);
    setDraft(localDraft);
    setCreationId(nextCreation);
    setTaskId(nextTask);
    setGenerationSessionId(nextPayment);
    if (nextCreation) {
      try {
        const stored = JSON.parse(window.localStorage.getItem(pendingKey(nextCreation)) || 'null');
        if (stored?.txHash || stored?.existingMint) {
          setPending(stored);
          setMessage('A previous mint attempt is saved on this device. Resume verification before trying anything else.');
        } else setMessage('Ready to mint this finished digital voxel if you choose.');
      } catch { setMessage('Ready to mint this finished digital voxel if you choose.'); }
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
      setMessage(String(error?.message || error || 'Could not sign in.'));
      setBusy('');
    }
  }

  async function saveMintResult(result) {
    if (!savedId || !result?.tokenId) return;
    const current = readPropertyDraft(savedId) || draft;
    if (!current) return;
    const next = savePropertyDraft({
      ...current,
      blockchain: {
        ...(current.blockchain || {}),
        minted: true,
        optional: true,
        network: 'base',
        tokenId: String(result.tokenId),
        owner: result.wallet || result.owner || null,
        contractAddress: result.contractAddress || null,
        txHash: result.txHash || result.hash || null,
        metadataUrl: result.metadataUrl || null,
        openSeaUrl: result.openSeaUrl || null,
        explorerUrl: result.explorerUrl || null,
        mintedAt: new Date().toISOString(),
        digitalVoxelOnly: true,
      },
    });
    setDraft(next);
    try {
      const client = clientRef.current || await getSupabaseBrowserAsync();
      if (session?.user) await savePropertyDraftToAccount(client, session.user, next);
    } catch {}
  }

  async function confirmMint(submission) {
    const tokenId = clean(submission?.tokenId);
    const txHash = clean(submission?.txHash || submission?.hash);
    const mintWallet = clean(submission?.wallet || submission?.owner || wallet);
    const metadataUrl = clean(submission?.metadataUrl);
    if (!tokenId || !txHash || !mintWallet || !metadataUrl) throw new Error('The saved mint needs recovery from Base before it can be confirmed.');
    setBusy('confirm');
    setMessage('Confirming the NFT on Base…');
    const response = await fetch('/api/property-nft/confirm', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session?.access_token || ''}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ generationSessionId, draftId: creationId, taskId, tokenId, txHash, wallet: mintWallet, metadataUrl }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.confirmed) throw new Error(data?.error || 'Base has not confirmed this mint yet.');
    const result = { ...submission, ...data };
    await saveMintResult(result);
    setMinted(result);
    setPending(null);
    try { window.localStorage.removeItem(pendingKey(creationId)); } catch {}
    setMessage('Mint confirmed. This digital voxel NFT is now in your wallet.');
    setBusy('');
    return result;
  }

  async function prepareForWallet(address) {
    const response = await fetch('/api/property-nft/prepare', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session?.access_token || ''}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ generationSessionId, draftId: creationId, taskId, wallet: address }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.ready) throw new Error(data?.error || 'This voxel could not be prepared for minting.');
    return data;
  }

  async function startOrRecoverMint() {
    if (!ready) return setMessage('Open this mint step from a completed paid property creation.');
    setBusy('wallet');
    setWalletLink('');
    setMessage(pending ? 'Checking Base for your previous mint before doing anything else…' : 'Connecting your wallet…');
    try {
      const connection = await connectVoxelFlipWallet();
      setWallet(connection.address);
      setBusy('prepare');
      setMessage('Verifying your $4.99 creation and finished voxel…');
      const prepared = await prepareForWallet(connection.address);

      if (prepared.existingMint) {
        const recovered = {
          ...prepared.existingMint,
          wallet: connection.address,
          metadataUrl: prepared.existingMint.metadataUrl || prepared.metadataUrl,
          contractAddress: prepared.contractAddress,
          existingMint: true,
        };
        setPending(recovered);
        try { window.localStorage.setItem(pendingKey(creationId), JSON.stringify(recovered)); } catch {}
        await confirmMint(recovered);
        return;
      }

      if (!prepared.signature || !prepared.voucherId || !prepared.metadataUrl) throw new Error('The secure mint voucher is incomplete.');
      setBusy('mint');
      setMessage('Review the wallet transaction. Minting uses the Base network and may require network gas.');
      const result = await mintVoxelFlip({ metadataUrl: prepared.metadataUrl, voucherId: prepared.voucherId, signature: prepared.signature });
      const submission = {
        ...result,
        wallet: result.owner || connection.address,
        metadataUrl: prepared.metadataUrl,
        contractAddress: prepared.contractAddress,
      };
      setPending(submission);
      try { window.localStorage.setItem(pendingKey(creationId), JSON.stringify(submission)); } catch {}
      await confirmMint(submission);
    } catch (error) {
      setBusy('');
      if (error?.deepLink) setWalletLink(error.deepLink);
      setMessage(String(error?.message || error || 'Minting could not continue.'));
    }
  }

  async function resumeVerification() {
    if (!pending) return startOrRecoverMint();
    try {
      await confirmMint(pending);
    } catch (error) {
      setBusy('');
      setMessage(`${String(error?.message || error)} If the transaction was submitted, use Recover from Base instead of minting again.`);
    }
  }

  if (!authReady) return <main className="page"><section className="card"><div className="mark">V</div><h1>Opening mint…</h1><p>{message}</p></section><style jsx>{pageStyles}</style></main>;
  if (!session?.user) return <main className="page"><section className="card"><div className="mark">V</div><small>VOXELPOP · DIGITAL NFT</small><h1>Sign in first.</h1><p>Use the same Voxel Vault account that paid for and created this voxel.</p><button className="primary" onClick={signIn} disabled={busy === 'signin'}>{busy === 'signin' ? 'Opening sign-in…' : 'Continue with Google'}</button><p className="status">{message}</p></section><style jsx>{pageStyles}</style></main>;

  return <main className="page">
    <section className="card">
      <Link className="back" href="/property">← PROPERTY</Link>
      <div className="mark">{minted ? '✓' : 'V'}</div>
      <small>VOXELPOP · VOXELFLIP</small>
      <h1>{minted ? 'Minted.' : 'Mint your digital voxel.'}</h1>
      <p>This is the optional blockchain step after your 3D picture, movable voxel, and My World save.</p>

      {modelUrl ? <div className="viewer"><MeshyModelViewer modelUrl={modelUrl}/><span>YOUR FINISHED VOXEL</span></div> : <div className="missing"><b>Finished voxel link missing.</b><span>Return to the creation and reconnect the voxel before minting.</span></div>}

      <div className="facts">
        <div><small>CREATION</small><b>$4.99 VERIFIED</b></div>
        <div><small>NFT NETWORK</small><b>BASE</b></div>
        <div><small>PROPERTY RIGHTS</small><b>NONE</b></div>
      </div>

      {minted ? <section className="success">
        <b>VoxelFlip #{minted.tokenId}</b>
        <span>Owner {short(minted.wallet || minted.owner)}</span>
        {minted.openSeaUrl ? <a href={minted.openSeaUrl} target="_blank" rel="noreferrer">View on OpenSea ↗</a> : null}
        {minted.explorerUrl ? <a href={minted.explorerUrl} target="_blank" rel="noreferrer">View Base transaction ↗</a> : null}
        <Link href="/vault/property-drafts">Open My Vault</Link>
      </section> : <section className="actions">
        {pending ? <>
          <button className="primary" onClick={resumeVerification} disabled={Boolean(busy)}>{busy === 'confirm' ? 'Checking Base…' : 'Resume mint verification'}</button>
          <button className="secondary" onClick={startOrRecoverMint} disabled={Boolean(busy)}>Recover from Base</button>
        </> : <button className="primary" onClick={startOrRecoverMint} disabled={!ready || !modelUrl || Boolean(busy)}>{busy ? 'Working…' : 'Connect wallet → Mint NFT'}</button>}
        {walletLink ? <a className="wallet" href={walletLink}>Open in MetaMask</a> : null}
        <Link className="skip" href="/world">Skip minting · View My World</Link>
      </section>}

      <p className="status" role="status">{message}</p>
      <p className="truth"><b>Important:</b> this mints the digital VoxelPop voxel only. The NFT is not a deed, title record, fractional real-estate interest, rental right, occupancy right, appraisal, or proof that you own the physical house. Minting is public on-chain and wallet gas may apply.</p>
    </section>
    <style jsx>{pageStyles}</style>
  </main>;
}

const pageStyles = `
:global(body){margin:0;background:#fffaf0;color:#24170e;font-family:Inter,ui-rounded,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.page{min-height:100vh;padding:20px 12px calc(46px + env(safe-area-inset-bottom));background:radial-gradient(circle at 8% 10%,#fff0ca,transparent 27%),radial-gradient(circle at 92% 8%,#eee5ff,transparent 28%),radial-gradient(circle at 50% 95%,#efffc8,transparent 25%),#fffaf0}.card{width:min(650px,100%);margin:0 auto;text-align:center}.back{display:block;width:max-content;margin:0 0 20px;color:#6d52bd;text-decoration:none;font-size:9px;font-weight:950;letter-spacing:.1em}.mark{width:68px;height:68px;margin:0 auto 20px;display:grid;place-items:center;border-radius:22px;background:#c9ff54;color:#334d07;font-size:30px;font-weight:1000;box-shadow:0 8px 0 #a9dc39}.card>small{color:#7138f5;font-size:9px;font-weight:1000;letter-spacing:.15em}.card h1{margin:12px 0 10px;font-size:clamp(43px,10vw,68px);line-height:.9;letter-spacing:-.06em}.card>p{max-width:530px;margin:10px auto;color:#7d7168;font-size:12px;line-height:1.55}.viewer{position:relative;height:430px;margin:24px 0 14px;overflow:hidden;border-radius:34px;background:#21172c;box-shadow:0 22px 54px rgba(67,42,23,.16)}.viewer>div{height:100%!important;min-height:100%!important}.viewer :global(.viewerShell){position:absolute!important;inset:0!important;min-height:100%!important;border-radius:0!important}.viewer>span{position:absolute;z-index:7;left:15px;top:15px;padding:8px 11px;border-radius:999px;background:#c9ff54;color:#273d04;font-size:8px;font-weight:1000;letter-spacing:.09em}.missing{margin:24px 0;padding:28px;border:1px dashed #d9ccff;border-radius:28px;background:#fff;display:grid;gap:7px}.missing span{color:#8a7e86;font-size:11px}.facts{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:0 0 14px}.facts div{padding:13px 9px;border:1px solid #e6ddd2;border-radius:17px;background:#ffffffdd}.facts small{display:block;color:#95887e;font-size:6px;font-weight:1000;letter-spacing:.09em}.facts b{display:block;margin-top:5px;font-size:9px}.actions,.success{display:grid;gap:11px;padding:18px;border:1px solid #e6dce9;border-radius:28px;background:#ffffffdc;box-shadow:0 18px 46px rgba(80,50,25,.08)}.actions button,.actions a,.success a{min-height:58px;border:0;border-radius:19px;display:grid;place-items:center;text-decoration:none;font:1000 15px inherit;cursor:pointer}.primary{background:linear-gradient(180deg,#7d42ff,#6630e9);color:#fff;box-shadow:0 8px 0 #4d1bc5}.secondary{background:#c9ff54;color:#2e4705;box-shadow:0 7px 0 #a6d936}.wallet{background:#171221;color:#fff}.skip{color:#715e80;background:#fff;border:1px solid #e5ddeb!important;box-shadow:none}.actions button:disabled{opacity:.5;box-shadow:none}.success b{font-size:24px}.success span{color:#817480;font-size:11px}.success a{background:#f3ffe1;color:#4c6428;border:1px solid #d7efa9}.status{min-height:18px!important;margin-top:16px!important;font-weight:800}.truth{font-size:8.5px!important;color:#9b9189!important;margin-top:17px!important}.truth b{color:#746a62}@media(max-width:520px){.page{padding:12px 10px calc(38px + env(safe-area-inset-bottom))}.card h1{font-size:50px}.viewer{height:390px;border-radius:29px}.facts{grid-template-columns:1fr}.actions,.success{border-radius:24px;padding:15px}.actions button,.actions a,.success a{min-height:56px;font-size:14px}}
`;
