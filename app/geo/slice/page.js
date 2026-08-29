'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useWalletIdentity } from '../../components/WalletIdentity';
import styles from './page.module.css';

function toCents(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? Math.round(number * 100) : 0;
}

function money(cents) {
  const value = Number(cents || 0) / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function referenceMoney(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return '$0';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(number);
}

function percent(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return '0%';
  if (number > 0 && number < 0.0001) return `${number.toExponential(3)}%`;
  return `${number.toFixed(6)}%`;
}

function indexLabel(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? `${number.toFixed(1)}x` : '—';
}

export default function PropertySlicePage() {
  const { address, connected, connect } = useWalletIdentity();
  const [slice, setSlice] = useState({
    selectedName: 'Selected GEO property',
    selectedPrice: '100000',
    benchmarkName: 'My benchmark property',
    benchmarkPrice: '100000',
    amount: '1.99',
  });
  const [sliceResult, setSliceResult] = useState(null);
  const [sliceBusy, setSliceBusy] = useState(false);
  const [moneyInputs, setMoneyInputs] = useState({ usd: '0', crypto: '0', nft: '0', property: '0' });
  const [moneyResult, setMoneyResult] = useState(null);
  const [moneyBusy, setMoneyBusy] = useState(false);
  const [message, setMessage] = useState('Sandbox preview · no money moves until a verified provider is connected.');

  const shortWallet = useMemo(() => address ? `${address.slice(0, 6)}…${address.slice(-4)}` : '', [address]);
  const selectedPriceNumber = Number(slice.selectedPrice || 0);
  const benchmarkPriceNumber = Number(slice.benchmarkPrice || 0);
  const amountNumber = Number(slice.amount || 0);
  const previewPercent = selectedPriceNumber > 0 ? (amountNumber / selectedPriceNumber) * 100 : 0;
  const previewIndex = benchmarkPriceNumber > 0 ? selectedPriceNumber / benchmarkPriceNumber : 0;
  const slicePercent = sliceResult?.hypotheticalPercent ?? previewPercent;
  const benchmarkWeight = sliceResult?.relativePropertyPriceIndex ?? previewIndex;

  function changeSlice(key, value) {
    setSlice((current) => ({ ...current, [key]: value }));
  }

  function changeMoney(key, value) {
    setMoneyInputs((current) => ({ ...current, [key]: value }));
  }

  async function calculateSlice(event) {
    event?.preventDefault?.();
    setSliceBusy(true);
    try {
      const response = await fetch('/api/geo/property-slice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'slice',
          amountCents: toCents(slice.amount),
          propertyReferencePriceCents: toCents(slice.selectedPrice),
          benchmarkReferencePriceCents: toCents(slice.benchmarkPrice),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok) throw new Error(data?.error || 'Could not calculate Property Slice.');
      setSliceResult(data.result);
      setMessage(`${money(data.result.amountCents)} slice saved to this sandbox view. No deed, security, or funds transfer was created.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not calculate Property Slice.');
    } finally {
      setSliceBusy(false);
    }
  }

  async function previewMoney(event) {
    event?.preventDefault?.();
    setMoneyBusy(true);
    try {
      const response = await fetch('/api/geo/property-slice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'conversion_preview',
          settledUsdCents: toCents(moneyInputs.usd),
          estimatedCryptoValueCents: toCents(moneyInputs.crypto),
          estimatedNftValueCents: toCents(moneyInputs.nft),
          propertyGoalCents: toCents(moneyInputs.property),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok) throw new Error(data?.error || 'Could not build unified Vault preview.');
      setMoneyResult(data.result);
      setMessage('Vault preview updated. Only settled USD is spendable; crypto and NFT values stay estimates until settlement.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not build unified Vault preview.');
    } finally {
      setMoneyBusy(false);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.topbar}>
          <Link href="/" className={styles.brand} aria-label="Voxel Vault home">
            <span className={styles.vaultLogo}><i>+</i></span>
            <strong>Voxel Vault</strong>
          </Link>
          <button type="button" className={styles.avatarButton} onClick={connect} aria-label={connected ? `Wallet ${shortWallet}` : 'Connect wallet'}>
            <span className={styles.pixelAvatar}><i /></span>
            <b className={connected ? styles.online : styles.offline} />
          </button>
        </header>

        <section className={styles.titleBlock}>
          <h1>Property Slice</h1>
          <p>Start tiny. Keep property, USD, crypto and NFTs in one simple Vault.</p>
        </section>

        <form onSubmit={calculateSlice} className={styles.sliceForm}>
          <section className={styles.heroCard} aria-label="$1.99 Property Slice sandbox">
            <VoxelHouseArt />
            <div className={styles.buySide}>
              <div className={styles.heroPrice}>{money(toCents(slice.amount))}</div>
              <button type="submit" className={styles.buyButton} disabled={sliceBusy}>
                <span className={styles.miniVault}>+</span>
                {sliceBusy ? 'Saving…' : 'Buy Slice'}
              </button>
              <small>Sandbox preview · no funds move</small>
            </div>
          </section>

          <section className={styles.referenceCard}>
            <span className={`${styles.miniTile} ${styles.houseTile}`}>⌂</span>
            <div>
              <small>Reference property</small>
              <b>{slice.selectedName}</b>
            </div>
            <strong>{referenceMoney(slice.selectedPrice)}</strong>
          </section>

          <section className={styles.metricCard}>
            <div className={styles.metricHalf}>
              <span className={styles.pieIcon}><i /></span>
              <div><small>Your {money(toCents(slice.amount))} =</small><strong>{percent(slicePercent)}</strong></div>
            </div>
            <div className={styles.metricHalf}>
              <span className={styles.barIcon}><i /><i /><i /></span>
              <div><small>Benchmark weight =</small><strong>{indexLabel(benchmarkWeight)}</strong></div>
            </div>
          </section>

          <details className={styles.editorCard}>
            <summary>Change property values</summary>
            <div className={styles.editorGrid}>
              <label><span>Property name</span><input value={slice.selectedName} onChange={(e) => changeSlice('selectedName', e.target.value)} /></label>
              <label><span>Property value</span><div className={styles.moneyInput}><b>$</b><input inputMode="decimal" value={slice.selectedPrice} onChange={(e) => changeSlice('selectedPrice', e.target.value)} /></div></label>
              <label><span>Slice amount</span><div className={styles.moneyInput}><b>$</b><input inputMode="decimal" value={slice.amount} onChange={(e) => changeSlice('amount', e.target.value)} /></div></label>
              <label><span>Benchmark name</span><input value={slice.benchmarkName} onChange={(e) => changeSlice('benchmarkName', e.target.value)} /></label>
              <label><span>Benchmark value</span><div className={styles.moneyInput}><b>$</b><input inputMode="decimal" value={slice.benchmarkPrice} onChange={(e) => changeSlice('benchmarkPrice', e.target.value)} /></div></label>
            </div>
          </details>
        </form>

        <section className={styles.assetGrid} aria-label="Unified Vault">
          <AssetTile kind="property" icon="⌂" label="Property" value={sliceResult ? 'Slice saved' : 'Ready'} />
          <AssetTile kind="usd" icon="$" label="USD" value={moneyResult ? money(moneyResult.balances.settledUsdCents) : '$0.00'} />
          <AssetTile kind="crypto" icon="◆" label="Crypto" value={connected ? shortWallet : 'Connect'} onClick={connect} />
          <AssetTile kind="nft" icon="▣" label="NFTs" value={moneyResult ? money(moneyResult.balances.estimatedNftValueCents) : '$0.00 est.'} />
        </section>

        <section className={styles.convertCard}>
          <h2>Convert path</h2>
          <div className={styles.convertFlow}>
            <FlowStep kind="nft" icon="▣" label="NFT" />
            <span className={styles.arrow}>→</span>
            <FlowStep kind="market" icon="▤" label="Sale" />
            <span className={styles.arrow}>→</span>
            <FlowStep kind="cash" icon="$" label="USD" />
            <span className={styles.arrow}>→</span>
            <FlowStep kind="home" icon="⌂" label="Property" />
          </div>
        </section>

        <details className={styles.editorCard}>
          <summary>Update Vault balances</summary>
          <form onSubmit={previewMoney} className={styles.editorGrid}>
            <BalanceInput label="Settled USD" value={moneyInputs.usd} onChange={(value) => changeMoney('usd', value)} />
            <BalanceInput label="Crypto estimated USD value" value={moneyInputs.crypto} onChange={(value) => changeMoney('crypto', value)} />
            <BalanceInput label="NFT estimated USD value" value={moneyInputs.nft} onChange={(value) => changeMoney('nft', value)} />
            <BalanceInput label="Property goal" value={moneyInputs.property} onChange={(value) => changeMoney('property', value)} />
            <button className={styles.updateButton} disabled={moneyBusy}>{moneyBusy ? 'Updating…' : 'Update Vault preview'}</button>
          </form>
          {moneyResult && <div className={styles.spendable}>Spendable now: <b>{money(moneyResult.spendableNowCents)}</b> settled USD</div>}
        </details>

        {sliceResult && (
          <details className={styles.truthCard}>
            <summary>What does this slice mean?</summary>
            <p>{sliceResult.note}</p>
            <div className={styles.truthStats}>
              <span><small>Benchmark equivalent</small><b>{money(sliceResult.benchmarkEquivalentCents)}</b></span>
              <span><small>Reference fraction</small><b>{sliceResult.hypotheticalPartsPerMillion} ppm</b></span>
            </div>
          </details>
        )}

        <div className={styles.status}>{message}</div>

        <nav className={styles.bottomNav} aria-label="Primary navigation">
          <Link href="/"><span>⌂</span><b>Home</b></Link>
          <Link href="/geo"><span>◈</span><b>Explore</b></Link>
          <Link href="/vault"><span>▣</span><b>Vault</b></Link>
          <button type="button" onClick={connect}><span>☺</span><b>{connected ? 'Wallet' : 'Profile'}</b></button>
        </nav>
      </div>
    </main>
  );
}

function VoxelHouseArt() {
  return (
    <div className={styles.sceneWrap} aria-hidden="true">
      <div className={styles.voxelLot}>
        <div className={styles.tree}><i className={styles.treeTop} /><i className={styles.treeMid} /><i className={styles.treeTrunk} /></div>
        <div className={styles.house}>
          <i className={styles.roofBack} /><i className={styles.roofFront} />
          <i className={styles.houseBody} /><i className={styles.door} /><i className={styles.windowOne} /><i className={styles.windowTwo} />
          <i className={styles.chimney} /><i className={styles.smokeOne} /><i className={styles.smokeTwo} />
        </div>
        <i className={styles.pathOne} /><i className={styles.pathTwo} /><i className={styles.pathThree} />
        <i className={styles.flowerOne} /><i className={styles.flowerTwo} />
      </div>
    </div>
  );
}

function AssetTile({ kind, icon, label, value, onClick }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag type={onClick ? 'button' : undefined} onClick={onClick} className={`${styles.assetTile} ${styles[kind]}`}>
      <span className={styles.assetArt}>{icon}</span>
      <b>{label}</b>
      <small>{value}</small>
    </Tag>
  );
}

function FlowStep({ kind, icon, label }) {
  return <div className={`${styles.flowStep} ${styles[`flow_${kind}`]}`}><span>{icon}</span><b>{label}</b></div>;
}

function BalanceInput({ label, value, onChange }) {
  return <label><span>{label}</span><div className={styles.moneyInput}><b>$</b><input inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} /></div></label>;
}
