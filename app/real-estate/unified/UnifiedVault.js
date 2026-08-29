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
  { id: 'starter', label: 'Starter home', estimatedValue: 250000, icon: '🏠' },
  { id: 'small', label: 'Small home', estimatedValue: 125000, icon: '🏡' },
  { id: 'large', label: 'Large home', estimatedValue: 500000, icon: '🏘️' },
  { id: 'mixed', label: 'City building', estimatedValue: 1250000, icon: '🏢' },
];

const referenceProperty = demoProperties[0];
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
  const [selectedId, setSelectedId] = useState(referenceProperty.id);
  const [mintLater, setMintLater] = useState(false);
  const [wallet, setWallet] = useState(defaultState);
  const [loaded, setLoaded] = useState(false);
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

  const propertyRows = useMemo(() => demoProperties.map(property => ({
    ...property,
    quote: quoteDigitalPropertyUnit({
      referencePropertyValue: referenceProperty.estimatedValue,
      propertyValue: property.estimatedValue,
      baselineCents: DIGITAL_PROPERTY_BASELINE_CENTS,
    }),
  })), []);

  const selectedProperty = propertyRows.find(item => item.id === selectedId) || propertyRows[0];
  const quote = selectedProperty.quote;
  const latestUnit = wallet.units.at(-1) || null;
  const portfolioCents = wallet.units.reduce((sum, unit) => sum + Number(unit.purchasePriceCents || 0), 0);
  const totalDemoValueCents = wallet.usdCents + Math.round(wallet.usdc * 100) + portfolioCents;

  function chooseProperty(property) {
    setSelectedId(property.id);
    setStatus('');
  }

  function testBuy() {
    if (!quote.ready || quote.priceCents == null) return;
    if (wallet.usdCents < quote.priceCents) {
      setStatus('Not enough demo USD. Reset the sandbox or choose a lower-priced property.');
      return;
    }

    const unit = {
      id: crypto.randomUUID(),
      propertyId: selectedProperty.id,
      label: selectedProperty.label,
      propertyValue: selectedProperty.estimatedValue,
      referenceValue: referenceProperty.estimatedValue,
      pricingSource: 'demo-property-data',
      purchasePriceCents: quote.priceCents,
      mintPreference: mintLater ? 'mint-later' : 'offchain',
      acquiredAt: new Date().toISOString(),
    };

    setWallet(current => ({
      ...current,
      usdCents: current.usdCents - quote.priceCents,
      units: [...current.units, unit],
    }));
    setStatus(`Done — ${unit.label} is now in your demo Vault.`);
  }

  function simulateConversion(target) {
    if (!latestUnit) return;
    const cents = Math.max(0, Number(latestUnit.purchasePriceCents || 0));
    setWallet(current => {
      const units = current.units.slice(0, -1);
      if (target === 'USDC') return { ...current, units, usdc: current.usdc + cents / 100 };
      return { ...current, units, usdCents: current.usdCents + cents };
    });
    setStatus(`Demo sale complete → ${target}.`);
  }

  function resetDemo() {
    setWallet(defaultState());
    setSelectedId(referenceProperty.id);
    setMintLater(false);
    setStatus('Sandbox reset to $25.00.');
  }

  return (
    <section className={styles.workspace}>
      <section className={styles.card}>
        <div className={styles.startBadge}>START HERE</div>

        <div className={styles.stepBlock}>
          <div className={styles.stepHead}>
            <span>1</span>
            <div>
              <h2>Pick a property.</h2>
              <p>Voxel Vault handles the property data and digital price automatically.</p>
            </div>
          </div>

          <div className={styles.propertyGrid}>
            {propertyRows.map(property => (
              <button key={property.id} type="button" className={selectedId === property.id ? styles.propertyActive : ''} onClick={() => chooseProperty(property)}>
                <span className={styles.propertyIcon}>{property.icon}</span>
                <b>{property.label}</b>
                <strong>{property.quote.ready ? money.format(property.quote.priceCents / 100) : 'PRICE UNAVAILABLE'}</strong>
                {selectedId === property.id && <small>SELECTED</small>}
              </button>
            ))}
          </div>

          <small className={styles.micro}>You never type what a property is worth. This demo uses sample property values; the live version should use source-backed property data and show “Price unavailable” when that data is missing.</small>
        </div>

        <div className={styles.stepDivider} />

        <div className={styles.stepBlock}>
          <div className={styles.stepHead}>
            <span>2</span>
            <div>
              <h2>Buy its digital version.</h2>
              <p>That’s the only action you need to take.</p>
            </div>
          </div>

          <div className={styles.selectedBuy}>
            <div className={styles.selectedProperty}>
              <span>{selectedProperty.icon}</span>
              <div><small>YOU PICKED</small><b>{selectedProperty.label}</b></div>
            </div>
            <strong>{quote.ready ? money.format(quote.priceCents / 100) : '—'}</strong>
          </div>

          <details className={styles.nftOption}>
            <summary>Optional: make it an NFT later</summary>
            <label><input type="checkbox" checked={mintLater} onChange={event => setMintLater(event.target.checked)} /><span>Remember that I may want to mint this later.</span></label>
          </details>

          <button className={styles.primaryButton} type="button" onClick={testBuy} disabled={!quote.ready}>
            BUY FOR {quote.ready ? money.format(quote.priceCents / 100) : '—'} →
          </button>
          <small className={styles.micro}>Demo money only. No card, bank, crypto wallet, blockchain transaction or deed transfer.</small>
        </div>
      </section>

      {!latestUnit && (
        <section className={styles.afterCard}>
          <span>HOW PRICING WORKS</span>
          <p>The demo uses the Starter home as the <b>$1.99 reference</b> and automatically scales the other digital-property prices. In the real property search flow, Voxel Vault should pull the reference value from trustworthy property data — not from you.</p>
        </section>
      )}

      {latestUnit && (
        <section className={styles.successCard}>
          <div className={styles.successTop}>
            <span className={styles.doneMark}>✓</span>
            <div><small>STEP 3 · DONE</small><h2>It’s in your Vault.</h2></div>
          </div>

          <div className={styles.ownedProperty}>
            <span>◇</span>
            <div><small>LATEST PROPERTY</small><b>{latestUnit.label}</b><p>{money.format(Number(latestUnit.purchasePriceCents || 0) / 100)} demo digital value</p></div>
          </div>

          <div className={styles.vaultBalance}>
            <div><small>USD</small><b>{money.format(wallet.usdCents / 100)}</b></div>
            <div><small>USDC</small><b>{wallet.usdc.toFixed(2)}</b></div>
            <div><small>PROPERTIES</small><b>{wallet.units.length}</b></div>
            <div><small>TOTAL</small><b>{money.format(totalDemoValueCents / 100)}</b></div>
          </div>

          <p className={styles.nextPrompt}>Now you can test what selling it would feel like.</p>
          <div className={styles.convertButtons}>
            <button type="button" onClick={() => simulateConversion('USD')}>SELL → USD</button>
            <button type="button" onClick={() => simulateConversion('USDC')}>SELL → USDC</button>
          </div>
        </section>
      )}

      <details className={styles.advanced}>
        <summary>Advanced details</summary>
        <div>
          <p><b>Pricing:</b> users should never self-report the property value. A live relative price should only use trustworthy source-backed property data; otherwise pricing stays unavailable.</p>
          <p><b>NFT:</b> optional. The digital asset can exist without minting.</p>
          <p><b>USD:</b> live deposits/withdrawals would need a regulated financial partner.</p>
          <p><b>Crypto:</b> live custody/exchange would need an authorized provider.</p>
          <p><b>Real estate:</b> a real investment or deed only appears after a separate verified legal path creates those rights.</p>
          <button type="button" onClick={resetDemo}>Reset demo</button>
        </div>
      </details>

      {status && <div className={styles.status} role="status"><span>✦</span><p>{status}</p><button type="button" onClick={() => setStatus('')}>×</button></div>}
    </section>
  );
}
