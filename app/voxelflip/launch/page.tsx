'use client';

import { BrowserProvider, ContractFactory, formatEther } from 'ethers';
import { useEffect, useState } from 'react';
import artifact from '../../../lib/voxelflip-deploy-artifact.json';
import { connectVoxelFlipWallet } from '../../../lib/voxelflip';
import styles from './launch.module.css';

const APPROVED_OWNER = '0x02f93c7547309ca50EEAB446DaEBE8ce8E694cBb';
const short = (value: string) => value ? `${value.slice(0, 6)}…${value.slice(-4)}` : '';

type Preflight = {
  approvedLaunch?: { royaltyPercent: number; royaltyBps: number; defaultOwner: string; defaultRoyaltyReceiver: string };
  readyForContractDeployment: boolean;
  readyForMinting: boolean;
  openSeaConfigured: boolean;
  mintSignerValid: boolean;
  mintSignerMatchesConfiguredAddress: boolean;
  mintSignerAddress: string | null;
  collectionConfigured: boolean;
  collectionAddress: string | null;
  deploymentTxHash?: string | null;
  baseFunding?: { checked: boolean; hasEth: boolean; balanceEth: string };
  nextStep: string;
};

export default function VoxelFlipLaunch() {
  const [preflight, setPreflight] = useState<Preflight | null>(null);
  const [wallet, setWallet] = useState('');
  const [walletBalance, setWalletBalance] = useState('');
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

  useEffect(() => { refresh().catch(() => setError('Could not load VoxelFlip launch status.')); }, []);

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
      if (!status.openSeaConfigured || !status.mintSignerValid || !status.mintSignerAddress) throw new Error(status.nextStep || 'VoxelFlip server configuration is incomplete.');

      const connected = await connectVoxelFlipWallet();
      if (connected.address.toLowerCase() !== APPROVED_OWNER.toLowerCase()) throw new Error(`Connect the approved Voxel Vault owner wallet ${short(APPROVED_OWNER)}.`);
      const provider = new BrowserProvider(connected.provider);
      const balance = await provider.getBalance(connected.address);
      if (balance <= BigInt(0)) throw new Error('This wallet has no ETH on Base. Move a small amount of ETH to Base for deployment gas first.');
      setWallet(connected.address); setWalletBalance(formatEther(balance));

      setStage('deploying'); setMessage('MetaMask will show the exact Base gas cost. Approve it only if it looks right.');
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
      setMessage(`Deployment submitted · ${short(deploymentTx.hash)}. Waiting for Base confirmation…`);
      await contract.waitForDeployment();
      const address = await contract.getAddress();

      setStage('registering'); setMessage(`Contract confirmed at ${short(address)}. Verifying owner, signer and 5% royalty…`);
      const registeredResponse = await fetch('/api/creator-pack/nft/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, txHash: deploymentTx.hash }),
      });
      const registered = await registeredResponse.json();
      if (!registeredResponse.ok) throw new Error(registered.error || 'The contract deployed but automatic VoxelFlip registration failed.');
      await refresh();
      setStage('done'); setMessage(`VoxelFlip is live on Base at ${address}. The collection is registered automatically.`);
    } catch (err: any) {
      if (err?.code === 'NO_WALLET_PROVIDER' && err?.deepLink) { window.location.href = err.deepLink; return; }
      setStage('error'); setError(err instanceof Error ? err.message : 'VoxelFlip deployment failed.');
      setMessage('');
    }
  }

  const funded = preflight?.baseFunding?.hasEth || (walletBalance ? Number(walletBalance) > 0 : false);
  return <main className={styles.page}>
    <nav><a href="/voxelflip">← VoxelFlip Vault</a><b>VOXELFLIP LAUNCH CONTROL</b></nav>
    <header><p>BASE MAINNET · OWNER-SIGNED DEPLOYMENT</p><h1>Launch VoxelFlip.</h1><span>One guarded deployment. Your wallet approves the gas. The app verifies and registers everything else automatically.</span></header>

    <section className={styles.card}>
      <div className={styles.term}><span>COLLECTION</span><b>VoxelFlip by Voxel Vault</b></div>
      <div className={styles.term}><span>OWNER + ROYALTY WALLET</span><b>{short(APPROVED_OWNER)}</b></div>
      <div className={styles.term}><span>LAUNCH ROYALTY</span><b>5% · 500 bps</b></div>
      <div className={styles.term}><span>NETWORK</span><b>Base · chain 8453</b></div>
    </section>

    <section className={styles.checks}>
      <div className={preflight?.openSeaConfigured ? styles.ok : styles.no}><i>{preflight?.openSeaConfigured ? '✓' : '×'}</i><span>OpenSea API</span></div>
      <div className={preflight?.mintSignerValid ? styles.ok : styles.no}><i>{preflight?.mintSignerValid ? '✓' : '×'}</i><span>Mint signer</span></div>
      <div className={funded ? styles.ok : styles.no}><i>{funded ? '✓' : '×'}</i><span>Base gas</span><small>{preflight?.baseFunding?.checked ? `${preflight.baseFunding.balanceEth} ETH` : 'checking'}</small></div>
      <div className={preflight?.collectionConfigured ? styles.ok : styles.pending}><i>{preflight?.collectionConfigured ? '✓' : '·'}</i><span>Collection</span><small>{preflight?.collectionAddress ? short(preflight.collectionAddress) : 'not deployed'}</small></div>
    </section>

    {!preflight?.collectionConfigured && <section className={styles.actions}>
      <button className={styles.secondary} disabled={busy} onClick={connect}>{wallet ? `Owner connected · ${short(wallet)}` : 'Connect owner wallet'}</button>
      {!funded && <a className={styles.bridge} href="https://bridge.base.org" target="_blank" rel="noreferrer">Move ETH to Base ↗</a>}
      <button className={styles.deploy} disabled={busy || !preflight?.readyForContractDeployment} onClick={deploy}>{stage === 'deploying' ? 'Confirm in wallet…' : stage === 'registering' ? 'Verifying contract…' : 'Deploy VoxelFlip on Base'}</button>
      <small>The deploy button creates one real Base transaction and spends only the gas shown by your wallet. Nothing can approve that transaction for you.</small>
    </section>}

    {preflight?.collectionConfigured && <section className={styles.success}><b>✓ VoxelFlip collection registered</b><span>{preflight.collectionAddress}</span><div><a href={`https://basescan.org/address/${preflight.collectionAddress}`} target="_blank" rel="noreferrer">BaseScan ↗</a><a href="/studio">Create test VoxelFlip →</a></div></section>}
    {message && <p className={styles.message}>{message}</p>}
    {error && <p className={styles.error}>{error}</p>}
    <footer><span>{preflight?.nextStep || 'Loading launch status…'}</span><a href="/studio">VoxelPop Studio</a></footer>
  </main>;
}
