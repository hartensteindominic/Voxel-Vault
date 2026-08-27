'use client';

import type { SpatialAsset } from '@/lib/spatial-assets';
import { shortWallet } from '@/lib/spatial-assets';
import styles from './spatial.module.css';

type Props = {
  assets: SpatialAsset[];
  accountName: string;
  walletAddress?: string;
  chainLabel?: string;
  balanceEth?: string;
  walletVerified?: boolean;
  walletBusy?: boolean;
  mode: 'vault' | 'gallery';
  onModeChange: (mode: 'vault' | 'gallery') => void;
  onConnectWallet: () => void;
  onVerifyWallet: () => void;
};

export default function SpatialWalletUI({
  assets,
  accountName,
  walletAddress = '',
  chainLabel = 'Not connected',
  balanceEth = '0',
  walletVerified = false,
  walletBusy = false,
  mode,
  onModeChange,
  onConnectWallet,
  onVerifyWallet,
}: Props) {
  const minted = assets.filter(asset => asset.state === 'minted').length;
  const ready = assets.filter(asset => ['generated', 'saved', 'minted'].includes(asset.state)).length;
  const visibleBalance = Number(balanceEth || 0);
  const balance = Number.isFinite(visibleBalance) ? visibleBalance.toFixed(Math.abs(visibleBalance) < 0.01 ? 5 : 3) : '0';

  return (
    <section className={styles.hud} aria-label="Spatial wallet dashboard">
      <div className={styles.hudCard}>
        <div className={styles.hudTop}>
          <div>
            <span className={styles.hudLabel}>VOXELVAULT ACCOUNT</span>
            <h3>{accountName}</h3>
            <p>This is your non-custodial spatial inventory. VoxelVault never stores your wallet private key or seed phrase.</p>
          </div>
          <div className={styles.modeTabs} aria-label="3D room style">
            <button type="button" className={mode === 'vault' ? styles.active : ''} onClick={() => onModeChange('vault')}>VAULT</button>
            <button type="button" className={mode === 'gallery' ? styles.active : ''} onClick={() => onModeChange('gallery')}>GALLERY</button>
          </div>
        </div>
        <div className={styles.stats}>
          <div className={styles.stat}><b>{assets.length}</b><span>CREATIONS</span></div>
          <div className={styles.stat}><b>{ready}</b><span>3D READY</span></div>
          <div className={styles.stat}><b>{minted}</b><span>MINTED</span></div>
        </div>
        <div className={styles.hudActions}>
          <a href="/creator" className={styles.hudPrimary}>＋ CREATE NEW 3D ASSET</a>
          <a href="/vault" className={styles.hudSecondary}>STANDARD LIBRARY</a>
        </div>
      </div>

      <div className={styles.hudCard}>
        <span className={styles.hudLabel}>CONNECTED WEB3 WALLET</span>
        <h3>{walletAddress ? shortWallet(walletAddress) : 'No wallet connected'}</h3>
        <p>{walletAddress ? 'External signatures remain inside your wallet. The 3D wallet is a portfolio and action interface only.' : 'Connect MetaMask to view chain context and enable wallet-owned actions.'}</p>
        {walletAddress && (
          <>
            <div className={styles.walletMeta}>
              <span>{chainLabel}</span>
              <span>{balance} ETH</span>
              <span className={walletVerified ? styles.verified : ''}>{walletVerified ? '✓ ACCOUNT VERIFIED' : 'NOT LINKED TO ACCOUNT'}</span>
            </div>
            <div className={styles.walletAddress}>{walletAddress}</div>
          </>
        )}
        <div className={styles.hudActions}>
          <button type="button" className={styles.hudPrimary} onClick={onConnectWallet} disabled={walletBusy}>{walletBusy ? 'CONNECTING…' : walletAddress ? 'REFRESH WALLET' : 'CONNECT METAMASK'}</button>
          {walletAddress && !walletVerified && <button type="button" className={styles.hudSecondary} onClick={onVerifyWallet} disabled={walletBusy}>{walletBusy ? 'WAITING FOR WALLET…' : 'VERIFY OWNERSHIP'}</button>}
        </div>
      </div>
    </section>
  );
}
