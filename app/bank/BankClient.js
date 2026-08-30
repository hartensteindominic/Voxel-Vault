'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

const navItems = [
  ['dashboard', '⌂', 'Dashboard'],
  ['accounts', '▣', 'Accounts'],
  ['transfer', '⇄', 'Transfer'],
  ['add-money', '✣', 'Add Money'],
  ['cards', '▤', 'Cards'],
  ['pay-bills', '▧', 'Pay Bills'],
  ['investments', '▥', 'Investments'],
  ['crypto', '◈', 'Crypto'],
  ['goals', '◇', 'Goals'],
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

function money(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
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
      <div className="gt-card-footer"><span>DEBIT CARD</span><strong>{pink ? 'MC' : 'VISA'}</strong></div>
      {frozen && <span className="gt-frozen-label">FROZEN</span>}
      {onFreeze && <button className="gt-card-freeze" type="button" onClick={onFreeze}>{frozen ? 'Unfreeze' : 'Freeze'}</button>}
    </article>
  );
}

function OrbitChat() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Hi! I’m Orbit 👋 Ask me about transfers, cards, crypto, security, privacy, rewards, or Galactic Trust.' },
  ]);

  function replyTo(raw) {
    const message = raw.trim().slice(0, 500);
    if (!message) return;
    const q = message.toLowerCase();
    let answer = 'I can help with Galactic Trust accounts, transfers, cards, crypto, rewards, security, privacy, and demo/live status.';

    if (/password|pin|cvv|one.?time|otp|recovery|seed phrase|private key/.test(q)) {
      answer = 'For your security, never share passwords, PINs, CVVs, one-time codes, recovery phrases, or private keys in chat. I do not need them to help you.';
    } else if (/transfer|send money/.test(q)) {
      answer = 'Use Transfer from the sidebar or Quick Actions. In this build, transfers are simulated until regulated banking rails are connected and live money movement is explicitly enabled.';
    } else if (/crypto|bitcoin|btc|ethereum|eth|usdc|buy|sell/.test(q)) {
      answer = 'The Crypto panel lets you practice BTC, ETH, and USDC buys and sells. Orders are simulated right now; no real crypto is purchased or sold until an approved trading/custody provider is connected.';
    } else if (/private|privacy|data/.test(q)) {
      answer = 'Galactic Trust is designed to minimize sensitive data exposure. Card numbers stay masked, the assistant does not request account credentials, and provider secrets belong server-side only.';
    } else if (/safe|security|secure|protect/.test(q)) {
      answer = 'Security protections include masked card data, same-origin financial actions, restrictive browser headers, fail-closed live-money switches, and short-lived signed authentication for live banking integrations.';
    } else if (/fee|cost|price/.test(q)) {
      answer = 'This prototype does not charge real banking or crypto fees. Any future fees must match the approved live partner program and be disclosed before a user confirms an action.';
    } else if (/reward|star/.test(q)) {
      answer = 'The reference experience includes Galactic Stars and merchant rewards. The displayed 2,450 stars are demo rewards in this build.';
    } else if (/real|live|demo/.test(q)) {
      answer = 'The interface is live as a website, but balances, cards, transfers, and crypto trading remain demo data until regulated providers and production credentials are connected.';
    }

    setMessages((current) => [...current, { role: 'user', text: message }, { role: 'assistant', text: answer }]);
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
          <div className="gt-chat-warning"><span>🔒</span><p>Never share passwords, PINs, CVVs, recovery codes, or one-time codes here.</p></div>
          <div className="gt-chat-messages" aria-live="polite">
            {messages.map((message, index) => <div key={`${message.role}-${index}`} className={`gt-chat-bubble ${message.role}`}>{message.text}</div>)}
          </div>
          <div className="gt-chat-suggestions">
            {['How do transfers work?', 'How does crypto work?', 'Is my data private?'].map((text) => <button key={text} type="button" onClick={() => replyTo(text)}>{text}</button>)}
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

export default function GalacticApp() {
  const [checking, setChecking] = useState(15230.45);
  const [savings] = useState(9120.27);
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

  const total = checking + savings;
  const activeCrypto = cryptoAssets.find((asset) => asset.symbol === cryptoSymbol) || cryptoAssets[0];
  const cryptoUsd = Number(cryptoAmount);
  const cryptoUnits = Number.isFinite(cryptoUsd) && cryptoUsd > 0 ? cryptoUsd / activeCrypto.price : 0;
  const spending = useMemo(() => transactions.filter((item) => item.amount < 0).reduce((sum, item) => sum + Math.abs(item.amount), 0), [transactions]);

  function notify(message) {
    setToast(message);
    window.setTimeout(() => setToast(''), 2600);
  }

  function openSheet(name) {
    setSheet(name);
    setToast('');
    window.setTimeout(() => document.getElementById('gt-action-sheet')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 40);
  }

  function submitTransfer(event) {
    event.preventDefault();
    const amount = Number(transfer.amount);
    if (!transfer.recipient.trim() || !Number.isFinite(amount) || amount <= 0 || amount > 10000) {
      notify('Enter a recipient and an amount between $0.01 and $10,000.');
      return;
    }
    if (amount > checking) {
      notify('The demo checking balance is too low for that transfer.');
      return;
    }
    setChecking((value) => value - amount);
    setTransactions((current) => [{ id: Date.now(), icon: '↑', name: transfer.recipient.trim(), category: 'Demo Transfer', amount: -amount, date: 'Just now', tone: 'purple' }, ...current]);
    setTransfer({ recipient: '', amount: '' });
    setSheet(null);
    notify('Demo transfer completed. No real money moved.');
  }

  function addDemoMoney() {
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
    else if (id === 'crypto' || id === 'investments') document.getElementById('crypto')?.scrollIntoView({ behavior: 'smooth' });
    else if (id === 'rewards') document.getElementById('rewards')?.scrollIntoView({ behavior: 'smooth' });
    else notify(`${id.replace('-', ' ')} is coming next. The current build keeps it in demo mode.`);
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
          <button type="button" onClick={() => notify('Sign-out is disabled in this demo build.')}><span>↪</span><b>Log Out</b></button>
        </div>
        <div className="gt-astronaut" aria-hidden="true">🧑‍🚀</div>
        <section className="gt-rewards-card" id="rewards">
          <strong>Galactic rewards<br />are waiting! ✨</strong>
          <p>You have <b>2,450</b> stars</p>
          <button type="button" onClick={() => notify('2,450 demo Galactic Stars are ready to explore.')}>Explore Rewards</button>
        </section>
      </aside>

      <section className="gt-dashboard">
        <header className="gt-dashboard-header">
          <div><h1>Welcome back, Nova! <span>👋</span></h1><p>Here&apos;s what&apos;s happening in your galaxy.</p></div>
          <div className="gt-header-tools">
            <label className="gt-search"><span className="gt-sr-only">Search</span><input placeholder="Search anything..." aria-label="Search" /><span>⌕</span></label>
            <button className="gt-round-button gt-notification" type="button" aria-label="Notifications" onClick={() => notify('You have 3 demo notifications.')}>♧<i>3</i></button>
            <button className="gt-profile" type="button" onClick={() => notify('Profile controls are in demo mode.')}><span className="gt-avatar">◈</span><b>Nova Star</b><span>⌄</span></button>
          </div>
        </header>

        <div className="gt-content-grid">
          <section className="gt-main-column">
            <article className="gt-balance-hero">
              <div className="gt-balance-copy">
                <div className="gt-balance-label">Total Balance <span>◉</span></div>
                <div className="gt-balance-amount">{money(total)}</div>
                <div className="gt-balance-growth">↑ <b>12.4%</b> <span>vs last month</span></div>
              </div>
              <div className="gt-hero-stars">✦</div>
              <div className="gt-hero-planet big" />
              <div className="gt-hero-planet small" />
              <div className="gt-hero-horizon" />
            </article>

            <section className="gt-banking-controls">
              <div className="gt-mode-banner"><span className="gt-mode-dot" /><b>DEMO BANKING</b><span>No real deposits are held and no real money moves in this build.</span></div>
              <div className="gt-quick-actions">
                <button type="button" onClick={() => openSheet('transfer')}><span className="gt-quick-icon send">↗</span><span><b>Transfer</b><small>Send money</small></span></button>
                <button type="button" onClick={() => openSheet('add-money')}><span className="gt-quick-icon add">＋</span><span><b>Add Money</b><small>Fund account</small></span></button>
                <button type="button" onClick={() => { const next = !blueFrozen; setBlueFrozen(next); notify(next ? 'Demo card frozen.' : 'Demo card unfrozen.'); }}><span className="gt-quick-icon freeze">❄</span><span><b>{blueFrozen ? 'Unfreeze Card' : 'Freeze Card'}</b><small>Nebula Blue</small></span></button>
                <button type="button" onClick={() => document.getElementById('cards')?.scrollIntoView({ behavior: 'smooth' })}><span className="gt-quick-icon card">▤</span><span><b>View Card</b><small>•••• 4532</small></span></button>
              </div>

              {sheet && (
                <div className="gt-action-sheet" id="gt-action-sheet">
                  <div className="gt-sheet-header"><div><small>Galactic Trust</small><h3>{sheet === 'transfer' ? 'Send a demo transfer' : 'Add demo money'}</h3></div><button type="button" onClick={() => setSheet(null)} aria-label="Close">×</button></div>
                  {sheet === 'transfer' ? (
                    <form onSubmit={submitTransfer}>
                      <label>Recipient<input value={transfer.recipient} onChange={(event) => setTransfer((current) => ({ ...current, recipient: event.target.value }))} maxLength={80} placeholder="Name or email" /></label>
                      <label>Amount<div className="gt-money-input"><span>$</span><input type="number" min="0.01" max="10000" step="0.01" value={transfer.amount} onChange={(event) => setTransfer((current) => ({ ...current, amount: event.target.value }))} placeholder="0.00" /></div></label>
                      <button className="gt-primary" type="submit">Simulate Transfer</button>
                      <p>Demo transfers never move real money.</p>
                    </form>
                  ) : (
                    <div className="gt-funding-options">
                      <button type="button" onClick={addDemoMoney}><span>▣</span><b>Bank transfer</b><small>Add $500 demo funds</small></button>
                      <button type="button" onClick={addDemoMoney}><span>▤</span><b>Debit card</b><small>Simulated funding</small></button>
                      <button type="button" onClick={addDemoMoney}><span>↯</span><b>Direct deposit</b><small>Preview flow</small></button>
                    </div>
                  )}
                </div>
              )}
              {toast && <div className="gt-toast" role="status">{toast}</div>}
            </section>

            <div className="gt-account-grid" id="accounts">
              <article className="gt-account-card"><div className="gt-account-title"><span className="gt-account-icon blue">▤</span><span>Checking Account<strong>{money(checking)}</strong><small>•••• 4532</small></span><button type="button" onClick={() => notify('Checking account details remain masked in demo mode.')}>›</button></div><Sparkline tone="blue" /></article>
              <article className="gt-account-card"><div className="gt-account-title"><span className="gt-account-icon teal">▣</span><span>Savings Account<strong>{money(savings)}</strong><small>•••• 8756</small></span><button type="button" onClick={() => notify('Savings account details remain masked in demo mode.')}>›</button></div><Sparkline tone="teal" /></article>
            </div>

            <section className="gt-activity-card" id="activity">
              <div className="gt-section-heading"><h2>Recent Activity</h2><button type="button" onClick={() => notify('All recent demo activity is shown here.')}>View All</button></div>
              <div className="gt-activity-list">
                {transactions.slice(0, 6).map((item) => (
                  <div className="gt-activity-row" key={item.id}><span className={`gt-merchant-icon ${item.tone}`}>{item.icon}</span><span className="gt-activity-meta"><b>{item.name}</b><small>{item.category}</small></span><span className={`gt-activity-amount ${item.amount > 0 ? 'positive' : ''}`}><b>{item.amount > 0 ? '+' : '−'}{money(Math.abs(item.amount))}</b><small>{item.date}</small></span></div>
                ))}
              </div>
            </section>
          </section>

          <aside className="gt-right-column">
            <section className="gt-cards-panel" id="cards">
              <div className="gt-section-heading"><h2>My Cards</h2><button type="button" onClick={() => notify('Both demo cards are shown.')}>View All</button></div>
              <GalacticCard frozen={blueFrozen} onFreeze={() => setBlueFrozen((value) => !value)} />
              <GalacticCard pink frozen={pinkFrozen} onFreeze={() => setPinkFrozen((value) => !value)} />
            </section>

            <section className="gt-insights-panel">
              <div className="gt-section-heading"><h2>Spending Insights</h2><span>This Month⌄</span></div>
              <div className="gt-insights-total"><strong>{money(spending)}</strong><span>Total Spent <i>↓ 8.7% vs last month</i></span></div>
              <div className="gt-insights-body"><div className="gt-legend"><div><span className="purple" />Shopping <b>$623.10&nbsp; 39%</b></div><div><span className="green" />Food & Drinks <b>$312.45&nbsp; 20%</b></div><div><span className="teal" />Transport <b>$210.75&nbsp; 13%</b></div><div><span className="coral" />Entertainment <b>$198.50&nbsp; 12%</b></div><div><span className="blue" />Bills & Utilities <b>$241.54&nbsp; 16%</b></div></div><div className="gt-donut" aria-label="Spending breakdown"><span>•ᴗ•</span></div></div>
              <button className="gt-breakdown-button" type="button" onClick={() => notify('Detailed spending categories are coming next.')}><span>▥</span> See Full Breakdown <b>›</b></button>
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
                <div><span>◈</span><p><b>Live-money guard</b><small>Real banking and crypto remain off until approved providers are configured.</small></p></div>
              </div>
              <Link className="gt-privacy-link" href="/privacy">Open Privacy Center →</Link>
            </section>
          </aside>
        </div>
      </section>

      <OrbitChat />
    </main>
  );
}
