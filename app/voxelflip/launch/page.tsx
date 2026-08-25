'use client';

import { BrowserProvider, ContractFactory, formatEther } from 'ethers';
import { useEffect, useState } from 'react';
import artifact from '../../../lib/voxelflip-deploy-artifact.json';
import { connectVoxelFlipWallet } from '../../../lib/voxelflip';
import styles from './launch.module.css';

const APPROVED_OWNER = '0x02f93c7547309ca50EEAB446DaEBE8ce8E694cBb';
const RECENT_DEPLOYED_CONTRACT = '0xa00758b05f96ef4409d97c3ffebb6794b2eafbde';
const PENDING_KEY = 'voxelflipPendingDeployment';
const short = (value: string) => value ? `${value.slice(0, 6)}…${value.slice(-4)}` : '';

type Preflight = {
  readyForContractDeployment: boolean;
  readyForMinting: boolean;
  openSeaConfigured: boolean;
  mintSignerValid: boolean;
  mintSignerAddress: string | null;
  collectionConfigured: boolean;
  collectionAddress: string | null;
  deploymentTxHash?: string | null;
  baseFunding?: { checked: boolean; hasEth: boolean; balanceEth: string };
  nextStep: string;
};

type PendingDeployment = { address: string; txHash?: string };

export default function VoxelFlipLaunch() {
  const [preflight, setPreflight] = useState<Preflight | null>(null);
  const [wallet, setWallet] = useState('');
  const [walletBalance, setWalletBalance] = useState('');
  const [pending, setPending] = useState<PendingDeployment>({ address: RECENT_DEPLOYED_CONTRACT });
  const [stage, setStage] = useState<'idle'|'connecting'|'deploying'|'registering'|'done'|'error'>('idle');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const busy = stage === 'connecting' || stage === 'deploying' || stage === 'registering';

  async function refresh() {
    const response = await fetch('/api/creator-pack/nft/preflight', { cache: 'no-store' });
    const data = await response.json();
    setPreflight(data);
    return data as Preflight;
  }

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(PENDING_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (/^0x[a-fA-F0-9]{40}$/.test(parsed?.address || '')) setPending(parsed);
      }
    } catch {}
    refresh().catch(() => setError('Could not load VoxelFlip launch status.'));
  }, []);

  function savePending(value: PendingDeployment) {
    setPending(value);
    try { window.localStorage.setItem(PENDING_KEY, JSON.stringify(value)); } catch {}
  }

  function clearPending() {
    try { window.localStorage.removeItem(PENDING_KEY); } catch {}
  }

  async function registerDeployment(value: PendingDeployment) {
    setStage('registering');
    setError('');
    setMessage(`Verifying ${short(value.address)} on Base. No gas is required…`);
    const response = await fetch('/api/creator-pack/nft/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: value.address, txHash: value.txHash || undefined }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'VoxelFlip registration failed.');
    const finalStatus = await refresh();
    if (!finalStatus.readyForMinting) throw new Error('Registration succeeded, but mint readiness has not refreshed yet. Refresh once.');
    clearPending();
    setStage('done');
    setMessage(`VoxelFlip is registered and ready for minting at ${finalStatus.collectionAddress || value.address}.`);
  }

  async function retryRegistration() {
    if (busy || !pending?.address) return;
    try {
      await registerDeployment(pending);
    } catch (err: any) {
      setStage('error');
      setError(err instanceof Error ? err.message : 'VoxelFlip registration failed.');
      setMessage('');
    }
  }

  async function connect() {
    setStage('connecting'); setError(''); setMessage('Opening your Base wallet…');
    try {
      const result = await connectVoxelFlipWallet();
      if (result.address.toLowerCase() !== APPROVED_OWNER.toLowerCase()) throw new Error(`Connect the approved Voxel Vault owner wallet ${short(APPROVED_OWNER)}.`);
      const provider = new BrowserProvider(result.provider);
      const balance = await provider.getBalance(result.address);
      setWallet(result.address);
      setWalletBalance(formatEther(balance));
      setStage('idle'); setMessage(`Owner wallet connected · ${short(result.address)} · ${formatEther(balance)} ETH on Base`);
    } catch (err: any) {
      if (err?.code === 'NO_WALLET_PROVIDER' && err?.deepLink) { window.location.href = err.deepLink; return; }
      setStage('error'); setError(err instanceof Error ? err.message : 'Wallet connection failed.'); setMessage('');
    }
  }

  async function deploy() {
    if (busy) return;
    setError(''); setMessage('Checking launch configuration…');
    try {
      const status = await refresh();
      if (status.collectionConfigured) { setStage('done'); setMessage(`VoxelFlip is already registered at ${status.collectionAddress}.`); return; }
      if (!status.readyForContractDeployment || !status.openSeaConfigured || !status.mintSignerValid || !status.mintSignerAddress) throw new Error(status.nextStep || 'VoxelFlip server configuration is incomplete.');

      const connected = await connectVoxelFlipWallet();
      if (connected.address.toLowerCase() !== APPROVED_OWNER.toLowerCase()) throw new Error(`Connect the approved Voxel Vault owner wallet ${short(APPROVED_OWNER)}.`);
      const provider = new BrowserProvider(connected.provider);
      const balance = await provider.getBalance(connected.address);
      if (balance <= BigInt(0)) throw new Error('This wallet has no ETH on Base. Move a small amount of ETH to Base for deployment gas first.');
      setWallet(connected.address); setWalletBalance(formatEther(balance));

      setStage('deploying'); setMessage('Your wallet will show the exact Base gas cost. Approve it only if it looks right.');
      const signer = await provider.getSigner(connected.address);
      const factory = new ContractFactory(artifact.abi as any, artifact.bytecode, signer);
      const contract = await factory.deploy(
        APPROVED_OWNER,
        status.mintSignerAddress,
        APPROVED_OWNER,
        500,
        `${window.location.origin}/voxelflip`,
      );
      const deploymentTx = contract.deploymentTransaction();
      if (!deploymentTx?.hash) throw new Error('The deployment transaction was not created.');
      const predictedAddress = (await contract.getAddress()).toLowerCase();
      savePending({ address: predictedAddress, txHash: deploymentTx.hash });
      setMessage(`Deployment submitted · ${short(deploymentTx.hash)}. Waiting for Base confirmation…`);
      await contract.waitForDeployment();
      const address = (await contract.getAddress()).toLowerCase();
      savePending({ address, txHash: deploymentTx.hash });
      await registerDeployment({ address, txHash: deploymentTx.hash });
    } catch (err: any) {
      if (err?.code === 'NO_WALLET_PROVIDER' && err?.deepLink) { window.location.href = err.deepLink; return; }
      setStage('error');
      setError(err instanceof Error ? err.message : 'VoxelFlip deployment failed.');
      setMessage('');
    }
  }

  const funded = preflight?.baseFunding?.hasEth || (walletBalance ? Number(walletBalance) > 0 : false);
  return <main className={styles.page}>
    <nav><a href="/voxelflip">← VoxelFlip Vault</a><b>VOXELFLIP LAUNCH CONTROL</b></nav>
    <header><p>BASE MAINNET · OWNER-SIGNED DEPLOYMENT</p><h1>Launch VoxelFlip.</h1><span>Deploy once. If verification needs another attempt, registration can be retried without spending gas again.</span></header>

    <section className={styles.checks}>
      <div className={preflight?.openSeaConfigured ? styles.ok : styles.no}><i>{preflight?.openSeaConfigured ? '✓' : '×'}</i><span>OpenSea API</span></div>
      <div className={preflight?.mintSignerValid ? styles.ok : styles.no}><i>{preflight?.mintSignerValid ? '✓' : '×'}</i><span>Mint signer</span></div>
      <div className={funded ? styles.ok : styles.no}><i>{funded ? '✓' : '×'}</i><span>Base gas</span><small>{preflight?.baseFunding?.checked ? `${preflight.baseFunding.balanceEth} ETH` : 'checking'}</small></div>
      <div className={preflight?.collectionConfigured ? styles.ok : styles.pending}><i>{preflight?.collectionConfigured ? '✓' : '·'}</i><span>Collection</span><small>{preflight?.collectionAddress ? short(preflight.collectionAddress) : 'not registered'}</small></div>
    </section>

    {!preflight?.collectionConfigured && <section className={styles.actions}>
      {pending?.address && <>
        <button className={styles.deploy} disabled={busy} onClick={retryRegistration}>{stage === 'registering' ? 'Verifying on Base…' : `Finish registration · ${short(pending.address)}`}</button>
        <small>Use this first. It retries verification of the contract you already deployed and costs no gas.</small>
      </>}
      <button className={styles.secondary} disabled={busy} onClick={connect}>{wallet ? `Owner connected · ${short(wallet)}` : 'Connect owner wallet'}</button>
      <button className={styles.secondary} disabled={busy || !preflight?.readyForContractDeployment} onClick={deploy}>{stage === 'deploying' ? 'Confirm in wallet…' : 'Deploy another contract only if needed'}</button>
      <small>A new Base deployment spends gas. Registration retries do not.</small>
    </section>}

    {preflight?.collectionConfigured && <section className={styles.success}><b>✓ VoxelFlip collection registered</b><span>{preflight.collectionAddress}</span><div><a href={`https://basescan.org/address/${preflight.collectionAddress}`} target="_blank" rel="noreferrer">BaseScan ↗</a><a href="/studio">Create test VoxelFlip →</a></div></section>}
    {message && <p className={styles.message}>{message}</p>}
    {error && <p className={styles.error}>{error}</p>}
    <footer><span>{preflight?.nextStep || 'Loading launch status…'}</span><a href="/studio">VoxelPop Studio</a></footer>
  </main>;
}
