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

function percent(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return '0%';
  if (number > 0 && number < 0.0001) return `${number.toExponential(3)}%`;
  return `${number.toFixed(6)}%`;
}

function indexLabel(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? `${number.toFixed(3)}×` : '—';
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
  const [message, setMessage] = useState('Try the $1.99 sandbox first. Nothing here moves money or creates real-property ownership.');

  const shortWallet = useMemo(() => address ? `${address.slice(0, 6)}…${address.slice(-4)}` : '', [address]);

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
      setMessage(`${money(data.result.amountCents)} is now modeled against this property. This is a sandbox comparison, not legal ownership.`);
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
      setMessage('Unified Vault preview updated. Only settled USD is counted as spendable right now.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not build unified Vault preview.');
    } finally {
      setMoneyBusy(false);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <nav className={styles.nav}>
          <Link href="/geo" className={styles.brand}><span>✦</span> GEO</Link>
          <div className={styles.navLinks}>
            <Link href="/geo">3D Property</Link>
            <Link href="/vault">My Vault</Link>
          </div>
        </nav>

        <header className={styles.hero}>
          <div className={styles.eyebrow}>PROPERTY + MONEY + DIGITAL ASSETS</div>
          <h1>A $1.99 slice of your <em>3D property world.</em></h1>
          <p>
            Test tiny property amounts, compare every place to your benchmark property, and see USD, crypto and NFTs in one Vault—without blurring the legal difference between a digital asset and real estate.
          </p>
          <div className={styles.heroActions}>
            <a href="#slice" className={styles.primaryAction}>Try $1.99</a>
            <Link href="/geo" className={styles.secondaryAction}>Open 3D GEO</Link>
          </div>
          <div className={styles.truthPill}>Sandbox now · real ownership only through verified offerings</div>
        </header>

        <section className={styles.vaultStrip} aria-label="Unified Vault asset types">
          <AssetTile icon="⌂" label="PROPERTY" value={sliceResult ? money(sliceResult.amountCents) : '$1.99'} note="sandbox slice" />
          <AssetTile icon="$" label="USD" value={moneyResult ? money(moneyResult.balances.settledUsdCents) : '$0.00'} note="settled only" />
          <AssetTile icon="◇" label="CRYPTO" value={moneyResult ? money(moneyResult.balances.estimatedCryptoValueCents) : '$0.00'} note="estimated" />
          <AssetTile icon="▦" label="NFTs" value={moneyResult ? money(moneyResult.balances.estimatedNftValueCents) : '$0.00'} note="estimated" />
        </section>

        <section id="slice" className={styles.panel}>
          <div className={styles.panelHead}>
            <div>
              <div className={styles.kicker}>PROPERTY SLICE · SANDBOX</div>
              <h2>Make $1.99 comparable everywhere.</h2>
            </div>
            <div className={styles.priceBadge}>$1.99</div>
          </div>

          <form onSubmit={calculateSlice} className={styles.formGrid}>
            <label className={styles.fieldWide}>
              <span>Selected property</span>
              <input value={slice.selectedName} onChange={(e) => changeSlice('selectedName', e.target.value)} />
            </label>
            <label>
              <span>Property reference price</span>
              <div className={styles.moneyInput}><b>$</b><input inputMode="decimal" value={slice.selectedPrice} onChange={(e) => changeSlice('selectedPrice', e.target.value)} /></div>
            </label>
            <label>
              <span>Test amount</span>
              <div className={styles.moneyInput}><b>$</b><input inputMode="decimal" value={slice.amount} onChange={(e) => changeSlice('amount', e.target.value)} /></div>
            </label>
            <label className={styles.fieldWide}>
              <span>Benchmark property</span>
              <input value={slice.benchmarkName} onChange={(e) => changeSlice('benchmarkName', e.target.value)} />
            </label>
            <label className={styles.fieldWide}>
              <span>Benchmark reference price</span>
              <div className={styles.moneyInput}><b>$</b><input inputMode="decimal" value={slice.benchmarkPrice} onChange={(e) => changeSlice('benchmarkPrice', e.target.value)} /></div>
            </label>
            <button className={styles.calculateButton} disabled={sliceBusy}>{sliceBusy ? 'Calculating…' : 'Calculate my $1.99 slice'}</button>
          </form>

          {sliceResult && (
            <div className={styles.resultArea}>
              <div className={styles.resultGrid}>
                <ResultCard label="YOUR TEST SLICE" value={money(sliceResult.amountCents)} note="same starting amount" />
                <ResultCard label="MATH-ONLY FRACTION" value={percent(sliceResult.hypotheticalPercent)} note={`${sliceResult.hypotheticalPartsPerMillion} ppm of reference price`} />
                <ResultCard label="PRICE VS BENCHMARK" value={indexLabel(sliceResult.relativePropertyPriceIndex)} note={sliceResult.relativePropertyPriceIndex > 1 ? 'selected property costs more' : sliceResult.relativePropertyPriceIndex < 1 ? 'selected property costs less' : 'same reference price'} />
                <ResultCard label="BENCHMARK EQUIVALENT" value={money(sliceResult.benchmarkEquivalentCents)} note="same mathematical fraction of benchmark" />
              </div>
              <div className={styles.warningBox}>
                <strong>What you bought in this test: nothing legal yet.</strong>
                <span>{sliceResult.note}</span>
              </div>
            </div>
          )}
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <div>
              <div className={styles.kicker}>ONE VAULT · FOUR ASSET TYPES</div>
              <h2>Make NFTs useful without pretending they are cash.</h2>
            </div>
            <button className={styles.walletButton} type="button" onClick={connect}>{connected ? shortWallet : 'Connect wallet'}</button>
          </div>

          <form onSubmit={previewMoney} className={styles.balanceGrid}>
            <BalanceInput label="Settled USD" value={moneyInputs.usd} onChange={(value) => changeMoney('usd', value)} />
            <BalanceInput label="Crypto value" value={moneyInputs.crypto} onChange={(value) => changeMoney('crypto', value)} />
            <BalanceInput label="NFT estimated value" value={moneyInputs.nft} onChange={(value) => changeMoney('nft', value)} />
            <BalanceInput label="Property goal" value={moneyInputs.property} onChange={(value) => changeMoney('property', value)} />
            <button className={styles.calculateButton} disabled={moneyBusy}>{moneyBusy ? 'Updating…' : 'Preview unified balance'}</button>
          </form>

          {moneyResult && (
            <div className={styles.moneyPreview}>
              <div className={styles.bigBalance}>
                <small>ESTIMATED VAULT VIEW</small>
                <strong>{money(moneyResult.balances.estimatedTotalCents)}</strong>
                <span>Spendable now: {money(moneyResult.spendableNowCents)} settled USD</span>
              </div>
              <div className={styles.routeList}>
                {moneyResult.conversionRoutes.map((route) => (
                  <div key={`${route.from}-${route.to}`} className={styles.routeRow}>
                    <b>{route.from.toUpperCase()} → {route.to.toUpperCase()}</b>
                    <span>{route.description}</span>
                    <small>{route.status.replaceAll('_', ' ')}</small>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className={styles.architecture}>
          <div><span>1</span><b>3D property</b><small>source-backed GEO twin</small></div>
          <div><span>2</span><b>Property rights</b><small>verified provider / legal entity</small></div>
          <div><span>3</span><b>NFT layer</b><small>optional collectible or rights token</small></div>
          <div><span>4</span><b>Crypto wallet</b><small>user-controlled first</small></div>
          <div><span>5</span><b>USD account</b><small>bank/payment partner required live</small></div>
        </section>

        <div className={styles.status}>{message}</div>

        <footer className={styles.footer}>
          <strong>Voxel Vault is the interface—not automatically the bank, broker, exchange, custodian or deed registry.</strong>
          <p>Live customer USD, crypto exchange/custody, tokenized securities and real-property interests must stay provider-backed and separately verified. The product can still feel like one account while those rails remain legally distinct underneath.</p>
        </footer>
      </div>
    </main>
  );
}

function AssetTile({ icon, label, value, note }) {
  return <div className={styles.assetTile}><span className={styles.assetIcon}>{icon}</span><div><small>{label}</small><strong>{value}</strong><em>{note}</em></div></div>;
}

function ResultCard({ label, value, note }) {
  return <div className={styles.resultCard}><small>{label}</small><strong>{value}</strong><span>{note}</span></div>;
}

function BalanceInput({ label, value, onChange }) {
  return <label><span>{label}</span><div className={styles.moneyInput}><b>$</b><input inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} /></div></label>;
}
