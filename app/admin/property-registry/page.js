'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BrowserProvider, Contract, getAddress } from 'ethers';
import { getSupabaseBrowserAsync } from '../../../lib/supabase-browser';
import { discoverMetaMaskProvider, getMetaMaskDeepLink } from '../../../lib/wallet-connect';

const CHAIN_ID = '0x14a34';
const RPC_URL = 'https://sepolia.base.org';
const EXPLORER = 'https://sepolia.basescan.org';
const ABI = [
  'function registerIdentity(bytes32 propertyId, bytes32 claimHash, bytes32 sourceHash, string metadataURI)',
  'function setVerified(bytes32 propertyId, bool verified)',
];

function googleReturnUrl() {
  return new URL('/admin/property-registry?auth=google', window.location.origin).toString();
}

function errorText(error) {
  return String(error?.shortMessage || error?.reason || error?.message || error || 'Action failed.');
}

function short(value) {
  const text = String(value || '');
  return text ? `${text.slice(0, 8)}…${text.slice(-6)}` : '—';
}

async function ensureBaseSepolia(injected) {
  let chainId = String(await injected.request({ method: 'eth_chainId' }) || '').toLowerCase();
  if (chainId === CHAIN_ID) return;
  try {
    await injected.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CHAIN_ID }] });
  } catch (error) {
    if (error?.code === 4001) throw new Error('Base Sepolia network switch was cancelled.');
    if (error?.code !== 4902) throw error;
    await injected.request({
      method: 'wallet_addEthereumChain',
      params: [{
        chainId: CHAIN_ID,
        chainName: 'Base Sepolia',
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        rpcUrls: [RPC_URL],
        blockExplorerUrls: [EXPLORER],
      }],
    });
  }
  chainId = String(await injected.request({ method: 'eth_chainId' }) || '').toLowerCase();
  if (chainId !== CHAIN_ID) throw new Error('Switch MetaMask to Base Sepolia before continuing.');
}

export default function PropertyRegistryAdminPage() {
  const [session, setSession] = useState(null);
  const [authState, setAuthState] = useState('loading');
  const [candidates, setCandidates] = useState([]);
  const [selected, setSelected] = useState('');
  const [prepared, setPrepared] = useState(null);
  const [provider, setProvider] = useState(null);
  const [wallet, setWallet] = useState('');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [recoveryTx, setRecoveryTx] = useState('');
  const clientRef = useRef(null);

  const current = useMemo(() => candidates.find((item) => item.claimId === selected) || null, [candidates, selected]);

  async function loadList(accessToken) {
    const token = String(accessToken || '').trim();
    if (!token) return;
    setBusy('list');
    try {
      const response = await fetch('/api/admin/property-registry', { cache: 'no-store', headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok === false) throw new Error(data?.error || 'Could not load verified property claims.');
      const items = Array.isArray(data.candidates) ? data.candidates : [];
      setCandidates(items);
      const next = selected && items.some((item) => item.claimId === selected) ? selected : items[0]?.claimId || '';
      setSelected(next);
      setMessage('');
      if (next) await prepareClaim(next, token);
      else setPrepared(null);
    } catch (error) {
      setCandidates([]);
      setPrepared(null);
      setMessage(errorText(error));
    } finally {
      setBusy('');
    }
  }

  async function prepareClaim(claimId, accessToken = session?.access_token) {
    const token = String(accessToken || '').trim();
    if (!token || !claimId) return;
    setBusy('prepare');
    setRecoveryTx('');
    try {
      const response = await fetch(`/api/admin/property-registry?claimId=${encodeURIComponent(claimId)}`, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok && !['registration-unreconciled', 'verification-unreconciled'].includes(data?.stage)) {
        throw new Error(data?.error || 'Could not prepare this property for registry anchoring.');
      }
      setPrepared(data);
      setMessage(data?.error || '');
    } catch (error) {
      setPrepared(null);
      setMessage(errorText(error));
    } finally {
      setBusy('');
    }
  }

  useEffect(() => {
    let active = true;
    let subscription = null;
    async function apply(next) {
      if (!active) return;
      setSession(next);
      if (!next?.user) {
        setAuthState('signed-out');
        setCandidates([]);
        setPrepared(null);
        return;
      }
      setAuthState('signed-in');
      await loadList(next.access_token || '');
      if (new URLSearchParams(window.location.search).get('auth') === 'google') {
        window.history.replaceState({}, '', '/admin/property-registry');
      }
    }
    getSupabaseBrowserAsync().then(async (client) => {
      if (!active) return;
      clientRef.current = client;
      const { data, error } = await client.auth.getSession();
      if (error) {
        setAuthState('error');
        setMessage(error.message);
      } else {
        await apply(data.session);
      }
      const auth = client.auth.onAuthStateChange((_event, next) => { apply(next); });
      subscription = auth.data.subscription;
    }).catch((error) => {
      if (!active) return;
      setAuthState('error');
      setMessage(errorText(error));
    });
    return () => { active = false; subscription?.unsubscribe?.(); };
  }, []);

  async function signIn() {
    setBusy('signin');
    setMessage('');
    try {
      const client = clientRef.current || await getSupabaseBrowserAsync();
      clientRef.current = client;
      const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: googleReturnUrl() } });
      if (error) throw error;
    } catch (error) {
      setBusy('');
      setMessage(errorText(error));
    }
  }

  async function connectWallet() {
    if (!prepared?.requiredOwner) throw new Error('Load a registry-ready property first.');
    setBusy('wallet');
    setMessage('');
    try {
      const injected = await discoverMetaMaskProvider();
      if (!injected) {
        window.location.href = getMetaMaskDeepLink(window.location.href);
        return;
      }
      const accounts = await injected.request({ method: 'eth_requestAccounts' });
      if (!accounts?.[0]) throw new Error('Wallet connection was cancelled.');
      await ensureBaseSepolia(injected);
      const address = getAddress(accounts[0]);
      if (address !== getAddress(prepared.requiredOwner)) {
        throw new Error(`Connect the registry owner wallet ${short(prepared.requiredOwner)}.`);
      }
      setProvider(injected);
      setWallet(address);
      setMessage('Registry owner wallet verified on Base Sepolia. Nothing has been signed yet.');
    } catch (error) {
      setMessage(errorText(error));
    } finally {
      setBusy('');
    }
  }

  async function reconcile(action, txHash) {
    const response = await fetch('/api/admin/property-registry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ claimId: selected, action, txHash }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.ok === false) throw new Error(data?.error || 'Base Sepolia transaction could not be reconciled.');
    return data;
  }

  async function submitOnchain() {
    if (!session?.access_token || !prepared || !selected || busy) return;
    if (!['register', 'verify'].includes(prepared.stage)) return;
    if (!provider || !wallet) {
      await connectWallet();
      return;
    }

    setBusy('chain');
    setMessage('');
    try {
      await ensureBaseSepolia(provider);
      const accounts = await provider.request({ method: 'eth_accounts' });
      const active = getAddress(accounts?.[0] || '0x0000000000000000000000000000000000000000');
      if (active !== getAddress(prepared.requiredOwner)) throw new Error('The active MetaMask wallet is not the registry owner.');

      const browserProvider = new BrowserProvider(provider);
      const signer = await browserProvider.getSigner(active);
      const contract = new Contract(getAddress(prepared.contractAddress), ABI, signer);
      let tx;
      if (prepared.stage === 'register') {
        setMessage('MetaMask will open one Base Sepolia registration transaction. It does NOT verify the property or mint a Passport.');
        tx = await contract.registerIdentity(
          prepared.anchor.propertyId,
          prepared.anchor.claimHash,
          prepared.anchor.sourceHash,
          prepared.anchor.metadataURI,
        );
      } else {
        setMessage('MetaMask will open a separate Base Sepolia verification transaction. It still does NOT mint a Passport.');
        tx = await contract.setVerified(prepared.anchor.propertyId, true);
      }
      const action = prepared.stage;
      const hash = tx.hash;
      window.localStorage.setItem(`vv-property-registry:${selected}:${action}`, hash);
      setMessage(`Transaction submitted: ${short(hash)}. Waiting for Base Sepolia confirmation…`);
      const receipt = await tx.wait();
      if (!receipt || receipt.status !== 1) throw new Error('Base Sepolia transaction did not succeed.');
      setMessage('Confirmed on Base Sepolia. Voxel Vault is independently verifying the receipt before updating Supabase…');
      await reconcile(action, hash);
      window.localStorage.removeItem(`vv-property-registry:${selected}:${action}`);
      await loadList(session.access_token);
      setMessage(action === 'register'
        ? 'Registration confirmed and reconciled. A second explicit verification signature is now required.'
        : 'Canonical identity verified and reconciled on Base Sepolia. Passport minting remains a separate locked step.');
    } catch (error) {
      setMessage(errorText(error));
    } finally {
      setBusy('');
    }
  }

  async function recover() {
    if (!prepared || !selected || !session?.access_token) return;
    const action = prepared.stage === 'verification-unreconciled' ? 'verify' : 'register';
    const stored = window.localStorage.getItem(`vv-property-registry:${selected}:${action}`) || '';
    const txHash = String(recoveryTx || stored).trim();
    if (!txHash) {
      setMessage('Paste the original Base Sepolia transaction hash, or retry from the same browser that submitted it.');
      return;
    }
    setBusy('recover');
    try {
      await reconcile(action, txHash);
      window.localStorage.removeItem(`vv-property-registry:${selected}:${action}`);
      await loadList(session.access_token);
      setMessage('Existing Base Sepolia transaction was verified and reconciled without sending a new transaction.');
    } catch (error) {
      setMessage(errorText(error));
    } finally {
      setBusy('');
    }
  }

  const actionLabel = prepared?.stage === 'register'
    ? 'REGISTER IDENTITY ON BASE SEPOLIA'
    : prepared?.stage === 'verify'
      ? 'VERIFY IDENTITY ON BASE SEPOLIA'
      : '';

  return (
    <main className="min-h-screen bg-[#050706] px-4 py-6 text-white md:px-8 md:py-10">
      <section className="mx-auto max-w-6xl">
        <nav className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/admin/property-claims" className="font-black text-white no-underline">Voxel Vault · Property Registry</Link>
          <div className="flex gap-2 text-xs">
            <a href="https://sepolia.basescan.org" target="_blank" rel="noreferrer" className="rounded-full border border-white/10 px-4 py-2 text-white/60 no-underline">Base Sepolia ↗</a>
            <Link href="/vault/properties" className="rounded-full border border-white/10 px-4 py-2 text-white/60 no-underline">Earth room</Link>
          </div>
        </nav>

        <header className="max-w-4xl pb-10 pt-16 md:pt-24">
          <div className="text-[10px] font-black tracking-[.22em] text-[#9ff5df]/55">OWNER TOOL · BASE SEPOLIA ONLY</div>
          <h1 className="mt-4 text-5xl font-black leading-[.87] tracking-[-.07em] md:text-7xl">Anchor identity.<br/><span className="text-[#9ff5df]">Never the deed.</span></h1>
          <p className="mt-6 max-w-3xl text-base leading-7 text-white/50">This console anchors a human-verified Voxel Vault property identity to Base Sepolia. Registration and verification are two separate MetaMask approvals. Neither action transfers real estate, creates rent rights, issues an investment security or mints a Property Passport.</p>
        </header>

        {message ? <div className="mb-5 rounded-2xl border border-white/10 bg-white/[.035] p-4 text-sm leading-6 text-white/65">{message}</div> : null}

        {authState === 'loading' ? <State title="Checking admin identity…" copy="Loading your Google/Supabase session." /> : null}
        {authState === 'error' ? <State title="Admin identity unavailable" copy={message || 'Could not load admin identity.'} danger /> : null}
        {authState === 'signed-out' ? <State title="Owner allowlist required" copy="Sign in with the Google account configured for Voxel Vault owner tools." action={<button onClick={signIn} className="mt-5 rounded-full bg-white px-6 py-3 text-xs font-black text-black">SIGN IN WITH GOOGLE</button>} /> : null}

        {session?.user ? (
          <div className="grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
            <section className="rounded-[30px] border border-white/10 bg-white/[.025] p-6">
              <div className="text-[9px] font-black tracking-[.14em] text-white/35">HUMAN-VERIFIED CLAIMS</div>
              <select value={selected} onChange={(event) => { const id = event.target.value; setSelected(id); prepareClaim(id); }} className="mt-4 w-full rounded-2xl border border-white/10 bg-black/30 p-3 text-sm text-white">
                {!candidates.length ? <option value="">No verified claims</option> : null}
                {candidates.map((item) => <option key={item.claimId} value={item.claimId}>{item.propertyLabel || 'Property'} · {item.locality || 'No locality'} · …{item.authoritativeFingerprintSuffix}</option>)}
              </select>
              <button onClick={() => loadList(session.access_token)} disabled={Boolean(busy)} className="mt-3 rounded-full border border-white/10 px-4 py-2 text-xs text-white/60 disabled:opacity-40">{busy === 'list' ? 'REFRESHING…' : 'Refresh'}</button>

              {current ? <div className="mt-5 grid gap-2 text-xs">
                <Detail label="CLAIM" value={short(current.claimId)} />
                <Detail label="CANONICAL STATE" value={current.canonicalState} />
                <Detail label="REGISTRATION" value={current.registryRegistered ? 'RECONCILED' : 'NOT YET'} />
                <Detail label="REGISTRY VERIFIED" value={current.registryVerified ? 'YES' : 'NO'} />
                <Detail label="PASSPORT" value={current.passportMinted ? 'MINTED' : 'NOT MINTED'} />
              </div> : null}
            </section>

            <section className="rounded-[30px] border border-white/10 bg-white/[.025] p-6 md:p-8">
              {!prepared ? <State title="Select a verified property" copy="A verified claim with migration 019 and a configured Base Sepolia registry is required." /> : (
                <>
                  <div className="flex flex-wrap gap-2 text-[9px] font-black tracking-[.12em]">
                    <span className="rounded-full border border-[#9ff5df]/15 px-3 py-1.5 text-[#bffff0]">{String(prepared.stage || 'BLOCKED').toUpperCase()}</span>
                    <span className="rounded-full border border-white/10 px-3 py-1.5 text-white/45">CHAIN 84532</span>
                    {prepared.contractAddress ? <span className="rounded-full border border-white/10 px-3 py-1.5 text-white/45">REGISTRY {short(prepared.contractAddress)}</span> : null}
                  </div>

                  {prepared.anchor ? <div className="mt-5 grid gap-2 text-xs">
                    <Detail label="PROPERTY ID" value={prepared.anchor.propertyId || '—'} />
                    <Detail label="CLAIM HASH" value={prepared.anchor.claimHash || prepared.anchor.claimHashSuffix || '—'} />
                    <Detail label="SOURCE HASH" value={prepared.anchor.sourceHash || prepared.anchor.sourceHashSuffix || '—'} />
                    <Detail label="PUBLIC METADATA URI" value={prepared.anchor.metadataURI || '—'} />
                  </div> : null}

                  {['register', 'verify'].includes(prepared.stage) ? <>
                    <div className="mt-5 rounded-2xl border border-amber-100/12 bg-amber-100/[.025] p-4 text-xs leading-5 text-white/55">MetaMask must be connected to the registry owner wallet <b className="text-white/80">{short(prepared.requiredOwner)}</b>. The app cannot sign or spend on your behalf.</div>
                    <button onClick={wallet ? submitOnchain : connectWallet} disabled={Boolean(busy)} className="mt-4 w-full rounded-full bg-[#9ff5df] px-6 py-3 text-xs font-black text-[#07100e] disabled:opacity-40">{busy === 'chain' ? 'WAITING FOR BASE SEPOLIA…' : wallet ? actionLabel : 'CONNECT METAMASK'}</button>
                    {wallet ? <div className="mt-3 text-center text-[10px] text-white/35">Connected owner: {wallet}</div> : null}
                  </> : null}

                  {['registration-unreconciled', 'verification-unreconciled'].includes(prepared.stage) ? <div className="mt-5 rounded-2xl border border-amber-200/15 bg-amber-200/[.025] p-4">
                    <div className="text-xs font-black text-amber-100/75">RECOVERY — NO NEW TRANSACTION</div>
                    <p className="mt-2 text-xs leading-5 text-white/45">The chain action exists but Supabase did not record its receipt. Paste the original Base Sepolia transaction hash; the server will independently verify it before reconciling.</p>
                    <input value={recoveryTx} onChange={(event) => setRecoveryTx(event.target.value)} placeholder="0x… transaction hash" className="mt-3 w-full rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-white" />
                    <button onClick={recover} disabled={Boolean(busy)} className="mt-3 rounded-full border border-amber-100/20 px-5 py-2.5 text-xs font-black text-amber-100/70 disabled:opacity-40">RECONCILE EXISTING TX</button>
                  </div> : null}

                  {prepared.stage === 'complete' ? <div className="mt-5 rounded-2xl border border-emerald-200/15 bg-emerald-200/[.03] p-5 text-sm leading-6 text-emerald-100/70"><b>✓ CANONICAL IDENTITY VERIFIED ON BASE SEPOLIA</b><br/>Database and chain agree. Property Passport minting remains separate and locked.</div> : null}
                </>
              )}
            </section>
          </div>
        ) : null}
      </section>
    </main>
  );
}

function State({ title, copy, action = null, danger = false }) {
  return <section className={`rounded-3xl border p-6 ${danger ? 'border-red-200/15 bg-red-200/[.03]' : 'border-white/10 bg-white/[.02]'}`}><h2 className="text-xl font-black">{title}</h2><p className="mt-2 text-sm leading-6 text-white/45">{copy}</p>{action}</section>;
}

function Detail({ label, value }) {
  return <div className="rounded-2xl border border-white/8 bg-black/15 p-3"><div className="text-[8px] font-black tracking-[.11em] text-white/30">{label}</div><div className="mt-1 break-all font-bold text-white/68">{value}</div></div>;
}
