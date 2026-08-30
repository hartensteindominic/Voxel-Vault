'use client';

import { useCallback, useEffect, useState } from 'react';
import styles from './launch.module.css';

type Preflight = {
  readyForContractDeployment: boolean;
  readyForMinting: boolean;
  openSeaConfigured: boolean;
  mintSignerConfigured: boolean;
  mintSignerValid: boolean;
  collectionConfigured: boolean;
  collectionVerified?: boolean;
  collectionAddress: string | null;
  deploymentTxHash?: string | null;
  baseFunding?: { checked: boolean; hasEth: boolean; balanceEth: string };
  chain?: { checked?: boolean; name?: string };
  nextStep: string;
};

const short = (value?: string | null) => value ? `${value.slice(0, 6)}…${value.slice(-4)}` : '—';

export default function VoxelFlipLaunchStatus() {
  const [status, setStatus] = useState<Preflight | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/creator-pack/nft/preflight', { cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || 'Could not load VoxelFlip preflight status.');
      setStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load VoxelFlip preflight status.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const contractUrl = status?.collectionAddress ? `https://basescan.org/address/${status.collectionAddress}` : '';
  const txUrl = status?.deploymentTxHash ? `https://basescan.org/tx/${status.deploymentTxHash}` : '';
  const openSeaUrl = status?.collectionAddress ? `https://opensea.io/assets/base/${status.collectionAddress}` : '';

  return <main className={styles.page}>
    <nav><a href="/voxelflip">← VoxelFlip Vault</a><b>VOXELFLIP · READ-ONLY LAUNCH STATUS</b></nav>

    <header>
      <p>BASE MAINNET · NO AUTO-SIGN · NO AUTO-SPEND</p>
      <h1>Verify first.</h1>
      <span>This page is intentionally read-only. It checks the current VoxelFlip collection, server readiness, and public Base state. It cannot deploy a contract, sign a transaction, or spend ETH.</span>
    </header>

    <section className={styles.card}>
      <div className={styles.term}><span>COLLECTION</span><b>{status?.collectionAddress ? short(status.collectionAddress) : loading ? 'Checking…' : 'Not configured'}</b></div>
      <div className={styles.term}><span>BASE VERIFICATION</span><b>{status?.collectionVerified ? 'Verified' : status?.chain?.checked ? 'Failed checks' : loading ? 'Checking…' : 'Unavailable'}</b></div>
      <div className={styles.term}><span>MINT READINESS</span><b>{status?.readyForMinting ? 'Ready for self-test' : loading ? 'Checking…' : 'Not ready'}</b></div>
      <div className={styles.term}><span>NEW DEPLOYMENT</span><b>{status?.readyForContractDeployment ? 'Review required' : 'Disabled'}</b></div>
    </section>

    <section className={styles.checks}>
      <div className={status?.openSeaConfigured ? styles.ok : styles.no}><i>{status?.openSeaConfigured ? '✓' : '×'}</i><span>OpenSea API</span><small>{loading ? 'checking' : status?.openSeaConfigured ? 'configured' : 'not configured'}</small></div>
      <div className={status?.mintSignerConfigured && status?.mintSignerValid ? styles.ok : styles.no}><i>{status?.mintSignerConfigured && status?.mintSignerValid ? '✓' : '×'}</i><span>Mint signer</span><small>{loading ? 'checking' : status?.mintSignerConfigured ? status?.mintSignerValid ? 'valid' : 'invalid' : 'not configured'}</small></div>
      <div className={status?.baseFunding?.hasEth ? styles.ok : status?.baseFunding?.checked ? styles.no : styles.pending}><i>{status?.baseFunding?.hasEth ? '✓' : status?.baseFunding?.checked ? '×' : '·'}</i><span>Base funding</span><small>{status?.baseFunding?.checked ? `${status.baseFunding.balanceEth} ETH` : 'not checked'}</small></div>
      <div className={status?.collectionConfigured && status?.collectionVerified ? styles.ok : styles.pending}><i>{status?.collectionConfigured && status?.collectionVerified ? '✓' : '·'}</i><span>Collection</span><small>{status?.collectionVerified ? 'live + verified' : status?.collectionConfigured ? 'configured, verifying' : 'not configured'}</small></div>
    </section>

    <section className={styles.actions}>
      <button className={styles.secondary} type="button" onClick={refresh} disabled={loading}>{loading ? 'Refreshing preflight…' : 'Refresh read-only status'}</button>
      <small>No wallet connection is required here. Never paste a private key, seed phrase, API key, or any other secret into this page or chat.</small>
    </section>

    {status?.collectionConfigured && <section className={styles.success}>
      <b>{status.collectionVerified ? '✓ Public Base collection detected' : 'Collection configured; live verification still required'}</b>
      <span>{status.collectionAddress}</span>
      <div>
        {contractUrl && <a href={contractUrl} target="_blank" rel="noreferrer">BaseScan contract ↗</a>}
        {txUrl && <a href={txUrl} target="_blank" rel="noreferrer">Deployment tx ↗</a>}
        {openSeaUrl && <a href={openSeaUrl} target="_blank" rel="noreferrer">OpenSea ↗</a>}
        {status.readyForMinting && <a href="/studio">Begin owner self-test →</a>}
      </div>
    </section>}

    {status && !status.readyForMinting && <p className={styles.message}>{status.nextStep}</p>}
    {status?.readyForMinting && <p className={styles.message}>Preflight says minting is ready. The next action is one owner/self-test from VoxelPop Studio; this page still performs no wallet action.</p>}
    {error && <p className={styles.error}>{error}</p>}

    <footer><span>{status?.nextStep || 'Loading VoxelFlip preflight…'}</span><a href="/studio">VoxelPop Studio</a></footer>
  </main>;
}
