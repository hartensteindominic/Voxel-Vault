'use client';

import { useEffect, useState } from 'react';
import type { SpatialAsset } from '@/lib/spatial-assets';
import { dispatchReviewedSpatialMint, getSpatialMintReview, type PreparedSpatialMint } from '@/lib/web3-minting';
import styles from './spatial.module.css';

type PendingMint = {
  assetId: string;
  tokenId: string;
  txHash: string;
  wallet: string;
  metadataUrl: string;
  contractAddress: string;
  chainId: number;
};

type Props = {
  asset: SpatialAsset;
  accessToken: string;
  walletAddress: string;
  walletVerified: boolean;
  onComplete: () => void | Promise<void>;
};

function pendingKey(assetId: string) {
  return `voxelvault:spatial-mint:${assetId}`;
}

function readPending(assetId: string): PendingMint | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = JSON.parse(window.localStorage.getItem(pendingKey(assetId)) || 'null');
    if (value?.assetId === assetId && /^0x[a-fA-F0-9]{64}$/.test(String(value?.txHash || '')) && /^\d+$/.test(String(value?.tokenId || ''))) return value;
  } catch {}
  return null;
}

export default function SpatialMintPanel({ asset, accessToken, walletAddress, walletVerified, onComplete }: Props) {
  const [review, setReview] = useState<any>(null);
  const [prepared, setPrepared] = useState<PreparedSpatialMint | null>(null);
  const [pending, setPending] = useState<PendingMint | null>(null);
  const [stage, setStage] = useState<'idle'|'reviewing'|'ready'|'wallet'|'verifying'|'done'|'error'>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    setPrepared(null);
    setPending(readPending(asset.id));
    setStage('idle');
    setMessage('');
    getSpatialMintReview().then(setReview).catch(error => setMessage(error instanceof Error ? error.message : 'Spatial mint configuration unavailable.'));
  }, [asset.id]);

  async function prepareMint() {
    if (!walletAddress || !walletVerified) {
      setStage('error');
      setMessage('Connect and verify the wallet that should own this NFT before preparing the mint.');
      return;
    }
    setStage('reviewing');
    setMessage('Making the GLB durable and checking the testnet contract…');
    try {
      const response = await fetch('/api/spatial-assets/mint/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ assetId: asset.id, wallet: walletAddress }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || 'Spatial mint preparation failed.');
      setPrepared(data as PreparedSpatialMint);
      setStage('ready');
      setMessage('Review the network and platform fee below. The next button opens MetaMask; VoxelVault cannot sign for you.');
    } catch (error) {
      setStage('error');
      setMessage(error instanceof Error ? error.message : 'Spatial mint preparation failed.');
    }
  }

  async function verifyPending(value: PendingMint) {
    setStage('verifying');
    setMessage('Verifying the transaction, token owner, metadata, and platform fee on-chain…');
    try {
      const response = await fetch('/api/spatial-assets/mint/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          assetId: asset.id,
          txHash: value.txHash,
          tokenId: value.tokenId,
          wallet: value.wallet,
          metadataUrl: value.metadataUrl,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || 'Mint verification is not complete yet.');
      try { window.localStorage.removeItem(pendingKey(asset.id)); } catch {}
      setPending(null);
      setStage('done');
      setMessage(`Verified. Token #${data.tokenId} is now attached to this spatial asset.`);
      await onComplete();
    } catch (error) {
      setStage('error');
      setMessage(`${error instanceof Error ? error.message : 'Verification unavailable.'} Do not mint again; resume verification with the saved transaction.`);
    }
  }

  async function mint() {
    if (!prepared) return;
    setStage('wallet');
    setMessage('Confirm this one testnet mint in MetaMask. Network gas is separate from the disclosed VoxelVault platform fee.');
    try {
      const result = await dispatchReviewedSpatialMint(prepared);
      const value: PendingMint = {
        assetId: asset.id,
        tokenId: String(result.tokenId),
        txHash: String(result.txHash || result.hash),
        wallet: String(result.owner),
        metadataUrl: prepared.metadataUrl,
        contractAddress: prepared.contractAddress,
        chainId: prepared.chainId,
      };
      setPending(value);
      try { window.localStorage.setItem(pendingKey(asset.id), JSON.stringify(value)); } catch {}
      await verifyPending(value);
    } catch (error: any) {
      if (error?.code === 'NO_WALLET_PROVIDER' && error?.deepLink) {
        window.location.href = error.deepLink;
        return;
      }
      setStage('error');
      setMessage(error instanceof Error ? error.message : 'The wallet did not complete the spatial mint.');
    }
  }

  if (asset.state === 'minted') return null;
  const busy = ['reviewing','wallet','verifying'].includes(stage);
  const configured = Boolean(review?.enabled && !review?.paused);

  return (
    <div className={styles.mintPanel}>
      <span className={styles.hudLabel}>EXPERIMENTAL SPATIAL NFT · TESTNET FIRST</span>
      <h3>{pending ? 'Resume your submitted mint' : 'Mint this spatial asset'}</h3>
      <p>{pending ? 'A transaction is saved in this browser. Verify it instead of creating another mint.' : configured ? 'A separate SpatialVoxelNFT contract keeps this experimental flow isolated from the production VoxelFlip contract.' : 'Direct spatial minting remains locked until the Base Sepolia contract and server configuration are deployed and reviewed.'}</p>

      {prepared && (
        <div className={styles.mintReview}>
          <div><small>NETWORK</small><strong>{prepared.chainName}</strong></div>
          <div><small>CONTRACT</small><strong>{`${prepared.contractAddress.slice(0,8)}…${prepared.contractAddress.slice(-6)}`}</strong></div>
          <div><small>VOXELVAULT PLATFORM FEE</small><strong>{prepared.platformFeeEth} ETH</strong></div>
          <div><small>NETWORK GAS</small><strong>ESTIMATED BY WALLET</strong></div>
        </div>
      )}
      {prepared && <p className={styles.feeNotice}>{prepared.gasNotice}</p>}
      {message && <p className={styles.statusText} role="status" aria-live="polite">{message}</p>}

      <div className={styles.hudActions}>
        {pending ? (
          <button type="button" className={styles.hudPrimary} onClick={() => verifyPending(pending)} disabled={busy}>{stage === 'verifying' ? 'VERIFYING…' : 'RESUME VERIFICATION'}</button>
        ) : !prepared ? (
          <button type="button" className={styles.hudPrimary} onClick={prepareMint} disabled={busy || !configured || !walletVerified}>{stage === 'reviewing' ? 'PREPARING…' : configured ? 'REVIEW TESTNET MINT' : 'TESTNET MINT LOCKED'}</button>
        ) : (
          <button type="button" className={styles.hudPrimary} onClick={mint} disabled={busy}>{stage === 'wallet' ? 'WAITING FOR METAMASK…' : 'CONFIRM IN METAMASK'}</button>
        )}
      </div>
    </div>
  );
}
