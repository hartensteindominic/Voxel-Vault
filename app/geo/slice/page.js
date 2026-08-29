'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import styles from './page.module.css';

const SLICE_KEY = 'voxel-vault:property-slice-sandbox';
const PURCHASE_KEY = 'voxel-vault:property-slice-purchases';
const DEFAULT_DEMO_USD_CENTS = 1240;

function toCents(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? Math.round(number * 100) : 0;
}
function money(cents) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(cents || 0) / 100);
}
function referenceMoney(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(number) : '$0';
}
function percent(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return '0%';
  return number > 0 && number < 0.0001 ? `${number.toExponential(3)}%` : `${number.toFixed(6)}%`;
}
function indexLabel(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? `${number.toFixed(2)}×` : '—';
}
function unitLabelFor(count) {
  return Number(count) === 1 ? '1 demo slice' : `${Number(count) || 0} demo slices`;
}

export default function PropertySlicePage() {
  const [slice, setSlice] = useState({
    selectedName: 'Selected property',
    selectedPrice: '100000',
    benchmarkName: 'Anchor property',
    benchmarkPrice: '100000',
    amount: '1.99',
  });
  const [sliceResult, setSliceResult] = useState(null);
  const [purchase, setPurchase] = useState({ demoUsdCents: DEFAULT_DEMO_USD_CENTS, demoUnits: 0, lastPurchase: null });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Sandbox only · no real money moves and no property rights are created.');

  const selected = Number(slice.selectedPrice || 0);
  const benchmark = Number(slice.benchmarkPrice || 0);
  const amount = Number(slice.amount || 0);
  const relativeIndex = sliceResult?.relativePropertyPriceIndex ?? (benchmark > 0 ? selected / benchmark : 0);
  const adjustedCents = sliceResult?.adjustedTestPriceCents ?? (benchmark > 0 ? Math.max(1, Math.round(toCents(slice.amount) * (selected / benchmark))) : toCents(slice.amount));
  const slicePercent = sliceResult?.hypotheticalPercent ?? (benchmark > 0 ? (amount / benchmark) * 100 : 0);
  const demoBalance = money(purchase.demoUsdCents);
  const unitLabel = useMemo(() => unitLabelFor(purchase.demoUnits), [purchase.demoUnits]);

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(SLICE_KEY) || 'null');
      if (saved?.slice) setSlice(saved.slice);
      if (saved?.result) setSliceResult(saved.result);
      const purchaseSaved = JSON.parse(window.localStorage.getItem(PURCHASE_KEY) || 'null');
      if (purchaseSaved?.demoUsdCents >= 0) {
        setPurchase({
          demoUsdCents: Number(purchaseSaved.demoUsdCents),
          demoUnits: Number(purchaseSaved.demoUnits || 0),
          lastPurchase: purchaseSaved.lastPurchase || null,
        });
      }
    } catch {}
  }, []);

  function changeSlice(key, value) {
    setSlice((current) => ({ ...current, [key]: value }));
    setSliceResult(null);
  }

  async function testBuy(event) {
    event?.preventDefault?.();
    setBusy(true);
    setMessage('Running the sandbox purchase…');
    try {
      const response = await fetch('/api/geo/property-slice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'purchase',
          amountCents: toCents(slice.amount),
          propertyReferencePriceCents: toCents(slice.selectedPrice),
          benchmarkReferencePriceCents: toCents(slice.benchmarkPrice),
          selectedName: slice.selectedName,
          demoUsdBalanceCents: purchase.demoUsdCents,
          existingDemoUnits: purchase.demoUnits,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok) throw new Error(data?.error || 'Could not complete the sandbox purchase.');

      const result = data.result;
      const nextPurchase = {
        demoUsdCents: result.balances.demoUsdAfterCents,
        demoUnits: result.purchase.demoUnitsAfter,
        lastPurchase: {
          selectedName: result.purchase.selectedName,
          priceCents: result.purchase.debitDemoUsdCents,
          percent: result.purchase.hypotheticalPercentPerUnit,
          boughtAt: new Date().toISOString(),
        },
      };
      setSliceResult(result.slice);
      setPurchase(nextPurchase);
      try {
        window.localStorage.setItem(SLICE_KEY, JSON.stringify({ slice, result: result.slice, savedAt: new Date().toISOString() }));
        window.localStorage.setItem(PURCHASE_KEY, JSON.stringify(nextPurchase));
      } catch {}
      setMessage(`${money(result.purchase.debitDemoUsdCents)} demo purchase complete · ${unitLabelFor(result.purchase.demoUnitsAfter)} · no real funds, deed, equity, security, rent rights, or NFT moved.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not complete the sandbox purchase.');
    } finally {
      setBusy(false);
    }
  }

  return <main className={styles.page}><div className={styles.phone}>
    <header className={styles.topbar}>
      <Link href="/" className={styles.brand}><VoxelLock/><strong>Voxel Vault</strong></Link>
      <Link href="/more" className={styles.avatarButton} aria-label="Advanced tools"><span className={styles.pixelAvatar}><b/></span></Link>
    </header>

    <section className={styles.heading}>
      <span>PROPERTY SLICE · SANDBOX</span>
      <h1>What would $1.99 represent?</h1>
      <p>Compare a tiny test amount across property reference values. This is math and demo credits—not a real investment, property reservation, security purchase, or deed transfer.</p>
    </section>

    <form onSubmit={testBuy} className={styles.sliceForm}>
      <section className={styles.heroCard}>
        <div className={styles.sceneSide}>
          <div className={styles.demoPill}>DEMO BALANCE · NOT MONEY · {demoBalance}</div>
          <VoxelScene/>
          <div className={styles.sceneCaption}><b>{slice.selectedName || 'Selected property'}</b><span>{referenceMoney(slice.selectedPrice)} reference value</span></div>
        </div>
        <div className={styles.buySide}>
          <small>DEMO SLICE PRICE</small>
          <div className={styles.heroPrice}>{money(adjustedCents)}</div>
          <button className={styles.buyButton} disabled={busy || adjustedCents > purchase.demoUsdCents}>
            <span className={styles.bag}>+</span>{busy ? 'Testing…' : adjustedCents > purchase.demoUsdCents ? 'Demo balance too low' : 'Test Buy'}
          </button>
          <div className={styles.sandbox}>Simulation only · no checkout · no wallet · no ownership</div>
        </div>
      </section>

      <section className={styles.compareGrid}>
        <div><span className={styles.houseBadge}>⌂</span><small>SELECTED</small><strong>{slice.selectedName || 'Selected property'}</strong><b>{referenceMoney(slice.selectedPrice)} reference</b></div>
        <div><span className={styles.anchorBadge}>★</span><small>ANCHOR</small><strong>{slice.benchmarkName || 'Anchor property'}</strong><b>{referenceMoney(slice.benchmarkPrice)} → {money(toCents(slice.amount))}</b></div>
      </section>

      <section className={styles.metrics}>
        <div><span className={styles.pie}><i/></span><span><small>Hypothetical fraction</small><strong>{percent(slicePercent)}</strong></span></div>
        <div><span className={styles.bars}><i/><i/><i/></span><span><small>Selected vs. anchor</small><strong>{indexLabel(relativeIndex)}</strong></span></div>
      </section>

      <div className={styles.formula}><b>{money(toCents(slice.amount))}</b><span>×</span><b>{referenceMoney(slice.selectedPrice)}</b><span>÷</span><b>{referenceMoney(slice.benchmarkPrice)}</b><span>=</span><strong>{money(adjustedCents)}</strong></div>

      <details className={styles.details}>
        <summary>Change the comparison</summary>
        <div className={styles.fields}>
          <label>Selected property<input value={slice.selectedName} onChange={(event) => changeSlice('selectedName', event.target.value)}/></label>
          <label>Selected reference value<input inputMode="decimal" value={slice.selectedPrice} onChange={(event) => changeSlice('selectedPrice', event.target.value)}/></label>
          <label>Anchor property<input value={slice.benchmarkName} onChange={(event) => changeSlice('benchmarkName', event.target.value)}/></label>
          <label>Anchor reference value<input inputMode="decimal" value={slice.benchmarkPrice} onChange={(event) => changeSlice('benchmarkPrice', event.target.value)}/></label>
          <label className={styles.fullField}>Anchor demo price<input inputMode="decimal" value={slice.amount} onChange={(event) => changeSlice('amount', event.target.value)}/></label>
        </div>
      </details>
    </form>

    {purchase.lastPurchase ? <section className={styles.activityCard}>
      <div><span>RECENT DEMO</span><h2>{purchase.lastPurchase.selectedName}</h2><p>{money(purchase.lastPurchase.priceCents)} demo balance → 1 simulated slice</p></div>
      <div className={styles.activityValue}><small>SANDBOX TOTAL</small><strong>{unitLabel}</strong><span>{demoBalance} demo balance left</span></div>
    </section> : null}

    <div className={styles.status}>{message}</div>
    <div className={styles.nextLinks}>
      <Link href="/property">Create a digital property voxel →</Link>
      <Link href="/more">See verified/provider-gated features →</Link>
    </div>
  </div></main>;
}

function VoxelLock() {
  return <span className={styles.voxelLock}><i/><b>+</b></span>;
}

function VoxelScene() {
  return <svg className={styles.scene} viewBox="0 0 260 220" aria-hidden="true">
    <g>
      <polygon points="30,105 145,55 232,94 116,148" fill="#85c94b"/>
      <polygon points="30,105 116,148 116,196 30,151" fill="#8f5b32"/>
      <polygon points="116,148 232,94 232,142 116,196" fill="#6e452b"/>
      <polygon points="70,99 136,68 192,94 125,126" fill="#f2d4ae"/>
      <polygon points="70,99 125,126 125,164 70,136" fill="#efb971"/>
      <polygon points="125,126 192,94 192,132 125,164" fill="#d89558"/>
      <polygon points="62,91 130,58 202,91 136,112" fill="#76503c"/>
      <rect x="91" y="111" width="18" height="32" fill="#774a35"/>
      <rect x="143" y="112" width="20" height="15" fill="#8ed5dc"/>
    </g>
  </svg>;
}
