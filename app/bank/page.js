'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import ProductTopNav from '../components/ProductTopNav';
import styles from './bank.module.css';

const STORAGE_KEY = 'voxel-vault:galactic-trust-sandbox:v1';
const START = {
  checking: 824063,
  savings: 430000,
  frozen: false,
  activity: [
    { id: 1, name: 'Voxel Vault Creator', detail: 'Demo income', amount: 24500 },
    { id: 2, name: 'Cloud Compute', detail: 'Demo card', amount: -3200 },
    { id: 3, name: 'Property pocket', detail: 'Demo savings', amount: -12500 },
  ],
};

const money = (cents) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);

export default function GalacticTrustPage() {
  const [bank, setBank] = useState(START);
  const [hidden, setHidden] = useState(false);
  const [amount, setAmount] = useState('250');
  const [direction, setDirection] = useState('checking-to-savings');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) setBank({ ...START, ...JSON.parse(saved) });
    } catch {}
  }, []);

  useEffect(() => {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(bank)); } catch {}
  }, [bank]);

  const total = useMemo(() => bank.checking + bank.savings, [bank]);

  function moveMoney() {
    const cents = Math.round(Number(amount) * 100);
    if (!Number.isFinite(cents) || cents <= 0) return setNotice('Enter a valid demo amount.');
    const fromChecking = direction === 'checking-to-savings';
    const source = fromChecking ? bank.checking : bank.savings;
    if (cents > source) return setNotice('That is more than the available demo balance.');
    setBank((current) => ({
      ...current,
      checking: current.checking + (fromChecking ? -cents : cents),
      savings: current.savings + (fromChecking ? cents : -cents),
      activity: [{ id: Date.now(), name: 'Galactic transfer', detail: 'Demo internal transfer', amount: 0 }, ...current.activity].slice(0, 6),
    }));
    setNotice('Demo funds moved instantly.');
  }

  function addDemoFunds() {
    setBank((current) => ({
      ...current,
      checking: current.checking + 25000,
      activity: [{ id: Date.now(), name: 'Demo deposit', detail: 'Sandbox credit', amount: 25000 }, ...current.activity].slice(0, 6),
    }));
    setNotice('$250 demo credit added.');
  }

  return (
    <main className={styles.page}>
      <ProductTopNav />
      <div className={styles.shell}>
        <header className={styles.hero}>
          <div>
            <div className={styles.brandRow}><span className={styles.mark}>✦</span><strong>GALACTIC TRUST</strong><span className={styles.demo}>SANDBOX</span></div>
            <p className={styles.eyebrow}>A banking workspace inside Voxel Vault</p>
            <h1>Banking, built for your universe.</h1>
            <p className={styles.lead}>One beautiful place for spending, saving, cards and the money side of your Voxel Vault world.</p>
          </div>
          <Link className={styles.vaultLink} href="/vault">Open Voxel Vault →</Link>
        </header>

        <section className={styles.grid}>
          <article className={`${styles.panel} ${styles.balancePanel}`}>
            <div className={styles.panelTop}><span>Total demo balance</span><button onClick={() => setHidden((v) => !v)}>{hidden ? 'Show' : 'Hide'}</button></div>
            <div className={styles.balance}>{hidden ? '••••••' : money(total)}</div>
            <div className={styles.accounts}>
              <div><span>Orbit Checking</span><strong>{hidden ? '••••' : money(bank.checking)}</strong></div>
              <div><span>Nova Savings</span><strong>{hidden ? '••••' : money(bank.savings)}</strong></div>
            </div>
            <div className={styles.actions}>
              <button onClick={addDemoFunds}>＋ Add demo $250</button>
              <button onClick={() => { setDirection(direction === 'checking-to-savings' ? 'savings-to-checking' : 'checking-to-savings'); setNotice('Transfer direction flipped.'); }}>⇄ Flip transfer</button>
            </div>
          </article>

          <article className={`${styles.panel} ${styles.cardPanel}`}>
            <div className={styles.cardHeader}><span>Virtual card</span><span className={styles.liveDot}>● DEMO</span></div>
            <div className={`${styles.card} ${bank.frozen ? styles.frozen : ''}`}>
              <div className={styles.cardStars}>✦　✧　·</div>
              <div className={styles.cardName}>GALACTIC<br/>TRUST</div>
              <div className={styles.cardNumber}>••••　••••　••••　4821</div>
              <div className={styles.cardFoot}><span>VOXEL VAULT</span><span>12/29</span></div>
            </div>
            <button className={styles.freeze} onClick={() => setBank((current) => ({ ...current, frozen: !current.frozen }))}>{bank.frozen ? 'Unfreeze demo card' : 'Freeze demo card'}</button>
          </article>
        </section>

        <section className={styles.lowerGrid}>
          <article className={styles.panel}>
            <div className={styles.sectionTitle}><div><span>Move money</span><strong>Between your demo accounts</strong></div><span className={styles.spark}>✦</span></div>
            <div className={styles.transferBox}>
              <label>{direction === 'checking-to-savings' ? 'Orbit Checking → Nova Savings' : 'Nova Savings → Orbit Checking'}</label>
              <div className={styles.amountRow}><span>$</span><input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /><button onClick={moveMoney}>Move</button></div>
              {notice && <p className={styles.notice}>{notice}</p>}
            </div>
          </article>

          <article className={styles.panel}>
            <div className={styles.sectionTitle}><div><span>Recent activity</span><strong>Your sandbox ledger</strong></div><span>↗</span></div>
            <div className={styles.activity}>
              {bank.activity.map((item) => <div key={item.id} className={styles.activityRow}><div><strong>{item.name}</strong><span>{item.detail}</span></div><b className={item.amount >= 0 ? styles.positive : ''}>{item.amount === 0 ? 'Moved' : `${item.amount > 0 ? '+' : ''}${money(item.amount)}`}</b></div>)}
            </div>
          </article>
        </section>

        <section className={styles.pockets}>
          <div className={styles.pocketIntro}><span>SMART POCKETS</span><h2>Give every dollar a mission.</h2><p>Organize demo savings around what you are building next.</p></div>
          <div className={styles.pocket}><span>🏠</span><div><small>NEXT PROPERTY</small><strong>{money(Math.round(bank.savings * .52))}</strong></div></div>
          <div className={styles.pocket}><span>☁️</span><div><small>BUFFER</small><strong>{money(Math.round(bank.savings * .31))}</strong></div></div>
          <div className={styles.pocket}><span>✦</span><div><small>CREATE</small><strong>{money(Math.round(bank.savings * .17))}</strong></div></div>
        </section>

        <section className={styles.provider}>
          <div><span className={styles.eyebrow}>FROM SANDBOX TO REAL RAILS</span><h2>Galactic Trust is ready for a licensed provider layer.</h2><p>The interface is intentionally honest about money state. Real deposits, transfers and cards stay disabled until verified banking/payment infrastructure, identity controls, settlement and ledger sources are connected.</p></div>
          <div className={styles.checklist}><span>01 · Banking / payments partner</span><span>02 · Identity + account security</span><span>03 · Source-backed ledger + settlement</span><span>04 · Card issuance + money movement</span></div>
        </section>

        <footer className={styles.disclosure}><strong>Galactic Trust sandbox disclosure.</strong> Demo balances are fictional and are not cash, deposits, stored value, or FDIC-insured funds. Galactic Trust is a Voxel Vault demo banking workspace and is not represented as a chartered bank.</footer>
      </div>
    </main>
  );
}
