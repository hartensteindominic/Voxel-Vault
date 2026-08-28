'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { BrowserProvider, ContractFactory, getAddress } from 'ethers';
import { getSupabaseBrowserAsync } from '../../../../lib/supabase-browser';
import { discoverMetaMaskProvider, getMetaMaskDeepLink } from '../../../../lib/wallet-connect';

const CHAIN_ID = '0x14a34';
const RPC_URL = 'https://sepolia.base.org';
const EXPLORER = 'https://sepolia.basescan.org';
const CONSTRUCTOR_ABI = [{
  inputs: [{ internalType: 'address', name: 'initialOwner', type: 'address' }],
  stateMutability: 'nonpayable',
  type: 'constructor',
}];
const RECOVERY_KEY = 'vv-canonical-property-registry-deployment';

function googleReturnUrl() {
  return new URL('/admin/property-registry/deploy?auth=google', window.location.origin).toString();
}

function errorText(error) {
  return String(error?.shortMessage || error?.reason || error?.message || error || 'Deployment action failed.');
}

function short(value) {
  const text = String(value || '');
  return text ? `${text.slice(0, 8)}…${text.slice(-6)}` : '—';
}

function hexBytes(hex) {
  const clean = String(hex || '').replace(/^0x/, '');
  if (!clean || clean.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(clean)) throw new Error('Reviewed deployment bytecode is invalid.');
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i += 1) bytes[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

async function sha256Hex(hex) {
  const digest = await window.crypto.subtle.digest('SHA-256', hexBytes(hex));
  return `0x${Array.from(new Uint8Array(digest)).map((value) => value.toString(16).padStart(2, '0')).join('')}`;
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

async function loadBytecode(config) {
  const response = await fetch(config.bytecode.path, { cache: 'no-store' });
  if (!response.ok) throw new Error('The reviewed canonical registry bytecode could not be loaded.');
  const bytecode = (await response.text()).trim();
  if (!bytecode.startsWith('0x') || bytecode.length !== Number(config.bytecode.length)) {
    throw new Error('Canonical registry bytecode failed its reviewed length check.');
  }
  const digest = await sha256Hex(bytecode);
  if (digest.toLowerCase() !== String(config.bytecode.sha256 || '').toLowerCase()) {
    throw new Error('Canonical registry bytecode failed its SHA-256 integrity check.');
  }
  return bytecode;
}

export default function CanonicalRegistryDeployPage() {
  const [session, setSession] = useState(null);
  const [authState, setAuthState] = useState('loading');
  const [config, setConfig] = useState(null);
  const [provider, setProvider] = useState(null);
  const [wallet, setWallet] = useState('');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [recovery, setRecovery] = useState(null);
  const clientRef = useRef(null);

  async function loadConfig(accessToken) {
    const token = String(accessToken || '').trim();
    if (!token) return;
    setBusy('config');
    try {
      const response = await fetch('/api/admin/property-registry/deployment', { cache: 'no-store', headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok === false) throw new Error(data?.error || 'Registry deployment configuration is unavailable.');
      setConfig(data);
      if (data.existingDeployment) {
        window.localStorage.removeItem(RECOVERY_KEY);
        setRecovery(null);
        setMessage('The reviewed canonical property registry is already deployed, independently verified and locked in Supabase.');
      } else {
        const stored = window.localStorage.getItem(RECOVERY_KEY);
        setRecovery(stored ? JSON.parse(stored) : null);
        setMessage('Ready for the one-time Base Sepolia registry deployment. No property will be registered or verified by this transaction.');
      }
    } catch (error) {
      setConfig(null);
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
        setConfig(null);
        return;
      }
      setAuthState('signed-in');
      await loadConfig(next.access_token || '');
      if (new URLSearchParams(window.location.search).get('auth') === 'google') {
        window.history.replaceState({}, '', '/admin/property-registry/deploy');
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
    setBusy('wallet');
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
      setProvider(injected);
      setWallet(address);
      setMessage(`Wallet ${short(address)} connected on Base Sepolia. Nothing has been signed or deployed yet.`);
    } catch (error) {
      setMessage(errorText(error));
    } finally {
      setBusy('');
    }
  }

  async function registerDeployment(candidate) {
    const response = await fetch('/api/admin/property-registry/deployment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify(candidate),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.ok === false) throw new Error(data?.error || 'Registry deployment could not be verified and locked.');
    return data;
  }

  async function deploy() {
    if (!config || config.existingDeployment || !session?.access_token || busy) return;
    if (!provider || !wallet) {
      await connectWallet();
      return;
    }
    setBusy('deploy');
    try {
      await ensureBaseSepolia(provider);
      const accounts = await provider.request({ method: 'eth_accounts' });
      const active = getAddress(accounts?.[0] || '0x0000000000000000000000000000000000000000');
      if (active !== wallet) throw new Error('The active MetaMask wallet changed. Reconnect before deploying.');

      setMessage('Loading and verifying the exact CI-compiled canonical registry bytecode…');
      const bytecode = await loadBytecode(config);
      const browserProvider = new BrowserProvider(provider);
      const signer = await browserProvider.getSigner(wallet);
      const factory = new ContractFactory(CONSTRUCTOR_ABI, bytecode, signer);

      setMessage('Opening MetaMask for the one-time Base Sepolia contract deployment. Review the testnet gas before approving.');
      const contract = await factory.deploy(wallet);
      const tx = contract.deploymentTransaction();
      if (!tx?.hash) throw new Error('MetaMask did not return a deployment transaction hash.');
      setMessage(`Deployment submitted: ${short(tx.hash)}. Waiting for Base Sepolia confirmation…`);
      const receipt = await tx.wait();
      if (!receipt || receipt.status !== 1) throw new Error('Base Sepolia deployment transaction did not succeed.');
      const address = await contract.getAddress();
      const candidate = { address, wallet, txHash: tx.hash };
      window.localStorage.setItem(RECOVERY_KEY, JSON.stringify(candidate));
      setRecovery(candidate);

      setMessage('Contract confirmed. Voxel Vault is independently checking the deployed runtime bytecode and owner before locking it…');
      const saved = await registerDeployment(candidate);
      window.localStorage.removeItem(RECOVERY_KEY);
      setRecovery(null);
      await loadConfig(session.access_token);
      setMessage(saved?.nextStep || 'Canonical registry deployment verified and locked.');
    } catch (error) {
      setMessage(errorText(error));
    } finally {
      setBusy('');
    }
  }

  async function recover() {
    if (!recovery || !session?.access_token || busy) return;
    setBusy('recover');
    try {
      setMessage('Verifying the existing Base Sepolia deployment. No new transaction will be sent…');
      await registerDeployment(recovery);
      window.localStorage.removeItem(RECOVERY_KEY);
      setRecovery(null);
      await loadConfig(session.access_token);
      setMessage('Existing canonical registry deployment verified and locked without redeploying.');
    } catch (error) {
      setMessage(errorText(error));
    } finally {
      setBusy('');
    }
  }

  const existing = config?.existingDeployment;

  return (
    <main className="min-h-screen bg-[#050706] px-4 py-6 text-white md:px-8 md:py-10">
      <section className="mx-auto max-w-5xl">
        <nav className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/admin/property-registry" className="font-black text-white no-underline">Voxel Vault · Registry Deploy</Link>
          <a href="https://sepolia.basescan.org" target="_blank" rel="noreferrer" className="rounded-full border border-white/10 px-4 py-2 text-xs text-white/60 no-underline">Base Sepolia ↗</a>
        </nav>

        <header className="max-w-4xl pb-10 pt-16 md:pt-24">
          <div className="text-[10px] font-black tracking-[.22em] text-[#9ff5df]/55">ONE-TIME OWNER TOOL · TESTNET ONLY</div>
          <h1 className="mt-4 text-5xl font-black leading-[.87] tracking-[-.07em] md:text-7xl">Deploy identity.<br/><span className="text-[#9ff5df]">Not property rights.</span></h1>
          <p className="mt-6 max-w-3xl text-base leading-7 text-white/50">Deploys only the canonical property identity registry on Base Sepolia. The deployment transaction does not register a house, verify a parcel, mint a Property Passport, transfer a deed, create rent rights or issue an investment interest.</p>
        </header>

        {message ? <div className="mb-5 rounded-2xl border border-white/10 bg-white/[.035] p-4 text-sm leading-6 text-white/65">{message}</div> : null}
        {authState === 'loading' ? <State title="Checking admin identity…" copy="Loading your Google/Supabase session." /> : null}
        {authState === 'error' ? <State title="Admin identity unavailable" copy={message || 'Could not load admin identity.'} danger /> : null}
        {authState === 'signed-out' ? <State title="Owner allowlist required" copy="Sign in with the Google account configured for Voxel Vault owner tools." action={<button onClick={signIn} className="mt-5 rounded-full bg-white px-6 py-3 text-xs font-black text-black">SIGN IN WITH GOOGLE</button>} /> : null}

        {session?.user && config ? <section className="rounded-[34px] border border-white/10 bg-white/[.025] p-6 md:p-9">
          <div className="grid gap-3 md:grid-cols-3">
            <Detail label="NETWORK" value="Base Sepolia · 84532" />
            <Detail label="CREATION BYTECODE" value={`${Math.floor((Number(config.bytecode?.length || 2) - 2) / 2)} bytes`} />
            <Detail label="MAINNET" value="LOCKED" />
          </div>

          {existing ? <div className="mt-6 rounded-3xl border border-emerald-200/15 bg-emerald-200/[.03] p-6">
            <div className="text-sm font-black text-emerald-100/80">✓ REVIEWED REGISTRY DEPLOYMENT LOCKED</div>
            <div className="mt-4 grid gap-2 text-xs">
              <Detail label="CONTRACT" value={existing.contractAddress} />
              <Detail label="OWNER" value={existing.ownerAddress} />
              <Detail label="DEPLOYMENT TX" value={existing.deploymentTxHash} />
              <Detail label="RUNTIME SHA-256" value={existing.runtimeCodeHash} />
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <a href={existing.explorerUrl} target="_blank" rel="noreferrer" className="rounded-full border border-emerald-100/20 px-5 py-2.5 text-xs font-black text-emerald-100/70 no-underline">VIEW ON BASESCAN ↗</a>
              <Link href="/admin/property-registry" className="rounded-full bg-[#9ff5df] px-5 py-2.5 text-xs font-black text-[#07100e] no-underline">OPEN PROPERTY ANCHOR →</Link>
            </div>
          </div> : <>
            <div className="mt-6 rounded-2xl border border-amber-100/12 bg-amber-100/[.025] p-4 text-xs leading-5 text-white/55">The connected wallet becomes the registry owner. Keep it secure. Voxel Vault never asks for or stores its private key. MetaMask shows the Base Sepolia deployment transaction before anything is sent.</div>
            <div className="mt-5 grid gap-2 text-xs">
              <Detail label="CONNECTED WALLET" value={wallet || 'Not connected'} />
              <Detail label="REVIEWED BYTECODE SHA-256" value={config.bytecode?.sha256 || '—'} />
              <Detail label="EXPECTED RUNTIME SHA-256" value={config.expectedRuntimeSha256 || '—'} />
            </div>
            <button onClick={wallet ? deploy : connectWallet} disabled={Boolean(busy)} className="mt-5 w-full rounded-full bg-[#9ff5df] px-6 py-3 text-xs font-black text-[#07100e] disabled:opacity-40">{busy === 'deploy' ? 'WAITING FOR BASE SEPOLIA…' : wallet ? 'DEPLOY CANONICAL REGISTRY ON BASE SEPOLIA' : 'CONNECT METAMASK'}</button>

            {recovery ? <div className="mt-5 rounded-2xl border border-amber-200/15 bg-amber-200/[.025] p-5">
              <div className="text-xs font-black text-amber-100/75">EXISTING DEPLOYMENT RECOVERY</div>
              <p className="mt-2 text-xs leading-5 text-white/45">A previous deployment transaction was saved in this browser but was not locked into Supabase. Recover it first—do not deploy another contract.</p>
              <div className="mt-3 text-xs text-white/50">{short(recovery.address)} · {short(recovery.txHash)}</div>
              <button onClick={recover} disabled={Boolean(busy)} className="mt-3 rounded-full border border-amber-100/20 px-5 py-2.5 text-xs font-black text-amber-100/70 disabled:opacity-40">VERIFY EXISTING DEPLOYMENT — NO NEW GAS</button>
            </div> : null}
          </>}
        </section> : null}
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
