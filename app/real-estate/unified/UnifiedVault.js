'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  DIGITAL_PROPERTY_BASELINE_CENTS,
  quoteDigitalPropertyUnit,
} from '../../../lib/real-estate/digital-property-unit';
import styles from './unified.module.css';

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});

const demoProperties = [
  { id: 'anchor', label: 'My property', estimatedValue: 250000, icon: '🏠' },
  { id: 'small', label: 'Small home', estimatedValue: 125000, icon: '🏡' },
  { id: 'large', label: 'Large home', estimatedValue: 500000, icon: '🏘️' },
  { id: 'mixed', label: 'City building', estimatedValue: 1250000, icon: '🏢' },
];

const storageKey = 'voxelvault:unified-property-wallet:v1';

function defaultState() {
  return { usdCents: 2500, usdc: 0, units: [] };
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
      setStatus('Not enough demo USD. Reset the sandbox or choose a lower-priced property.');
      return;
    }

    const selected = demoProperties.find(item => item.id === selectedId);
    const unit = {
      id: crypto.randomUUID(),
      propertyId: selectedId,
      label: selected?.label || 'Digital property',
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
    setStatus(`Added ${unit.label} to your demo Vault for ${money.format(quote.priceCents / 100)}.`);
  }

  function simulateConversion() {
    if (!latestUnit) {
      setStatus('Buy a digital property first.');
      return;
    }

    const cents = Math.max(0, Number(latestUnit.purchasePriceCents || 0));
    setWallet(current => {
      const units = current.units.slice(0, -1);
      if (conversionTarget === 'USDC') return { ...current, units, usdc: current.usdc + cents / 100 };
      return { ...current, units, usdCents: current.usdCents + cents };
    });
    setStatus(`Demo sale complete → ${conversionTarget}.`);
  }

  function resetDemo() {
    setWallet(defaultState());
    setStatus('Sandbox reset to $25.00.');
  }

  return (
    <section className={styles.workspace}>
      <section className={styles.walletStrip}>
        <div><small>MY VAULT</small><b>{money.format(totalDemoValueCents / 100)}</b></div>
        <div className={styles.walletMini}><span>USD</span><b>{money.format(wallet.usdCents / 100)}</b></div>
        <div className={styles.walletMini}><span>USDC</span><b>{wallet.usdc.toFixed(2)}</b></div>
        <div className={styles.walletMini}><span>PROPERTY</span><b>{wallet.units.length}</b></div>
      </section>

      <section className={styles.card}>
        <div className={styles.stepHead}>
          <span>1</span>
          <div><h2>Pick a property.</h2><p>Your property stays the $1.99 reference.</p></div>
        </div>

        <label className={styles.referenceField}>
          <span>My property value</span>
          <div><b>$</b><input inputMode="decimal" type="number" min="1" step="1000" value={referenceValue} onChange={event => updateReference(event.target.value)} /></div>
        </label>

        <div className={styles.propertyGrid}>
          {propertyRows.map(property => (
            <button key={property.id} type="button" className={selectedId === property.id ? styles.propertyActive : ''} onClick={() => chooseProperty(property)}>
              <span className={styles.propertyIcon}>{property.icon}</span>
              <b>{property.label}</b>
              <strong>{property.quote.ready ? money.format(property.quote.priceCents / 100) : '—'}</strong>
            </button>
          ))}
        </div>

        <div className={styles.buyBox}>
          <div><small>DIGITAL PROPERTY</small><b>{quote.ready ? money.format(quote.priceCents / 100) : '—'}</b></div>
          <label className={styles.nftToggle}><input type="checkbox" checked={mintLater} onChange={event => setMintLater(event.target.checked)} /><span>Mint later</span></label>
        </div>

        <button className={styles.primaryButton} type="button" onClick={testBuy} disabled={!quote.ready}>BUY TEST PROPERTY →</button>
        <small className={styles.micro}>Demo only. No real house, deed, bank debit or blockchain transaction happens here.</small>
      </section>

      <section className={styles.quickGrid}>
        <article className={styles.quickCard}>
          <span className={styles.quickIcon}>◇</span>
          <div><h3>My property</h3><p>{latestUnit ? latestUnit.label : 'Nothing collected yet.'}</p></div>
        </article>

        <article className={styles.quickCard}>
          <span className={styles.quickIcon}>↔</span>
          <div className={styles.convertContent}>
            <h3>Sell / convert</h3>
            <div className={styles.segmented}>
              <button type="button" className={conversionTarget === 'USD' ? styles.segmentActive : ''} onClick={() => setConversionTarget('USD')}>USD</button>
              <button type="button" className={conversionTarget === 'USDC' ? styles.segmentActive : ''} onClick={() => setConversionTarget('USDC')}>USDC</button>
            </div>
            <button className={styles.convertButton} type="button" disabled={!latestUnit} onClick={simulateConversion}>CONVERT → {conversionTarget}</button>
          </div>
        </article>
      </section>

      <details className={styles.advanced}>
        <summary>Advanced</summary>
        <div>
          <p><b>NFT:</b> optional. The digital asset can exist without minting.</p>
          <p><b>USD:</b> live deposits/withdrawals would need a regulated financial partner.</p>
          <p><b>Crypto:</b> live custody/exchange would need an authorized provider.</p>
          <p><b>Real estate:</b> a real investment or deed only appears after a separate verified legal path creates those rights.</p>
          <button type="button" onClick={resetDemo}>Reset sandbox</button>
        </div>
      </details>

      {status && <div className={styles.status} role="status"><span>✦</span><p>{status}</p><button type="button" onClick={() => setStatus('')}>×</button></div>}
    </section>
  );
}
