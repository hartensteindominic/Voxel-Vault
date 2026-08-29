'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

const startingCards = [
  { id: 'signature', name: 'Signature Digital', last4: '4821', number: '4111 8301 7714 4821', expiry: '08/30', cvv: '731', limit: 5000, spent: 1284.62, frozen: false, tone: 'midnight' },
  { id: 'online', name: 'Online Purchases', last4: '1940', number: '4000 7013 5218 1940', expiry: '11/30', cvv: '264', limit: 1500, spent: 316.18, frozen: false, tone: 'platinum' },
];

const startingTransactions = [
  { id: 1, merchant: 'Demo payroll', detail: 'Direct deposit · Aug 29', amount: 2850, icon: '↙' },
  { id: 2, merchant: 'Metro Market', detail: 'Groceries · Aug 29', amount: -83.46, icon: 'M' },
  { id: 3, merchant: 'Northstar Energy', detail: 'Utilities · Aug 28', amount: -121.32, icon: 'N' },
  { id: 4, merchant: 'Coffee District', detail: 'Dining · Aug 28', amount: -7.85, icon: 'C' },
  { id: 5, merchant: 'Acme Hosting', detail: 'Software · Aug 27', amount: -24, icon: 'A' },
];

const NAV = [
  ['home', '⌂', 'Home'],
  ['accounts', '◫', 'Accounts'],
  ['cards', '▰', 'Cards'],
  ['payments', '↗', 'Pay & transfer'],
];

const money = (value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

function GalacticMark() {
  return <span className="gt-mark" aria-hidden="true"><i /><b>G</b></span>;
}

function DigitalCard({ card, reveal = false, compact = false }) {
  return <div className={`gt-card gt-card-${card.tone} ${compact ? 'compact' : ''} ${card.frozen ? 'frozen' : ''}`}>
    <div className="gt-card-orbit" />
    <div className="gt-card-top"><div><GalacticMark /><span>GALACTIC TRUST</span></div><em>{card.frozen ? 'FROZEN' : 'DIGITAL'}</em></div>
    <div className="gt-chip"><i /><i /><i /></div>
    <div className="gt-card-number">{reveal ? card.number : `••••  ••••  ••••  ${card.last4}`}</div>
    <div className="gt-card-foot"><div><small>MEMBER</small><b>DOMINIC H.</b></div><div><small>VALID THRU</small><b>{reveal ? card.expiry : '••/••'}</b></div><strong>GT</strong></div>
  </div>;
}

function AccountRow({ title, subtitle, amount, onClick }) {
  return <button className="gt-account-row" onClick={onClick}>
    <span className="gt-account-icon">◫</span>
    <div><b>{title}</b><small>{subtitle}</small></div>
    <strong>{money(amount)}</strong><i>›</i>
  </button>;
}

function TransactionList({ transactions, title = 'Recent activity' }) {
  return <section className="gt-panel gt-transactions">
    <div className="gt-section-head"><div><span>ACTIVITY</span><h2>{title}</h2></div><button type="button">Search</button></div>
    <div className="gt-tx-list">{transactions.map((tx) => <div className="gt-tx" key={tx.id}>
      <span>{tx.icon}</span><div><b>{tx.merchant}</b><small>{tx.detail}</small></div>
      <strong className={tx.amount > 0 ? 'positive' : ''}>{tx.amount > 0 ? '+' : ''}{money(tx.amount)}</strong>
    </div>)}</div>
  </section>;
}

export default function BankClient() {
  const [section, setSection] = useState('home');
  const [checking, setChecking] = useState(12486.32);
  const [savings, setSavings] = useState(8200);
  const [cards, setCards] = useState(startingCards);
  const [selectedCardId, setSelectedCardId] = useState('signature');
  const [transactions, setTransactions] = useState(startingTransactions);
  const [reveal, setReveal] = useState(false);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState('');
  const [transfer, setTransfer] = useState({ recipient: '', amount: '' });
  const [newCard, setNewCard] = useState({ name: 'Travel card', limit: '1500' });

  const selectedCard = cards.find((card) => card.id === selectedCardId) || cards[0];
  const total = checking + savings;
  const monthSpend = useMemo(() => transactions.filter((tx) => tx.amount < 0).reduce((sum, tx) => sum + Math.abs(tx.amount), 0), [transactions]);

  function notify(text) {
    setToast(text);
    window.setTimeout(() => setToast(''), 2100);
  }

  function sendTransfer(event) {
    event.preventDefault();
    const amount = Number(transfer.amount);
    if (!transfer.recipient.trim() || !Number.isFinite(amount) || amount <= 0) return notify('Enter a recipient and amount');
    if (amount > checking) return notify('Demo checking balance is too low');
    setChecking((value) => value - amount);
    setTransactions((current) => [{ id: Date.now(), merchant: transfer.recipient.trim(), detail: 'Transfer · Just now', amount: -amount, icon: '↗' }, ...current]);
    setTransfer({ recipient: '', amount: '' });
    setModal(null);
    notify('Demo transfer completed');
  }

  function addFunds() {
    setChecking((value) => value + 500);
    setTransactions((current) => [{ id: Date.now(), merchant: 'Demo deposit', detail: 'Deposit · Just now', amount: 500, icon: '+' }, ...current]);
    notify('$500 demo deposit added');
  }

  function moveToSavings() {
    if (checking < 250) return notify('Not enough demo checking funds');
    setChecking((value) => value - 250);
    setSavings((value) => value + 250);
    setTransactions((current) => [{ id: Date.now(), merchant: 'Reserve Savings', detail: 'Internal transfer · Just now', amount: -250, icon: '↗' }, ...current]);
    notify('$250 moved to savings');
  }

  function toggleFreeze() {
    setCards((current) => current.map((card) => card.id === selectedCard.id ? { ...card, frozen: !card.frozen } : card));
    notify(selectedCard.frozen ? 'Card unfrozen' : 'Card frozen');
  }

  function createCard(event) {
    event.preventDefault();
    const last4 = String(Math.floor(1000 + Math.random() * 9000));
    const card = {
      id: `virtual-${Date.now()}`,
      name: newCard.name.trim() || 'Virtual card',
      last4,
      number: `4000 7712 8406 ${last4}`,
      expiry: '08/31',
      cvv: String(Math.floor(100 + Math.random() * 900)),
      limit: Math.max(100, Number(newCard.limit) || 1500),
      spent: 0,
      frozen: false,
      tone: cards.length % 2 ? 'midnight' : 'platinum',
    };
    setCards((current) => [...current, card]);
    setSelectedCardId(card.id);
    setModal(null);
    setSection('cards');
    notify('Demo digital card created');
  }

  function renderHome() {
    return <>
      <section className="gt-hero-grid">
        <article className="gt-balance-hero">
          <div className="gt-balance-top"><span>Available balance</span><em>PRIMARY</em></div>
          <h1>{money(checking)}</h1>
          <p>Galactic Trust Checking · •••• 4826</p>
          <div className="gt-balance-actions">
            <button onClick={() => setModal('transfer')}><span>↗</span>Send</button>
            <button onClick={addFunds}><span>＋</span>Deposit</button>
            <button onClick={moveToSavings}><span>⇄</span>Move</button>
            <button onClick={() => setSection('accounts')}><span>•••</span>More</button>
          </div>
        </article>

        <article className="gt-card-spotlight">
          <div className="gt-section-head light"><div><span>DIGITAL CARD</span><h2>{selectedCard.name}</h2></div><button onClick={() => setSection('cards')}>Manage</button></div>
          <DigitalCard card={selectedCard} />
          <div className="gt-mini-controls"><button onClick={toggleFreeze}>{selectedCard.frozen ? 'Unfreeze' : 'Freeze card'}</button><button onClick={() => { setSection('cards'); setReveal(true); }}>View details</button></div>
        </article>
      </section>

      <section className="gt-summary-strip">
        <div><span>Total relationship</span><b>{money(total)}</b><small>Checking + savings</small></div>
        <div><span>Reserve savings</span><b>{money(savings)}</b><small>Demo savings balance</small></div>
        <div><span>August spending</span><b>{money(monthSpend)}</b><small>Across demo activity</small></div>
      </section>

      <section className="gt-home-grid">
        <div className="gt-panel gt-accounts-panel">
          <div className="gt-section-head"><div><span>MY ACCOUNTS</span><h2>Banking</h2></div><button onClick={() => setSection('accounts')}>View all</button></div>
          <AccountRow title="Everyday Checking" subtitle="Available · •••• 4826" amount={checking} onClick={() => setSection('accounts')} />
          <AccountRow title="Reserve Savings" subtitle="Savings · •••• 1044" amount={savings} onClick={() => setSection('accounts')} />
        </div>
        <div className="gt-panel gt-insight-card">
          <span>MONTHLY SNAPSHOT</span><h2>Your money, simplified.</h2>
          <div className="gt-insight-number"><b>{money(2500 - monthSpend)}</b><small>left in your $2,500 demo spending plan</small></div>
          <div className="gt-meter"><i style={{ width: `${Math.min(100, (monthSpend / 2500) * 100)}%` }} /></div>
          <button onClick={() => notify('Budget tools are demo-only')}>View spending plan →</button>
        </div>
      </section>
      <TransactionList transactions={transactions.slice(0, 5)} />
    </>;
  }

  function renderAccounts() {
    return <div className="gt-page-stack">
      <section className="gt-title-block"><span>ACCOUNTS</span><h1>Your money at Galactic Trust</h1><p>Simple account views with clear balances and no trading clutter.</p></section>
      <section className="gt-account-cards">
        <article><span>CHECKING</span><h2>Everyday Checking</h2><b>{money(checking)}</b><small>Available balance · •••• 4826</small><div><button onClick={() => setModal('transfer')}>Send money</button><button onClick={addFunds}>Deposit</button></div></article>
        <article><span>SAVINGS</span><h2>Reserve Savings</h2><b>{money(savings)}</b><small>Demo savings balance · •••• 1044</small><div><button onClick={moveToSavings}>Add $250</button><button onClick={() => notify('Savings settings are demo-only')}>Settings</button></div></article>
      </section>
      <TransactionList transactions={transactions} title="Account activity" />
    </div>;
  }

  function renderCards() {
    return <div className="gt-page-stack">
      <section className="gt-title-block"><span>CARDS</span><h1>Digital cards, under your control.</h1><p>Create separate demo cards for everyday spending, subscriptions or travel.</p></section>
      <section className="gt-card-manage-grid">
        <div className="gt-card-stage"><DigitalCard card={selectedCard} reveal={reveal} /><div className="gt-card-switcher">{cards.map((card) => <button key={card.id} className={card.id === selectedCard.id ? 'active' : ''} onClick={() => { setSelectedCardId(card.id); setReveal(false); }}><span className={`swatch ${card.tone}`} /><div><b>{card.name}</b><small>•••• {card.last4}</small></div><i>›</i></button>)}</div></div>
        <article className="gt-panel gt-card-controls">
          <div className="gt-section-head"><div><span>CARD CONTROLS</span><h2>{selectedCard.name}</h2></div><em className={selectedCard.frozen ? 'off' : ''}>{selectedCard.frozen ? 'Frozen' : 'Active'}</em></div>
          <div className="gt-detail-row"><span>Card number</span><b>{reveal ? selectedCard.number : `•••• •••• •••• ${selectedCard.last4}`}</b></div>
          <div className="gt-detail-pair"><div><span>Expires</span><b>{reveal ? selectedCard.expiry : '••/••'}</b></div><div><span>Security code</span><b>{reveal ? selectedCard.cvv : '•••'}</b></div></div>
          <button className="gt-outline-wide" onClick={() => setReveal((value) => !value)}>{reveal ? 'Hide card details' : 'Reveal demo card details'}</button>
          <div className="gt-control-list"><button onClick={toggleFreeze}><span>❄</span><div><b>{selectedCard.frozen ? 'Unfreeze card' : 'Freeze card'}</b><small>Pause or resume this demo card instantly</small></div><i>›</i></button><button onClick={() => notify('Wallet provisioning requires a real issuer')}><span>⌁</span><div><b>Add to mobile wallet</b><small>Requires a supported real card issuer</small></div><i>›</i></button></div>
          <div className="gt-limit"><div><span>Monthly demo limit</span><b>{money(selectedCard.limit)}</b></div><input type="range" min="100" max="10000" step="100" value={selectedCard.limit} onChange={(event) => setCards((current) => current.map((card) => card.id === selectedCard.id ? { ...card, limit: Number(event.target.value) } : card))} /></div>
        </article>
      </section>
      <section className="gt-new-card-section"><div><span>DIGITAL CARD CENTER</span><h2>Need another card?</h2><p>Create a separate demo number for a subscription, trip or project. It stays clearly simulated until an approved issuer is connected.</p></div><button onClick={() => setModal('new-card')}>＋ Create digital card</button></section>
    </div>;
  }

  function renderPayments() {
    return <div className="gt-page-stack"><section className="gt-title-block"><span>PAY & TRANSFER</span><h1>Move money simply.</h1><p>Transfers on this prototype are simulated and never move real funds.</p></section><section className="gt-pay-grid"><article className="gt-panel gt-pay-card"><span className="gt-round-icon">↗</span><h2>Send money</h2><p>Create a demo transfer from Everyday Checking.</p><button onClick={() => setModal('transfer')}>New transfer</button></article><article className="gt-panel gt-pay-card"><span className="gt-round-icon">＋</span><h2>Deposit</h2><p>Add demo funds to see the account flow update.</p><button onClick={addFunds}>Add $500 demo funds</button></article><article className="gt-panel gt-pay-card"><span className="gt-round-icon">⇄</span><h2>Between accounts</h2><p>Move demo funds from checking to savings.</p><button onClick={moveToSavings}>Move $250 to savings</button></article></section><TransactionList transactions={transactions} title="Payment activity" /></div>;
  }

  return <main className="gt-shell">
    <aside className="gt-sidebar">
      <Link href="/" className="gt-brand"><GalacticMark /><div><b>Galactic Trust</b><small>Personal Banking</small></div></Link>
      <nav>{NAV.map(([id, icon, label]) => <button key={id} className={section === id ? 'active' : ''} onClick={() => setSection(id)}><span>{icon}</span>{label}</button>)}</nav>
      <div className="gt-sidebar-foot"><button onClick={() => notify('Support center is demo-only')}><span>?</span>Help & support</button><button onClick={() => notify('Security center is demo-only')}><span>◇</span>Security</button><div className="gt-profile"><span>DH</span><div><b>Dominic</b><small>Personal member</small></div><i>⌄</i></div></div>
    </aside>

    <section className="gt-main">
      <header className="gt-topbar"><div className="gt-mobile-brand"><GalacticMark /><b>Galactic Trust</b></div><div><span>{section === 'home' ? 'PERSONAL BANKING' : section.toUpperCase()}</span><h1>{section === 'home' ? 'Good evening, Dominic.' : NAV.find(([id]) => id === section)?.[2]}</h1></div><div className="gt-top-actions"><button onClick={() => notify('No new demo alerts')} aria-label="Notifications">♢</button><span className="gt-demo-badge">PROTOTYPE</span></div></header>
      <div className="gt-prototype-note"><b>Prototype banking.</b> All balances, cards and transfers shown here are simulated. Galactic Trust is not represented as a chartered bank or card issuer in this demo.</div>
      <div className="gt-content">{section === 'home' ? renderHome() : section === 'accounts' ? renderAccounts() : section === 'cards' ? renderCards() : renderPayments()}</div>
      <nav className="gt-mobile-nav">{NAV.map(([id, icon, label]) => <button key={id} className={section === id ? 'active' : ''} onClick={() => setSection(id)}><span>{icon}</span><small>{label === 'Pay & transfer' ? 'Pay' : label}</small></button>)}</nav>
    </section>

    {modal === 'transfer' && <div className="gt-modal-backdrop" onMouseDown={() => setModal(null)}><form className="gt-modal" onSubmit={sendTransfer} onMouseDown={(event) => event.stopPropagation()}><div className="gt-modal-head"><div><span>DEMO TRANSFER</span><h2>Send money</h2></div><button type="button" onClick={() => setModal(null)}>×</button></div><label>Recipient<input autoFocus value={transfer.recipient} onChange={(event) => setTransfer({ ...transfer, recipient: event.target.value })} placeholder="Name or email" /></label><label>Amount<div className="gt-money-input"><span>$</span><input inputMode="decimal" value={transfer.amount} onChange={(event) => setTransfer({ ...transfer, amount: event.target.value })} placeholder="0.00" /></div></label><div className="gt-modal-balance"><span>Available demo checking</span><b>{money(checking)}</b></div><button className="gt-primary-wide" type="submit">Review demo transfer</button><small>No real funds will move.</small></form></div>}

    {modal === 'new-card' && <div className="gt-modal-backdrop" onMouseDown={() => setModal(null)}><form className="gt-modal" onSubmit={createCard} onMouseDown={(event) => event.stopPropagation()}><div className="gt-modal-head"><div><span>DIGITAL CARD</span><h2>Create a demo card</h2></div><button type="button" onClick={() => setModal(null)}>×</button></div><div className="gt-modal-card-preview"><GalacticMark /><div><small>GALACTIC TRUST</small><b>{newCard.name || 'Digital card'}</b></div><strong>GT</strong></div><label>Card name<input autoFocus maxLength="28" value={newCard.name} onChange={(event) => setNewCard({ ...newCard, name: event.target.value })} /></label><label>Monthly demo limit<div className="gt-money-input"><span>$</span><input inputMode="numeric" value={newCard.limit} onChange={(event) => setNewCard({ ...newCard, limit: event.target.value })} /></div></label><button className="gt-primary-wide" type="submit">Create digital card</button><small>Creates a simulated card only; no card network account is issued.</small></form></div>}

    {toast && <div className="gt-toast">✓ {toast}</div>}
  </main>;
}
