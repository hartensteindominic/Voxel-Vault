'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  DIGITAL_PROPERTY_BASELINE_CENTS,
  explainDigitalPropertyQuote,
  quoteDigitalPropertyUnit,
} from '../../../lib/real-estate/digital-property-unit';
import styles from './unified.module.css';

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});

const demoProperties = [
  { id: 'anchor', label: 'My reference property', market: 'Your anchor', estimatedValue: 250000, icon: '🏠' },
  { id: 'small', label: 'Neighborhood home', market: 'Demo property', estimatedValue: 125000, icon: '🏡' },
  { id: 'large', label: 'Large city home', market: 'Demo property', estimatedValue: 500000, icon: '🏘️' },
  { id: 'mixed', label: 'Mixed-use building', market: 'Demo property', estimatedValue: 1250000, icon: '🏢' },
];

const storageKey = 'voxelvault:unified-property-wallet:v1';

function defaultState() {
  return {
    usdCents: 2500,
    usdc: 0,
    units: [],
  };
}

function safeState(value) {
  if (!value || typeof value !== 'object') return defaultState();
  return {
    usdCents: Number.isFinite(Number(value.usdCents)) ? Math.max(0, Math.round(Number(value.usdCents))) : 2500,
    usdc: Number.isFinite(Number(value.usdc)) ? Math.max(0, Number(value.usdc)) : 0,
    units: Array.isArray(value.units) ? value.units.filter(Boolean).slice(0, 100) : [],
  };
}

export default function UnifiedVault() {
  const [referenceValue, setReferenceValue] = useState(250000);
  const [selectedId, setSelectedId] = useState('anchor');
  const [selectedValue, setSelectedValue] = useState(250000);
  const [mintLater, setMintLater] = useState(false);
  const [wallet, setWallet] = useState(defaultState);
  const [loaded, setLoaded] = useState(false);
  const [conversionTarget, setConversionTarget] = useState('USD');
  const [status, setStatus] = useState('');

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setWallet(safeState(JSON.parse(raw)));
    } catch {}
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem(storageKey, JSON.stringify(wallet)); } catch {}
  }, [loaded, wallet]);

  const quote = useMemo(() => quoteDigitalPropertyUnit({
    referencePropertyValue: referenceValue,
    propertyValue: selectedValue,
    baselineCents: DIGITAL_PROPERTY_BASELINE_CENTS,
  }), [referenceValue, selectedValue]);

  const propertyRows = useMemo(() => demoProperties.map(property => ({
    ...property,
    quote: quoteDigitalPropertyUnit({
      referencePropertyValue: referenceValue,
      propertyValue: property.id === 'anchor' ? referenceValue : property.estimatedValue,
      baselineCents: DIGITAL_PROPERTY_BASELINE_CENTS,
    }),
  })), [referenceValue]);

  const latestUnit = wallet.units.at(-1) || null;
  const portfolioCents = wallet.units.reduce((sum, unit) => sum + Number(unit.purchasePriceCents || 0), 0);
  const totalDemoValueCents = wallet.usdCents + Math.round(wallet.usdc * 100) + portfolioCents;

  function chooseProperty(property) {
    setSelectedId(property.id);
    setSelectedValue(property.id === 'anchor' ? referenceValue : property.estimatedValue);
    setStatus('');
  }

  function updateReference(raw) {
    const next = Math.max(1, Number(raw || 0));
    setReferenceValue(next);
    if (selectedId === 'anchor') setSelectedValue(next);
  }

  function testBuy() {
    if (!quote.ready || quote.priceCents == null) return;
    if (wallet.usdCents < quote.priceCents) {
      setStatus('Sandbox USD balance is too low. Reset the demo or choose a lower-priced property unit.');
      return;
    }

    const selected = demoProperties.find(item => item.id === selectedId);
    const unit = {
      id: crypto.randomUUID(),
      propertyId: selectedId,
      label: selected?.label || 'Custom property',
      propertyValue: selectedValue,
      referenceValue,
      purchasePriceCents: quote.priceCents,
      mintPreference: mintLater ? 'mint-later' : 'offchain',
      acquiredAt: new Date().toISOString(),
    };

    setWallet(current => ({
      ...current,
      usdCents: current.usdCents - quote.priceCents,
      units: [...current.units, unit],
    }));
    setStatus(`Sandbox purchase complete: ${unit.label} for ${money.format(quote.priceCents / 100)}. No real property rights or live funds moved.`);
  }

  function simulateConversion() {
    if (!latestUnit) {
      setStatus('Test-buy a digital property unit first.');
      return;
    }

    const cents = Math.max(0, Number(latestUnit.purchasePriceCents || 0));
    setWallet(current => {
      const units = current.units.slice(0, -1);
      if (conversionTarget === 'USDC') {
        return { ...current, units, usdc: current.usdc + cents / 100 };
      }
      return { ...current, units, usdCents: current.usdCents + cents };
    });

    setStatus(`Simulated market sale of one digital unit into demo ${conversionTarget}. This is not guaranteed redemption or a live exchange.`);
  }

  function resetDemo() {
    setWallet(defaultState());
    setStatus('Sandbox wallet reset to $25.00 demo USD.');
  }

  return (
    <section className={styles.workspace}>
      <div className={styles.sectionTitle}>
        <div>
          <span>UNIFIED VAULT</span>
          <h2>Property, dollars, crypto and NFTs in one place.</h2>
        </div>
        <div className={styles.totalBalance}>
          <small>DEMO TOTAL</small>
          <b>{money.format(totalDemoValueCents / 100)}</b>
        </div>
      </div>

      <div className={styles.balanceGrid}>
        <BalanceCard icon="$" label="USD cash" value={money.format(wallet.usdCents / 100)} detail="Sandbox ledger · bank partner not connected" />
        <BalanceCard icon="◉" label="Crypto" value={`${wallet.usdc.toFixed(2)} USDC`} detail="Sandbox balance · custody/exchange gated" />
        <BalanceCard icon="◇" label="NFT / 3D" value={`${wallet.units.filter(unit => unit.mintPreference === 'mint-later').length} queued`} detail="NFT is optional; digital asset works without minting" />
        <BalanceCard icon="⌂" label="Property units" value={`${wallet.units.length}`} detail={`${money.format(portfolioCents / 100)} sandbox acquisition cost`} />
      </div>

      <div className={styles.mainGrid}>
        <article className={styles.card}>
          <div className={styles.cardHead}>
            <div><span>01 · PRICE ENGINE</span><h3>Make your property the $1.99 anchor.</h3></div>
            <strong>$1.99</strong>
          </div>

          <label className={styles.field}>
            <span>My reference property value</span>
            <div className={styles.moneyInput}><b>$</b><input inputMode="decimal" type="number" min="1" step="1000" value={referenceValue} onChange={event => updateReference(event.target.value)} /></div>
          </label>

          <p className={styles.help}>The test formula is simple: <b>$1.99 × selected property value ÷ your reference property value.</b> It is a catalog-price experiment, not an appraisal, security price or promise that the collectible will appreciate.</p>

          <div className={styles.propertyList}>
            {propertyRows.map(property => (
              <button key={property.id} type="button" className={selectedId === property.id ? styles.propertyActive : ''} onClick={() => chooseProperty(property)}>
                <span className={styles.propertyIcon}>{property.icon}</span>
                <span className={styles.propertyName}><b>{property.label}</b><small>{money.format((property.id === 'anchor' ? referenceValue : property.estimatedValue))} reference value · {property.market}</small></span>
                <strong>{property.quote.ready ? money.format(property.quote.priceCents / 100) : '—'}</strong>
              </button>
            ))}
          </div>
        </article>

        <article className={`${styles.card} ${styles.buyCard}`}>
          <div className={styles.cardHead}>
            <div><span>02 · TEST BUY</span><h3>Buy the digital unit.</h3></div>
            <span className={styles.sandboxBadge}>SANDBOX</span>
          </div>

          <div className={styles.bigPrice}>{quote.ready ? money.format(quote.priceCents / 100) : '—'}</div>
          <p className={styles.quoteExplanation}>{explainDigitalPropertyQuote(quote)}</p>

          <div className={styles.receipt}>
            <Row label="Digital property unit" value={quote.ready ? money.format(quote.priceCents / 100) : '—'} />
            <Row label="Real-property ownership" value="None" />
            <Row label="Rent / income rights" value="None" />
            <Row label="NFT" value={mintLater ? 'Optional · mint later' : 'Off'} />
            <Row label="Payment" value="Demo USD only" />
          </div>

          <label className={styles.toggleRow}>
            <input type="checkbox" checked={mintLater} onChange={event => setMintLater(event.target.checked)} />
            <span><b>Make NFT optional</b><small>Keep the asset off-chain now; mint later only if you choose.</small></span>
          </label>

          <button className={styles.primaryButton} type="button" onClick={testBuy} disabled={!quote.ready}>TEST BUY {quote.ready ? money.format(quote.priceCents / 100) : ''}</button>
          <small className={styles.disclosure}>No Stripe charge, bank debit, blockchain transaction or deed transfer occurs in this prototype.</small>
        </article>
      </div>

      <div className={styles.mainGrid}>
        <article className={styles.card}>
          <div className={styles.cardHead}>
            <div><span>03 · CONVERT</span><h3>Make digital assets useful.</h3></div>
            <strong>↔</strong>
          </div>
          <p className={styles.help}>The long-term action is one button: <b>Sell / convert</b>. Underneath, Voxel Vault routes to the correct marketplace, licensed crypto provider or cash partner. The NFT itself is not magically redeemable; conversion needs a real buyer or provider quote.</p>

          <div className={styles.convertBox}>
            <div>
              <small>SELL LATEST DIGITAL UNIT</small>
              <b>{latestUnit ? latestUnit.label : 'No unit yet'}</b>
              <span>{latestUnit ? money.format(Number(latestUnit.purchasePriceCents || 0) / 100) + ' demo cost basis' : 'Test-buy one above'}</span>
            </div>
            <div className={styles.convertTargets}>
              <button type="button" className={conversionTarget === 'USD' ? styles.targetActive : ''} onClick={() => setConversionTarget('USD')}>USD</button>
              <button type="button" className={conversionTarget === 'USDC' ? styles.targetActive : ''} onClick={() => setConversionTarget('USDC')}>USDC</button>
              <button type="button" disabled title="A live ETH conversion requires a current exchange quote and regulated execution provider.">ETH · LIVE QUOTE</button>
            </div>
            <button type="button" className={styles.secondaryButton} onClick={simulateConversion} disabled={!latestUnit}>SIMULATE SALE → {conversionTarget}</button>
          </div>
        </article>

        <article className={styles.card}>
          <div className={styles.cardHead}>
            <div><span>04 · LIVE PROVIDERS</span><h3>One UI. Separate regulated rails.</h3></div>
            <strong>LOCKED</strong>
          </div>
          <div className={styles.providerList}>
            <Provider label="USD deposits + ACH" detail="Partner bank / regulated program manager" />
            <Provider label="Crypto custody + exchange" detail="Licensed virtual-currency provider" />
            <Provider label="Tokenized real-estate investment" detail="Registered securities intermediary / approved offering" />
            <Provider label="Real property deed + title" detail="Normal title, closing and county recording" />
          </div>
          <div className={styles.ruleBox}><b>Product rule</b><span>The front end can feel like one account. The backend must preserve which legal entity actually holds each asset and which provider is authoritative for settlement.</span></div>
        </article>
      </div>

      {status && <div className={styles.status} role="status"><span>✦</span><p>{status}</p><button type="button" onClick={() => setStatus('')}>×</button></div>}

      <div className={styles.demoActions}>
        <button type="button" onClick={resetDemo}>Reset sandbox</button>
        <a href="/real-estate/launch">View legal launch gates</a>
        <a href="/vault">Open current Vault</a>
      </div>
    </section>
  );
}

function BalanceCard({ icon, label, value, detail }) {
  return <article className={styles.balanceCard}><span>{icon}</span><div><small>{label}</small><b>{value}</b><p>{detail}</p></div></article>;
}

function Row({ label, value }) {
  return <div className={styles.receiptRow}><span>{label}</span><b>{value}</b></div>;
}

function Provider({ label, detail }) {
  return <div className={styles.provider}><span>○</span><div><b>{label}</b><small>{detail}</small></div><em>NOT CONNECTED</em></div>;
}
