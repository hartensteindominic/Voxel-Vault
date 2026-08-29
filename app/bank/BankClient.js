'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

const initialCards = [
  {
    id: 'everyday',
    name: 'Everyday demo',
    holder: 'VAULT MEMBER',
    last4: '4821',
    frozen: false,
    limit: 3500,
    spent: 1284.62,
    tone: 'violet',
  },
  {
    id: 'online',
    name: 'Online demo',
    holder: 'VAULT MEMBER',
    last4: '1940',
    frozen: false,
    limit: 1200,
    spent: 316.18,
    tone: 'blue',
  },
];

const initialTransactions = [
  { id: 1, merchant: 'Acme Hosting', detail: 'Simulated software purchase · Today', amount: -24, icon: 'A' },
  { id: 2, merchant: 'Coffee District', detail: 'Simulated food purchase · Today', amount: -7.85, icon: 'C' },
  { id: 3, merchant: 'Demo payroll', detail: 'Simulated income · Yesterday', amount: 2850, icon: '↗' },
  { id: 4, merchant: 'Metro Market', detail: 'Simulated groceries · Aug 27', amount: -83.46, icon: 'M' },
  { id: 5, merchant: 'Cloudbox', detail: 'Simulated software purchase · Aug 26', amount: -18, icon: 'C' },
  { id: 6, merchant: 'Northstar Energy', detail: 'Simulated utility bill · Aug 25', amount: -121.32, icon: 'N' },
];

const navItems = [
  ['overview', '⌂', 'Overview'],
  ['cards', '▤', 'Digital cards'],
  ['activity', '↕', 'Activity'],
  ['payments', '→', 'Transfers'],
];

function money(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function CardArtwork({ card, compact = false }) {
  return (
    <div className={`vb-card vb-card-${card.tone} ${card.frozen ? 'is-frozen' : ''} ${compact ? 'is-compact' : ''}`}>
      <div className="vb-card-glow vb-card-glow-one" />
      <div className="vb-card-glow vb-card-glow-two" />
      <div className="vb-card-topline">
        <div className="vb-card-brand"><span className="vb-brand-mark">V</span><b>VAULT · DEMO</b></div>
        <span className="vb-card-chip" aria-hidden="true" />
      </div>
      <div className="vb-card-number">•••• &nbsp;•••• &nbsp;•••• &nbsp;{card.last4}</div>
      <div className="vb-card-bottom">
        <div><span>DEMO HOLDER</span><b>{card.holder}</b></div>
        <div><span>STATUS</span><b>{card.frozen ? 'FROZEN' : 'SANDBOX'}</b></div>
        <strong>DEMO</strong>
      </div>
      {card.frozen && <div className="vb-card-frozen-label">FROZEN</div>}
    </div>
  );
}

function TinySparkline() {
  return (
    <svg className="vb-sparkline" viewBox="0 0 260 76" role="img" aria-label="Simulated balance trend over the last month">
      <defs>
        <linearGradient id="lineFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.26" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path className="vb-spark-area" d="M2 62 C25 55 40 58 57 44 S92 56 111 38 S144 42 160 28 S190 35 207 18 S236 20 258 8 L258 76 L2 76 Z" />
      <path className="vb-spark-line" d="M2 62 C25 55 40 58 57 44 S92 56 111 38 S144 42 160 28 S190 35 207 18 S236 20 258 8" />
    </svg>
  );
}

export default function BankClient() {
  const [section, setSection] = useState('overview');
  const [balance, setBalance] = useState(12486.32);
  const [savings] = useState(8200);
  const [cards, setCards] = useState(initialCards);
  const [transactions, setTransactions] = useState(initialTransactions);
  const [selectedCardId, setSelectedCardId] = useState('everyday');
  const [revealed, setRevealed] = useState(false);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState('');
  const [transfer, setTransfer] = useState({ recipient: '', amount: '' });
  const [newCard, setNewCard] = useState({ name: 'Virtual demo card', limit: '1000' });

  const selectedCard = cards.find((card) => card.id === selectedCardId) || cards[0];
  const total = balance + savings;
  const monthlySpend = useMemo(
    () => transactions.filter((tx) => tx.amount < 0).reduce((sum, tx) => sum + Math.abs(tx.amount), 0),
    [transactions]
  );

  function notify(message) {
    setToast(message);
    window.setTimeout(() => setToast(''), 2200);
  }

  function toggleFreeze() {
    setCards((current) => current.map((card) => card.id === selectedCard.id ? { ...card, frozen: !card.frozen } : card));
    notify(selectedCard.frozen ? 'Demo card unfrozen' : 'Demo card frozen');
  }

  function addDemoFunds() {
    const amount = 500;
    setBalance((value) => value + amount);
    setTransactions((current) => [
      { id: Date.now(), merchant: 'Demo top up', detail: 'Simulation only · Just now', amount, icon: '+' },
      ...current,
    ]);
    notify('Added $500 to the simulated balance');
  }

  function simulateTransfer(event) {
    event.preventDefault();
    const amount = Number(transfer.amount);
    if (!transfer.recipient.trim() || !Number.isFinite(amount) || amount <= 0) {
      notify('Enter a demo recipient and valid amount');
      return;
    }
    if (amount > balance) {
      notify('Simulated balance is too low');
      return;
    }

    setBalance((value) => value - amount);
    setTransactions((current) => [
      {
        id: Date.now(),
        merchant: transfer.recipient.trim(),
        detail: 'Simulated transfer · Just now',
        amount: -amount,
        icon: '→',
      },
      ...current,
    ]);
    setTransfer({ recipient: '', amount: '' });
    setModal(null);
    notify('Transfer simulated — no money moved');
  }

  function createVirtualCard(event) {
    event.preventDefault();
    if (cards.length >= 6) {
      notify('Demo card limit reached');
      return;
    }

    const limit = Math.min(10000, Math.max(100, Number(newCard.limit) || 1000));
    const sequence = String(cards.length + 1).padStart(4, '0');
    const id = `virtual-${Date.now()}`;
    const card = {
      id,
      name: newCard.name.trim() || 'Virtual demo card',
      holder: 'VAULT MEMBER',
      last4: sequence,
      frozen: false,
      limit,
      spent: 0,
      tone: cards.length % 2 ? 'violet' : 'blue',
    };

    setCards((current) => [...current, card]);
    setSelectedCardId(id);
    setNewCard({ name: 'Virtual demo card', limit: '1000' });
    setModal(null);
    setSection('cards');
    notify('Simulated digital card created');
  }

  function updateLimit(event) {
    const next = Number(event.target.value);
    setCards((current) => current.map((card) => card.id === selectedCard.id ? { ...card, limit: next } : card));
  }

  return (
    <main className="vb-shell">
      <aside className="vb-sidebar">
        <Link href="/" className="vb-logo" aria-label="Back to Voxel Vault">
          <span className="vb-logo-mark">V</span>
          <span><b>Vault</b><small>Bank sandbox</small></span>
        </Link>

        <div className="vb-demo-pill"><span /> DEMO · NOT MONEY</div>

        <nav className="vb-nav" aria-label="Bank sandbox navigation">
          {navItems.map(([id, icon, label]) => (
            <button key={id} className={section === id ? 'active' : ''} onClick={() => setSection(id)}>
              <span>{icon}</span>{label}
            </button>
          ))}
        </nav>

        <div className="vb-sidebar-bottom">
          <button onClick={() => notify('Help center is not connected in this prototype')}><span>?</span>Help center</button>
          <button onClick={() => notify('Settings are simulated in this prototype')}><span>⚙</span>Settings</button>
          <div className="vb-user-chip">
            <div className="vb-avatar">VV</div>
            <div><b>Demo member</b><small>Sandbox account</small></div>
            <span>⌄</span>
          </div>
        </div>
      </aside>

      <section className="vb-main">
        <header className="vb-topbar">
          <div>
            <div className="vb-mobile-logo"><span className="vb-logo-mark">V</span><b>Vault Bank</b></div>
            <h1>{section === 'overview' ? 'Your money UI, safely sandboxed' : section[0].toUpperCase() + section.slice(1)}</h1>
            <p>{section === 'overview' ? 'Explore balances, digital cards, controls, and transfer flows without moving real funds.' : 'Every action on this page remains a local simulation.'}</p>
          </div>
          <div className="vb-top-actions">
            <button className="vb-icon-button" onClick={() => notify('No demo alerts')} aria-label="Notifications">♢</button>
            <button className="vb-primary-button" onClick={() => setModal('new-card')}>+ Demo card</button>
          </div>
        </header>

        <div className="vb-safety-note" role="note">
          <span>i</span>
          <p><b>SANDBOX FINANCE · NOT MONEY.</b> Balances, transactions, cards, and controls below are simulated. No deposit is held, no payment is sent, and no debit or credit card is issued. A live launch requires approved banking, identity, ledger, fraud, and card-issuing providers.</p>
        </div>

        {section === 'overview' && (
          <>
            <div className="vb-overview-grid">
              <article className="vb-balance-card">
                <div className="vb-panel-heading">
                  <div><span>Total demo balance · not money</span><h2>{money(total)}</h2></div>
                  <button onClick={() => setSection('activity')} aria-label="Open activity">•••</button>
                </div>
                <div className="vb-balance-trend"><b>SIMULATED</b><span>30-day balance trend</span></div>
                <TinySparkline />
                <div className="vb-account-strip">
                  <div><span>Demo checking</span><b>{money(balance)}</b></div>
                  <div><span>Demo savings</span><b>{money(savings)}</b></div>
                </div>
              </article>

              <article className="vb-quick-card">
                <div className="vb-panel-title"><div><span className="vb-kicker">QUICK ACTIONS</span><h3>Try the banking flow</h3></div></div>
                <div className="vb-quick-grid">
                  <button onClick={() => setModal('transfer')}><span>↗</span><b>Transfer</b><small>Simulate only</small></button>
                  <button onClick={addDemoFunds}><span>＋</span><b>Add demo funds</b><small>Local balance</small></button>
                  <button onClick={() => { setSection('cards'); notify('Choose a demo card to manage'); }}><span>▤</span><b>Digital cards</b><small>Controls</small></button>
                  <button onClick={() => notify('No routing or account number exists in sandbox mode')}><span>⌁</span><b>Account ID</b><small>VV-SBX-1047</small></button>
                </div>
              </article>
            </div>

            <div className="vb-content-grid">
              <article className="vb-panel vb-card-panel">
                <div className="vb-panel-title">
                  <div><span className="vb-kicker">DIGITAL CARD · SANDBOX</span><h3>{selectedCard.name}</h3></div>
                  <button className="vb-text-button" onClick={() => setSection('cards')}>Manage →</button>
                </div>
                <CardArtwork card={selectedCard} />
                <div className="vb-card-actions">
                  <button onClick={toggleFreeze}><span>{selectedCard.frozen ? '▶' : '❄'}</span>{selectedCard.frozen ? 'Unfreeze' : 'Freeze'}</button>
                  <button onClick={() => setRevealed((value) => !value)}><span>◉</span>{revealed ? 'Hide' : 'Demo ID'}</button>
                  <button onClick={() => setModal('new-card')}><span>＋</span>New demo</button>
                </div>
              </article>

              <article className="vb-panel vb-spend-panel">
                <div className="vb-panel-title">
                  <div><span className="vb-kicker">AUGUST · SIMULATED</span><h3>Spending</h3></div>
                  <b className="vb-spend-total">{money(monthlySpend)}</b>
                </div>
                <div className="vb-budget-row"><span>Demo monthly budget</span><b>{Math.round((monthlySpend / 2500) * 100)}% of $2,500</b></div>
                <div className="vb-progress"><span style={{ width: `${Math.min(100, monthlySpend / 25)}%` }} /></div>
                <div className="vb-spend-list">
                  <div><span className="vb-dot dot-one" /><p><b>Shopping</b><small>42% of demo spend</small></p><strong>$356</strong></div>
                  <div><span className="vb-dot dot-two" /><p><b>Food & drink</b><small>31% of demo spend</small></p><strong>$262</strong></div>
                  <div><span className="vb-dot dot-three" /><p><b>Bills & software</b><small>27% of demo spend</small></p><strong>$228</strong></div>
                </div>
              </article>
            </div>

            <TransactionPanel transactions={transactions.slice(0, 5)} onAll={() => setSection('activity')} />
          </>
        )}

        {section === 'cards' && (
          <div className="vb-cards-page">
            <div className="vb-card-gallery">
              {cards.map((card) => (
                <button key={card.id} className={`vb-card-choice ${card.id === selectedCard.id ? 'selected' : ''}`} onClick={() => { setSelectedCardId(card.id); setRevealed(false); }}>
                  <CardArtwork card={card} compact />
                  <div><b>{card.name}</b><span>DEMO · {card.last4}</span></div>
                </button>
              ))}
              <button className="vb-add-card-tile" onClick={() => setModal('new-card')}><span>＋</span><b>Create digital demo card</b><small>Make a separate simulated card for subscriptions, shopping, or a project.</small></button>
            </div>

            <div className="vb-card-detail-grid">
              <article className="vb-panel vb-card-management">
                <div className="vb-panel-title"><div><span className="vb-kicker">CARD CONTROLS · DEMO</span><h3>{selectedCard.name}</h3></div><span className={`vb-status ${selectedCard.frozen ? 'frozen' : ''}`}>{selectedCard.frozen ? 'Frozen' : 'Sandbox'}</span></div>
                <div className="vb-details-box">
                  <div><span>Demo card ID</span><b>{revealed ? `VV-DEMO-${selectedCard.last4}` : 'VV-DEMO-••••'}</b></div>
                  <div><span>Payment account number</span><b>NOT ISSUED</b></div>
                  <div><span>Security code</span><b>NOT ISSUED</b></div>
                  <button onClick={() => setRevealed((value) => !value)}>{revealed ? 'Hide demo ID' : 'Reveal demo ID'}</button>
                </div>
                <div className="vb-control-list">
                  <button onClick={toggleFreeze}><div><span>{selectedCard.frozen ? '▶' : '❄'}</span><p><b>{selectedCard.frozen ? 'Unfreeze demo card' : 'Freeze demo card'}</b><small>{selectedCard.frozen ? 'Resume simulated activity' : 'Pause simulated activity instantly'}</small></p></div><strong>→</strong></button>
                  <button onClick={() => notify('Replacement is simulated only')}><div><span>↻</span><p><b>Replace demo card</b><small>No payment credential is generated</small></p></div><strong>→</strong></button>
                  <button onClick={() => notify('Merchant controls are simulated only')}><div><span>⌘</span><p><b>Merchant controls</b><small>Prototype category and subscription controls</small></p></div><strong>→</strong></button>
                </div>
              </article>

              <article className="vb-panel vb-limit-panel">
                <span className="vb-kicker">SIMULATED SPENDING LIMIT</span>
                <h3>{money(selectedCard.limit)} <small>/ month</small></h3>
                <div className="vb-progress"><span style={{ width: `${Math.min(100, selectedCard.spent / selectedCard.limit * 100)}%` }} /></div>
                <div className="vb-limit-labels"><span>{money(selectedCard.spent)} simulated</span><span>{money(Math.max(0, selectedCard.limit - selectedCard.spent))} left</span></div>
                <label>Monthly demo limit
                  <input aria-label="Monthly demo card limit" type="range" min="100" max="10000" step="100" value={selectedCard.limit} onChange={updateLimit} />
                </label>
                <div className="vb-limit-presets">
                  {[500, 1000, 2500, 5000].map((value) => <button key={value} className={selectedCard.limit === value ? 'active' : ''} onClick={() => setCards((current) => current.map((card) => card.id === selectedCard.id ? { ...card, limit: value } : card))}>{money(value).replace('.00', '')}</button>)}
                </div>
                <div className="vb-wallet-note"><span>⌁</span><div><b>Mobile-wallet launch gate</b><small>Provisioning stays disabled until a real issuer supports tokenized wallet credentials.</small></div></div>
              </article>
            </div>
          </div>
        )}

        {section === 'activity' && <TransactionPanel transactions={transactions} large />}

        {section === 'payments' && (
          <div className="vb-cards-page">
            <article className="vb-empty-page">
              <div className="vb-empty-icon">→</div>
              <span className="vb-kicker">TRANSFER SANDBOX</span>
              <h2>Prototype the payment flow without moving money.</h2>
              <p>Simulate a transfer to test the interface. There is no ACH, wire, card payment, bank account, or settlement behind this screen.</p>
              <button className="vb-primary-button" onClick={() => setModal('transfer')}>Simulate transfer</button>
            </article>

            <article className="vb-panel vb-card-management">
              <div className="vb-panel-title"><div><span className="vb-kicker">PRODUCTION LAUNCH GATE</span><h3>What must be connected before this can be a real bank product</h3></div><span className="vb-status frozen">NOT CONNECTED</span></div>
              <div className="vb-control-list">
                <button type="button" onClick={() => notify('Provider selection is intentionally not configured')}><div><span>1</span><p><b>Regulated banking / money-movement partner</b><small>Account structure, disclosures, settlement, and program approval</small></p></div><strong>—</strong></button>
                <button type="button" onClick={() => notify('Identity verification is intentionally not configured')}><div><span>2</span><p><b>Identity, KYC, and eligibility</b><small>Verification, sanctions screening, and account eligibility</small></p></div><strong>—</strong></button>
                <button type="button" onClick={() => notify('Ledger is intentionally not configured')}><div><span>3</span><p><b>Ledger, reconciliation, and fraud controls</b><small>Authoritative balances, transaction state, limits, and monitoring</small></p></div><strong>—</strong></button>
                <button type="button" onClick={() => notify('Card issuing is intentionally not configured')}><div><span>4</span><p><b>Approved card issuer / processor</b><small>Cardholder terms, credential issuance, authorization, disputes, and tokenized wallets</small></p></div><strong>—</strong></button>
              </div>
            </article>
          </div>
        )}
      </section>

      {modal === 'transfer' && (
        <div className="vb-modal-backdrop" onMouseDown={() => setModal(null)}>
          <form className="vb-modal" onSubmit={simulateTransfer} onMouseDown={(event) => event.stopPropagation()}>
            <div className="vb-modal-head"><div><span className="vb-kicker">SIMULATION ONLY</span><h2>Simulate a transfer</h2></div><button type="button" onClick={() => setModal(null)} aria-label="Close transfer dialog">×</button></div>
            <label>Demo recipient<input autoFocus value={transfer.recipient} onChange={(event) => setTransfer({ ...transfer, recipient: event.target.value })} placeholder="Example: Studio Ops" /></label>
            <label>Demo amount<div className="vb-money-input"><span>$</span><input inputMode="decimal" value={transfer.amount} onChange={(event) => setTransfer({ ...transfer, amount: event.target.value })} placeholder="0.00" /></div></label>
            <div className="vb-modal-balance"><span>Available demo balance · not money</span><b>{money(balance)}</b></div>
            <button className="vb-primary-button vb-full" type="submit">Simulate transfer</button>
            <p className="vb-modal-disclaimer">Nothing leaves this browser state. No ACH, wire, card payment, or other real funds movement is initiated.</p>
          </form>
        </div>
      )}

      {modal === 'new-card' && (
        <div className="vb-modal-backdrop" onMouseDown={() => setModal(null)}>
          <form className="vb-modal" onSubmit={createVirtualCard} onMouseDown={(event) => event.stopPropagation()}>
            <div className="vb-modal-head"><div><span className="vb-kicker">DIGITAL CARD · SANDBOX</span><h2>Create a demo card</h2></div><button type="button" onClick={() => setModal(null)} aria-label="Close digital card dialog">×</button></div>
            <div className="vb-mini-card-preview"><span className="vb-logo-mark">V</span><div><small>NO PAYMENT CREDENTIAL</small><b>{newCard.name || 'Virtual demo card'}</b></div><strong>DEMO</strong></div>
            <label>Demo card name<input autoFocus maxLength="24" value={newCard.name} onChange={(event) => setNewCard({ ...newCard, name: event.target.value })} placeholder="Subscriptions" /></label>
            <label>Monthly demo limit<div className="vb-money-input"><span>$</span><input inputMode="numeric" value={newCard.limit} onChange={(event) => setNewCard({ ...newCard, limit: event.target.value })} /></div></label>
            <button className="vb-primary-button vb-full" type="submit">Create simulated card</button>
            <p className="vb-modal-disclaimer">This creates a UI-only card record. It does not generate a PAN, CVV, expiry, payment-network credential, or usable card.</p>
          </form>
        </div>
      )}

      {toast && <div className="vb-toast" role="status">✓ {toast}</div>}
    </main>
  );
}

function TransactionPanel({ transactions, onAll, large = false }) {
  return (
    <article className={`vb-panel vb-transactions ${large ? 'is-large' : ''}`}>
      <div className="vb-panel-title">
        <div><span className="vb-kicker">SIMULATED ACTIVITY</span><h3>{large ? 'All demo transactions' : 'Recent demo transactions'}</h3></div>
        {onAll && <button className="vb-text-button" onClick={onAll}>View all →</button>}
      </div>
      <div className="vb-transaction-list">
        {transactions.map((tx) => (
          <div className="vb-transaction" key={tx.id}>
            <span className="vb-merchant-icon">{tx.icon}</span>
            <div><b>{tx.merchant}</b><small>{tx.detail}</small></div>
            <strong className={tx.amount > 0 ? 'positive' : ''}>{tx.amount > 0 ? '+' : ''}{money(tx.amount)}</strong>
          </div>
        ))}
      </div>
    </article>
  );
}
