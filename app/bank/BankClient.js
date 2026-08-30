'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { buildOrbitResponse } from '../../lib/banking/orbit-chat.js';

const navItems = [
  ['dashboard', '⌂', 'Dashboard'],
  ['accounts', '▣', 'Accounts'],
  ['transfer', '⇄', 'Transfer'],
  ['add-money', '✣', 'Add Money'],
  ['cards', '▤', 'Cards'],
  ['crypto', '◈', 'Crypto'],
  ['rewards', '✿', 'Rewards'],
];

const starterTransactions = [
  { id: 1, icon: 'a', name: 'Amazon.com', category: 'Shopping', amount: -89.32, date: 'Today', tone: 'dark' },
  { id: 2, icon: '●', name: 'Spotify Premium', category: 'Entertainment', amount: -11.99, date: 'May 18', tone: 'green' },
  { id: 3, icon: '↓', name: 'Transfer from Alex', category: 'Incoming Transfer', amount: 200, date: 'May 18', tone: 'purple' },
  { id: 4, icon: '☕', name: 'Star Coffee', category: 'Food & Drinks', amount: -6.45, date: 'May 17', tone: 'sage' },
  { id: 5, icon: '▰', name: 'Payroll Direct Deposit', category: 'Income', amount: 2850, date: 'May 15', tone: 'blue' },
];

const starterCrypto = [
  { symbol: 'BTC', name: 'Bitcoin', price: 68240.18, holding: 0.0142 },
  { symbol: 'ETH', name: 'Ethereum', price: 3648.72, holding: 0.63 },
  { symbol: 'USDC', name: 'USD Coin', price: 1, holding: 425.5 },
];

const insightTones = ['purple', 'green', 'teal', 'coral', 'blue'];

function money(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function displayName(value) {
  const text = String(value || 'Galactic member').trim();
  if (!text) return 'Galactic member';
  if (text.includes('@')) return text.split('@')[0].slice(0, 28);
  return text.slice(0, 28);
}

function PlanetLogo() {
  return (
    <span className="gt-planet-logo" aria-hidden="true">
      <span className="gt-planet-body" />
      <span className="gt-planet-ring" />
      <span className="gt-planet-star">★</span>
    </span>
  );
}

function Sparkline({ tone = 'blue' }) {
  const path = tone === 'blue'
    ? 'M2 34 C18 27, 24 39, 40 31 S62 32, 78 24 S98 30, 114 20 S134 14, 148 26 S165 9, 181 12 S199 6, 216 0'
    : 'M2 35 C16 32, 26 39, 42 33 S64 36, 78 30 S96 33, 111 22 S126 27, 142 18 S157 23, 171 12 S188 5, 201 17 S212 10, 220 4';
  return (
    <svg className={`gt-sparkline ${tone}`} viewBox="0 0 222 40" role="img" aria-label="Account balance trend">
      <path d={path} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

function GalacticCard({ pink = false, frozen = false, onFreeze }) {
  return (
    <article className={`gt-bank-card ${pink ? 'pink' : 'blue'} ${frozen ? 'frozen' : ''}`}>
      <div className="gt-card-top"><span>★ GALACTIC TRUST</span><span className="gt-contactless">)))</span></div>
      {!pink && <div className="gt-card-planet" aria-hidden="true" />}
      <div className="gt-card-name">{pink ? 'Cosmic Pink' : 'Nebula Blue'}</div>
      <div className="gt-card-number">•••• {pink ? '8756' : '4532'}</div>
      <div className="gt-card-footer"><span>DEMO CARD</span><strong>PREVIEW</strong></div>
      {frozen && <span className="gt-frozen-label">FROZEN</span>}
      {onFreeze && <button className="gt-card-freeze" type="button" onClick={onFreeze}>{frozen ? 'Unfreeze' : 'Freeze'}</button>}
    </article>
  );
}

function OrbitChat({ sandboxConnected, checking, savings, transactions, accountLabel, blueFrozen, pinkFrozen }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Hi! I’m Orbit ✨ Ask me what your balance means, how to test a transfer, whether this is real money, how cards work, or anything about Galactic Trust.' },
  ]);

  const suggestions = sandboxConnected
    ? ['What’s my sandbox balance?', 'How do I test an ACH transfer?', 'Is this real money?']
    : ['What’s my balance?', 'How do transfers work?', 'Is Galactic Trust a bank?'];

  function replyTo(raw) {
    const message = String(raw || '').trim().slice(0, 500);
    if (!message) return;
    const response = buildOrbitResponse(message, {
      sandboxConnected,
      checking,
      savings,
      transactions,
      accountLabel,
      blueFrozen,
      pinkFrozen,
    });

    setMessages((current) => [
      ...current.slice(-14),
      { role: 'user', text: message },
      { role: 'assistant', text: response.text },
    ]);
    setInput('');
  }

  return (
    <div className={`gt-chat ${open ? 'open' : ''}`}>
      {open && (
        <section className="gt-chat-panel" aria-label="Orbit support assistant">
          <header className="gt-chat-header">
            <span className="gt-orbit-avatar">✦</span>
            <div><strong>Orbit</strong><small><i /> Galactic Trust assistant</small></div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close Orbit">×</button>
          </header>
          <div className="gt-chat-warning"><span>🔒</span><p>Never share passwords, PINs, CVVs, recovery codes, one-time codes, or API keys here.</p></div>
          <div className="gt-chat-messages" aria-live="polite">
            {messages.map((message, index) => <div key={`${message.role}-${index}`} className={`gt-chat-bubble ${message.role}`}>{message.text}</div>)}
          </div>
          <div className="gt-chat-suggestions">
            {suggestions.map((text) => <button key={text} type="button" onClick={() => replyTo(text)}>{text}</button>)}
          </div>
          <form className="gt-chat-form" onSubmit={(event) => { event.preventDefault(); replyTo(input); }}>
            <input value={input} maxLength={500} onChange={(event) => setInput(event.target.value)} placeholder="Ask Orbit anything…" aria-label="Message Orbit" autoComplete="off" />
            <button type="submit" disabled={!input.trim()} aria-label="Send">➤</button>
          </form>
        </section>
      )}
      <button className="gt-chat-launcher" type="button" onClick={() => setOpen((value) => !value)} aria-label={open ? 'Close Orbit' : 'Open Orbit'}>
        {open ? '×' : <><span>✦</span><i>1</i></>}
      </button>
    </div>
  );
}

export default function GalacticApp({ galacticUser = null, demoAccess = false, onSignOut, accountLabel = 'Galactic member', accessToken = '' }) {
  const [checking, setChecking] = useState(15230.45);
  const [savings, setSavings] = useState(9120.27);
  const [transactions, setTransactions] = useState(starterTransactions);
  const [sheet, setSheet] = useState(null);
  const [toast, setToast] = useState('');
  const [transfer, setTransfer] = useState({ recipient: '', amount: '' });
  const [blueFrozen, setBlueFrozen] = useState(false);
  const [pinkFrozen, setPinkFrozen] = useState(false);
  const [cryptoAssets, setCryptoAssets] = useState(starterCrypto);
  const [cryptoSymbol, setCryptoSymbol] = useState('BTC');
  const [cryptoSide, setCryptoSide] = useState('buy');
  const [cryptoAmount, setCryptoAmount] = useState('25');
  const [sandboxConnected, setSandboxConnected] = useState(false);
  const [sandboxAccounts, setSandboxAccounts] = useState([]);
  const [sandboxBusy, setSandboxBusy] = useState(false);
  const [sandboxNotice, setSandboxNotice] = useState('');

  const total = checking + savings;
  const activeCrypto = cryptoAssets.find((asset) => asset.symbol === cryptoSymbol) || cryptoAssets[0];
  const cryptoUsd = Number(cryptoAmount);
  const cryptoUnits = Number.isFinite(cryptoUsd) && cryptoUsd > 0 ? cryptoUsd / activeCrypto.price : 0;
  const spending = useMemo(() => transactions.filter((item) => item.amount < 0).reduce((sum, item) => sum + Math.abs(item.amount), 0), [transactions]);
  const spendingCategories = useMemo(() => {
    const totals = new Map();
    transactions.filter((item) => Number(item.amount) < 0).forEach((item) => {
      const category = String(item.category || 'Other').trim() || 'Other';
      totals.set(category, (totals.get(category) || 0) + Math.abs(Number(item.amount) || 0));
    });
    return [...totals.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 5)
      .map(([category, amount], index) => ({
        category,
        amount,
        percentage: spending > 0 ? Math.round((amount / spending) * 100) : 0,
        tone: insightTones[index % insightTones.length],
      }));
  }, [transactions, spending]);
  const memberName = displayName(demoAccess && !galacticUser ? 'Demo Explorer' : accountLabel);

  function applySandboxSnapshot(payload) {
    const accounts = Array.isArray(payload?.accounts) ? payload.accounts : [];
    if (!payload?.connected || !accounts.length) return false;
    setSandboxAccounts(accounts);
    setChecking(Number(accounts[0]?.currentBalance || 0));
    setSavings(Number(accounts[1]?.currentBalance || 0));
    setTransactions(Array.isArray(payload?.transactions) ? payload.transactions : []);
    setSandboxConnected(true);
    setSandboxNotice('Increase sandbox connected · pretend money only');
    return true;
  }

  useEffect(() => {
    let active = true;
    if (!accessToken || !galacticUser) return () => { active = false; };

    fetch('/api/admin/bank/increase/dashboard', {
      cache: 'no-store',
      headers: { Authorization: `Bearer ${accessToken}` },
    }).then(async (response) => {
      const payload = await response.json().catch(() => ({}));
      if (!active) return;
      if (response.ok) applySandboxSnapshot(payload);
      else if (response.status !== 403) setSandboxNotice(payload?.error || 'Increase sandbox is not connected yet.');
    }).catch(() => {
      if (active) setSandboxNotice('Increase sandbox is not connected yet.');
    });

    return () => { active = false; };
  }, [accessToken, galacticUser]);

  function notify(message) {
    setToast(message);
    window.setTimeout(() => setToast(''), 2600);
  }

  function openSheet(name) {
    setSheet(name);
    setToast('');
    window.setTimeout(() => document.getElementById('gt-action-sheet')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 40);
  }

  async function runSandboxAction(path, body) {
    if (!accessToken) return null;
    setSandboxBusy(true);
    try {
      const response = await fetch(path, {
        method: 'POST',
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'Increase sandbox action failed.');
      applySandboxSnapshot(payload);
      return payload;
    } finally {
      setSandboxBusy(false);
    }
  }

  async function submitTransfer(event) {
    event.preventDefault();
    const amount = Number(transfer.amount);
    const max = sandboxConnected ? 1000 : 10000;
    if (!transfer.recipient.trim() || !Number.isFinite(amount) || amount < (sandboxConnected ? 1 : 0.01) || amount > max) {
      notify(`Enter a recipient and an amount between ${sandboxConnected ? '$1' : '$0.01'} and ${money(max)}.`);
      return;
    }
    if (amount > checking) {
      notify(`The ${sandboxConnected ? 'sandbox' : 'demo'} checking balance is too low for that transfer.`);
      return;
    }

    if (sandboxConnected) {
      try {
        await runSandboxAction('/api/admin/bank/increase/transfer', { recipient: transfer.recipient.trim(), amount });
        setTransfer({ recipient: '', amount: '' });
        setSheet(null);
        notify('Increase sandbox ACH transfer settled. Pretend money only.');
      } catch (error) {
        notify(error instanceof Error ? error.message : 'Increase sandbox transfer failed.');
      }
      return;
    }

    setChecking((value) => value - amount);
    setTransactions((current) => [{ id: Date.now(), icon: '↑', name: transfer.recipient.trim(), category: 'Demo Transfer', amount: -amount, date: 'Just now', tone: 'purple' }, ...current]);
    setTransfer({ recipient: '', amount: '' });
    setSheet(null);
    notify('Demo transfer completed. No real money moved.');
  }

  async function addDemoMoney() {
    if (sandboxConnected) {
      try {
        await runSandboxAction('/api/admin/bank/increase/fund', { amount: 500 });
        setSheet(null);
        notify('Added $500 through an Increase sandbox inbound ACH simulation.');
      } catch (error) {
        notify(error instanceof Error ? error.message : 'Increase sandbox funding failed.');
      }
      return;
    }
    setChecking((value) => value + 500);
    setTransactions((current) => [{ id: Date.now(), icon: '+', name: 'Demo Add Money', category: 'Demo Funding', amount: 500, date: 'Just now', tone: 'blue' }, ...current]);
    setSheet(null);
    notify('Added $500 in demo funds.');
  }

  function submitCrypto(event) {
    event.preventDefault();
    if (!Number.isFinite(cryptoUsd) || cryptoUsd < 1 || cryptoUsd > 10000) {
      notify('Enter a crypto amount between $1 and $10,000.');
      return;
    }
    if (cryptoSide === 'sell' && cryptoUnits > activeCrypto.holding) {
      notify(`Your demo ${activeCrypto.symbol} balance is too low for that sell.`);
      return;
    }
    setCryptoAssets((current) => current.map((asset) => {
      if (asset.symbol !== activeCrypto.symbol) return asset;
      return { ...asset, holding: Math.max(0, asset.holding + (cryptoSide === 'buy' ? cryptoUnits : -cryptoUnits)) };
    }));
    notify(`Demo ${cryptoSide} completed. No real ${activeCrypto.symbol} was ${cryptoSide === 'buy' ? 'purchased' : 'sold'}.`);
  }

  function handleNav(id) {
    if (id === 'dashboard') window.scrollTo({ top: 0, behavior: 'smooth' });
    else if (id === 'accounts') document.getElementById('accounts')?.scrollIntoView({ behavior: 'smooth' });
    else if (id === 'transfer') openSheet('transfer');
    else if (id === 'add-money') openSheet('add-money');
    else if (id === 'cards') document.getElementById('cards')?.scrollIntoView({ behavior: 'smooth' });
    else if (id === 'crypto') document.getElementById('crypto')?.scrollIntoView({ behavior: 'smooth' });
    else if (id === 'rewards') document.getElementById('rewards')?.scrollIntoView({ behavior: 'smooth' });
  }

  return (
    <main className="gt-app">
      <aside className="gt-sidebar">
        <Link href="/" className="gt-brand" aria-label="Galactic Trust home"><PlanetLogo /><span>Galactic<br />Trust</span></Link>
        <nav className="gt-nav" aria-label="Primary navigation">
          {navItems.map(([id, icon, label], index) => (
            <button key={id} type="button" className={index === 0 ? 'active' : ''} onClick={() => handleNav(id)}><span>{icon}</span><b>{label}</b></button>
          ))}
        </nav>
        <div className="gt-sidebar-spacer" />
        <div className="gt-side-utilities">
          <button type="button" onClick={() => document.getElementById('security')?.scrollIntoView({ behavior: 'smooth' })}><span>⚙</span><b>Settings</b></button>
          <button type="button" onClick={() => document.getElementById('security')?.scrollIntoView({ behavior: 'smooth' })}><span>◉</span><b>Security & Privacy</b></button>
          <button type="button" onClick={() => notify('Orbit is available in the bottom-right for help.')}><span>?</span><b>Help Center</b></button>
          <div className="gt-side-rule" />
          <button type="button" onClick={() => typeof onSignOut === 'function' ? onSignOut() : notify('Sign-out is unavailable.')}><span>↪</span><b>Log Out</b></button>
        </div>
        <div className="gt-astronaut" aria-hidden="true">🧑‍🚀</div>
        <section className="gt-rewards-card" id="rewards">
          <strong>Demo rewards<br />are ready to explore ✨</strong>
          <p>You have <b>2,450</b> demo stars</p>
          <button type="button" onClick={() => notify('2,450 demo Galactic Stars are ready to explore.')}>Explore Demo Rewards</button>
        </section>
      </aside>

      <section className="gt-dashboard">
        <header className="gt-dashboard-header">
          <div><h1>Welcome back, {memberName}! <span>👋</span></h1><p>Here&apos;s what&apos;s happening in your galaxy.</p></div>
          <div className="gt-header-tools">
            <label className="gt-search"><span className="gt-sr-only">Search</span><input placeholder="Search coming soon" aria-label="Search coming soon" disabled /><span>⌕</span></label>
            <button className="gt-round-button gt-notification" type="button" aria-label="Notifications" onClick={() => notify(sandboxConnected ? 'Increase sandbox is synced.' : 'You have 3 demo notifications.')}>♧<i>{sandboxConnected ? '✓' : '3'}</i></button>
            <button className="gt-profile" type="button" onClick={() => notify(galacticUser ? `Signed in as ${accountLabel}.` : 'Demo profile active.')}><span className="gt-avatar">◈</span><b>{memberName}</b><span>⌄</span></button>
          </div>
        </header>

        <div className="gt-content-grid">
          <section className="gt-main-column">
            <article className="gt-balance-hero">
              <div className="gt-balance-copy">
                <div className="gt-balance-label">Total Balance <span>◉</span></div>
                <div className="gt-balance-amount">{money(total)}</div>
                <div className="gt-balance-growth">{sandboxConnected ? <><b>INCREASE SANDBOX</b> <span>provider test balance</span></> : <><b>DEMO BALANCE</b> <span>illustrative funds only</span></>}</div>
              </div>
              <div className="gt-hero-stars">✦</div>
              <div className="gt-hero-planet big" />
              <div className="gt-hero-planet small" />
              <div className="gt-hero-horizon" />
            </article>

            <section className="gt-banking-controls">
              <div className="gt-mode-banner"><span className="gt-mode-dot" /><b>{sandboxConnected ? 'INCREASE SANDBOX' : 'DEMO BANKING'}</b><span>{sandboxConnected ? 'Provider-backed test data with pretend money only. No real money moves.' : 'No real deposits are held and no real money moves in this build.'}</span></div>
              {sandboxNotice && galacticUser && <div className="gt-mode-banner"><span className="gt-mode-dot" /><b>SANDBOX STATUS</b><span>{sandboxNotice}</span></div>}
              <div className="gt-quick-actions">
                <button type="button" onClick={() => openSheet('transfer')}><span className="gt-quick-icon send">↗</span><span><b>Transfer</b><small>{sandboxConnected ? 'Sandbox ACH' : 'Simulate transfer'}</small></span></button>
                <button type="button" onClick={() => openSheet('add-money')}><span className="gt-quick-icon add">＋</span><span><b>Add Money</b><small>{sandboxConnected ? 'Sandbox inbound ACH' : 'Add demo funds'}</small></span></button>
                <button type="button" onClick={() => { const next = !blueFrozen; setBlueFrozen(next); notify(next ? 'Demo card frozen.' : 'Demo card unfrozen.'); }}><span className="gt-quick-icon freeze">❄</span><span><b>{blueFrozen ? 'Unfreeze Card' : 'Freeze Card'}</b><small>Demo Nebula Blue</small></span></button>
                <button type="button" onClick={() => document.getElementById('cards')?.scrollIntoView({ behavior: 'smooth' })}><span className="gt-quick-icon card">▤</span><span><b>View Card</b><small>Demo card preview</small></span></button>
              </div>

              {sheet && (
                <div className="gt-action-sheet" id="gt-action-sheet">
                  <div className="gt-sheet-header"><div><small>Galactic Trust</small><h3>{sheet === 'transfer' ? (sandboxConnected ? 'Send an Increase sandbox ACH' : 'Send a demo transfer') : (sandboxConnected ? 'Simulate inbound ACH funding' : 'Add demo money')}</h3></div><button type="button" onClick={() => setSheet(null)} aria-label="Close">×</button></div>
                  {sheet === 'transfer' ? (
                    <form onSubmit={submitTransfer}>
                      <label>Recipient<input value={transfer.recipient} onChange={(event) => setTransfer((current) => ({ ...current, recipient: event.target.value }))} maxLength={80} placeholder="Sandbox recipient name" /></label>
                      <label>Amount<div className="gt-money-input"><span>$</span><input type="number" min={sandboxConnected ? '1' : '0.01'} max={sandboxConnected ? '1000' : '10000'} step="0.01" value={transfer.amount} onChange={(event) => setTransfer((current) => ({ ...current, amount: event.target.value }))} placeholder="0.00" /></div></label>
                      <button className="gt-primary" type="submit" disabled={sandboxBusy}>{sandboxBusy ? 'Processing sandbox…' : sandboxConnected ? 'Run Sandbox ACH' : 'Simulate Transfer'}</button>
                      <p>{sandboxConnected ? 'Routes only to Increase sandbox test coordinates. No real recipient or bank account is used.' : 'Demo transfers never move real money.'}</p>
                    </form>
                  ) : (
                    <div className="gt-funding-options">
                      <button type="button" disabled={sandboxBusy} onClick={addDemoMoney}><span>▣</span><b>{sandboxConnected ? 'Increase sandbox ACH' : 'Bank transfer'}</b><small>{sandboxConnected ? 'Simulate +$500' : 'Add $500 demo funds'}</small></button>
                      <button type="button" disabled={sandboxConnected || sandboxBusy} onClick={addDemoMoney}><span>▤</span><b>Debit card</b><small>{sandboxConnected ? 'Not wired to sandbox yet' : 'Simulated funding'}</small></button>
                      <button type="button" disabled={sandboxConnected || sandboxBusy} onClick={addDemoMoney}><span>↯</span><b>Direct deposit</b><small>{sandboxConnected ? 'Not wired to sandbox yet' : 'Preview flow'}</small></button>
                    </div>
                  )}
                </div>
              )}
              {toast && <div className="gt-toast" role="status">{toast}</div>}
            </section>

            <div className="gt-account-grid" id="accounts">
              <article className="gt-account-card"><div className="gt-account-title"><span className="gt-account-icon blue">▤</span><span>{sandboxConnected ? (sandboxAccounts[0]?.name || 'Increase Sandbox Account') : 'Demo Checking'}<strong>{money(checking)}</strong><small>{sandboxConnected ? `Available ${money(sandboxAccounts[0]?.availableBalance || 0)}` : 'Illustrative account'}</small></span><button type="button" onClick={() => notify(sandboxConnected ? 'Balance is sourced from Increase sandbox. Pretend money only.' : 'This is an illustrative demo checking balance.')}>›</button></div><Sparkline tone="blue" /></article>
              <article className="gt-account-card"><div className="gt-account-title"><span className="gt-account-icon teal">▣</span><span>{sandboxConnected ? (sandboxAccounts[1]?.name || 'Sandbox Reserve') : 'Demo Savings'}<strong>{money(savings)}</strong><small>{sandboxConnected ? (sandboxAccounts[1] ? `Available ${money(sandboxAccounts[1]?.availableBalance || 0)}` : 'No second sandbox account') : 'Illustrative account'}</small></span><button type="button" onClick={() => notify(sandboxConnected ? 'Second sandbox account is shown when available.' : 'This is an illustrative demo savings balance.')}>›</button></div><Sparkline tone="teal" /></article>
            </div>

            <section className="gt-activity-card" id="activity">
              <div className="gt-section-heading"><h2>Recent Activity</h2><button type="button" onClick={() => notify(sandboxConnected ? 'Recent Increase sandbox transactions are synced here.' : 'All recent demo activity is shown here.')}>View All</button></div>
              <div className="gt-activity-list">
                {transactions.length ? transactions.slice(0, 6).map((item) => (
                  <div className="gt-activity-row" key={item.id}><span className={`gt-merchant-icon ${item.tone}`}>{item.icon}</span><span className="gt-activity-meta"><b>{item.name}</b><small>{item.category}</small></span><span className={`gt-activity-amount ${item.amount > 0 ? 'positive' : ''}`}><b>{item.amount > 0 ? '+' : '−'}{money(Math.abs(item.amount))}</b><small>{item.date}</small></span></div>
                )) : <div className="gt-activity-row"><span className="gt-merchant-icon blue">◎</span><span className="gt-activity-meta"><b>No sandbox transactions yet</b><small>Use Add Money to create a pretend inbound ACH.</small></span></div>}
              </div>
            </section>
          </section>

          <aside className="gt-right-column">
            <section className="gt-cards-panel" id="cards">
              <div className="gt-section-heading"><h2>Demo Cards</h2><button type="button" onClick={() => notify('These are visual demo cards only. No live card has been issued.')}>About</button></div>
              <GalacticCard frozen={blueFrozen} onFreeze={() => setBlueFrozen((value) => !value)} />
              <GalacticCard pink frozen={pinkFrozen} onFreeze={() => setPinkFrozen((value) => !value)} />
            </section>

            <section className="gt-insights-panel">
              <div className="gt-section-heading"><h2>Spending Insights</h2><span>Current activity</span></div>
              <div className="gt-insights-total"><strong>{money(spending)}</strong><span>Total Spent <i>{sandboxConnected ? 'Derived from Increase sandbox activity' : 'Derived from demo activity'}</i></span></div>
              <div className="gt-insights-body">
                <div className="gt-legend">
                  {spendingCategories.length ? spendingCategories.map((item) => (
                    <div key={item.category}><span className={item.tone} />{item.category} <b>{money(item.amount)}&nbsp; {item.percentage}%</b></div>
                  )) : <div><span className="blue" />No spending yet <b>{money(0)}&nbsp; 0%</b></div>}
                </div>
                <div className="gt-donut" aria-label="Spending breakdown"><span>•ᴗ•</span></div>
              </div>
              <button className="gt-breakdown-button" type="button" onClick={() => notify('The breakdown above is calculated from the currently loaded outgoing transactions.')}><span>▥</span> How This Is Calculated <b>›</b></button>
            </section>

            <section className="gt-crypto-panel" id="crypto">
              <div className="gt-section-heading"><div><h2>Crypto</h2><small>Practice buy & sell</small></div><span className="gt-mode-pill">DEMO</span></div>
              <div className="gt-crypto-tabs">
                {cryptoAssets.map((asset) => <button type="button" key={asset.symbol} className={cryptoSymbol === asset.symbol ? 'active' : ''} onClick={() => setCryptoSymbol(asset.symbol)}><span className={`gt-coin ${asset.symbol.toLowerCase()}`}>{asset.symbol === 'BTC' ? '₿' : asset.symbol === 'ETH' ? '◆' : '$'}</span><span><b>{asset.symbol}</b><small>{money(asset.price)}</small></span></button>)}
              </div>
              <div className="gt-crypto-holding"><span><small>Your {activeCrypto.name}</small><strong>{activeCrypto.holding.toLocaleString(undefined, { maximumFractionDigits: 8 })} {activeCrypto.symbol}</strong></span><b>{money(activeCrypto.holding * activeCrypto.price)}</b></div>
              <form className="gt-crypto-form" onSubmit={submitCrypto}>
                <div className="gt-trade-toggle"><button type="button" className={cryptoSide === 'buy' ? 'active' : ''} onClick={() => setCryptoSide('buy')}>Buy</button><button type="button" className={cryptoSide === 'sell' ? 'active' : ''} onClick={() => setCryptoSide('sell')}>Sell</button></div>
                <label>Amount in USD<div className="gt-crypto-amount"><span>$</span><input type="number" min="1" max="10000" step="1" value={cryptoAmount} onChange={(event) => setCryptoAmount(event.target.value)} /></div></label>
                <div className="gt-crypto-estimate"><span>Estimated {activeCrypto.symbol}</span><b>{cryptoUnits.toLocaleString(undefined, { maximumFractionDigits: activeCrypto.symbol === 'BTC' ? 8 : 6 })}</b></div>
                <button className={`gt-crypto-submit ${cryptoSide}`} type="submit">Simulate {cryptoSide === 'buy' ? 'Buy' : 'Sell'} {activeCrypto.symbol}</button>
              </form>
              <p className="gt-crypto-disclosure">Crypto trading is in demo mode. No real assets are purchased or sold. Crypto can lose value and returns are never guaranteed.</p>
            </section>

            <section className="gt-security-panel" id="security">
              <div className="gt-section-heading"><div><h2>Security & Privacy</h2><small>Protection built in</small></div><span className="gt-shield">✓</span></div>
              <div className="gt-security-list">
                <div><span>⌁</span><p><b>Protected sessions</b><small>Live banking is designed around signed short-lived authentication.</small></p></div>
                <div><span>▣</span><p><b>Masked card data</b><small>Full card numbers, CVVs and PINs are never shown here.</small></p></div>
                <div><span>◎</span><p><b>Privacy-minded Orbit</b><small>The assistant never asks for passwords, PINs, CVVs or one-time codes.</small></p></div>
                <div><span>◈</span><p><b>Live-money guard</b><small>{sandboxConnected ? 'Increase sandbox uses pretend money only; production banking remains locked.' : 'Real banking and crypto remain off until approved providers are configured.'}</small></p></div>
              </div>
              <Link className="gt-privacy-link" href="/privacy">Open Privacy Center →</Link>
            </section>
          </aside>
        </div>
      </section>

      <OrbitChat
        sandboxConnected={sandboxConnected}
        checking={checking}
        savings={savings}
        transactions={transactions}
        accountLabel={memberName}
        blueFrozen={blueFrozen}
        pinkFrozen={pinkFrozen}
      />
    </main>
  );
}
