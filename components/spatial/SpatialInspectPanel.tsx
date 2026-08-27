'use client';

import type { SpatialAsset } from '@/lib/spatial-assets';
import { openSeaUrlForSpatialAsset, shortWallet, spatialAssetStatusLabel } from '@/lib/spatial-assets';
import { reviewedMintPageHref } from '@/lib/web3-minting';
import SpatialMintPanel from './SpatialMintPanel';
import styles from './spatial.module.css';

type Props = {
  asset: SpatialAsset | null;
  busy?: boolean;
  accessToken?: string;
  walletAddress?: string;
  walletVerified?: boolean;
  onClose: () => void;
  onDownload: (asset: SpatialAsset) => void;
  onToggleFavorite: (asset: SpatialAsset) => void;
  onMintComplete?: () => void | Promise<void>;
};

function transactionUrl(asset: SpatialAsset) {
  if (!asset.transactionHash) return '';
  if (asset.chainId === 84532) return `https://sepolia-explorer.base.org/tx/${asset.transactionHash}`;
  if (asset.chainId === 8453) return `https://base.blockscout.com/tx/${asset.transactionHash}`;
  return '';
}

export default function SpatialInspectPanel({
  asset,
  busy = false,
  accessToken = '',
  walletAddress = '',
  walletVerified = false,
  onClose,
  onDownload,
  onToggleFavorite,
  onMintComplete = () => {},
}: Props) {
  if (!asset) return <div className={styles.emptyInspect}>Tap any creation in the 3D room to inspect its model, ownership, and actions.</div>;
  const openSea = openSeaUrlForSpatialAsset(asset);
  const explorer = transactionUrl(asset);
  const mintHref = asset.sourceSessionId ? reviewedMintPageHref(asset.sourceSessionId) : '';

  return (
    <section className={styles.inspect} aria-label={`Inspect ${asset.title}`}>
      <div className={styles.inspectGrid}>
        <div className={styles.inspectVisual}>
          {asset.imageUrl ? <img src={asset.imageUrl} alt={`${asset.title} preview`} /> : <div className={styles.inspectPlaceholder} aria-label="Voxel crystal placeholder" />}
        </div>
        <div className={styles.inspectBody}>
          <button type="button" className={styles.closeInspect} onClick={onClose} aria-label="Close inspector">×</button>
          <div className={styles.inspectKicker}>{spatialAssetStatusLabel(asset)} · {asset.collectionName}</div>
          <h2>{asset.title}</h2>
          <p>{asset.description || asset.prompt || 'A creation stored in your VoxelVault spatial library.'}</p>
          <div className={styles.inspectMeta}>
            <div><small>STATE</small><strong>{asset.state.toUpperCase()}</strong></div>
            <div><small>SOURCE</small><strong>{asset.sourceKind.toUpperCase()}</strong></div>
            <div><small>OWNER WALLET</small><strong>{asset.ownerWallet ? shortWallet(asset.ownerWallet) : 'Not minted'}</strong></div>
            <div><small>CHAIN</small><strong>{asset.chainId === 8453 ? 'Base' : asset.chainId === 84532 ? 'Base Sepolia' : asset.chainId ? `Chain ${asset.chainId}` : 'Off-chain creation'}</strong></div>
            <div><small>TOKEN ID</small><strong>{asset.tokenId || '—'}</strong></div>
            <div><small>AUDIT</small><strong>{asset.auditHash ? `${asset.auditHash.slice(0, 10)}…${asset.auditHash.slice(-8)}` : 'Pending first server event'}</strong></div>
          </div>
          <div className={styles.inspectActions}>
            {(asset.modelUrl || asset.sourceTaskId) && <button type="button" className={styles.primary} onClick={() => onDownload(asset)} disabled={busy}>{busy ? 'PREPARING…' : 'DOWNLOAD GLB ↓'}</button>}
            {asset.state !== 'minted' && mintHref && <a className={styles.secondary} href={mintHref}>PRODUCTION VOXELFLIP MINT</a>}
            {openSea && <a className={styles.secondary} href={openSea} target="_blank" rel="noreferrer">VIEW ON OPENSEA ↗</a>}
            {explorer && <a className={styles.secondary} href={explorer} target="_blank" rel="noreferrer">TRANSACTION ↗</a>}
            <button type="button" className={styles.secondary} onClick={() => onToggleFavorite(asset)} disabled={busy}>{asset.favorite ? '★ FAVORITED' : '☆ FAVORITE'}</button>
          </div>
          {asset.state !== 'minted' && accessToken && (
            <SpatialMintPanel
              asset={asset}
              accessToken={accessToken}
              walletAddress={walletAddress}
              walletVerified={walletVerified}
              onComplete={onMintComplete}
            />
          )}
        </div>
      </div>
    </section>
  );
}
