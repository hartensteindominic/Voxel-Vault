'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

const initialCards = [
  {
    id: 'everyday',
    name: 'Everyday',
    holder: 'DOMINIC H',
    last4: '4821',
    number: '4242 8301 7714 4821',
    expiry: '08/30',
    cvv: '731',
    frozen: false,
    limit: 3500,
    spent: 1284.62,
    network: 'VISA',
    tone: 'violet',
  },
  {
    id: 'online',
    name: 'Online only',
    holder: 'DOMINIC H',
    last4: '1940',
    number: '4000 7013 5218 1940',
    expiry: '11/30',
    cvv: '264',
    frozen: false,
    limit: 1200,
    spent: 316.18,
    network: 'VISA',
    tone: 'blue',
  },
];

const initialTransactions = [
  { id: 1, merchant: 'Acme Hosting', detail: 'Software · Today', amount: -24, icon: 'A', category: 'Software' },
  { id: 2, merchant: 'Coffee District', detail: 'Food & drink · Today', amount: -7.85, icon: 'C', category: 'Food' },
  { id: 3, merchant: 'Demo payroll', detail: 'Income · Yesterday', amount: 2850, icon: '↗', category: 'Income' },
  { id: 4, merchant: 'Metro Market', detail: 'Groceries · Aug 27', amount: -83.46, icon: 'M', category: 'Groceries' },
  { id: 5, merchant: 'Cloudbox', detail: 'Software · Aug 26', amount: -18, icon: 'C', category: 'Software' },
  { id: 6, merchant: 'Northstar Energy', detail: 'Utilities · Aug 25', amount: -121.32, icon: 'N', category: 'Utilities' },
];

const navItems = [
  ['overview', '⌂', 'Overview'],
  ['cards', '▤', 'Cards'],
  ['activity', '↕', 'Activity'],
  ['payments', '→', 'Payments'],
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
        <div className="vb-card-brand"><span className="vb-brand-mark">V</span><b>VAULT</b></div>
        <span className="vb-card-chip" aria-hidden="true" />
      </div>
      <div className="vb-card-number">•••• &nbsp;•••• &nbsp;•••• &nbsp;{card.last4}</div>
      <div className="vb-card-bottom">
        <div><span>CARD HOLDER</span><b>{card.holder}</b></div>
        <div><span>EXPIRES</span><b>{card.expiry}</b></div>
        <strong>{card.network}</strong>
      </div>
      {card.frozen && <div className="vb-card-frozen-label">FROZEN</div>}
    </div>
  );
}

function TinySparkline() {
  return (
    <svg className="vb-sparkline" viewBox="0 0 260 76" role="img" aria-label="Balance trend rising over the last month">
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
  const [newCard, setNewCard] = useState({ name: 'Virtual card', limit: '1000' });

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
    notify(selectedCard.frozen ? 'Card unfrozen' : 'Card frozen');
  }

  function addDemoFunds() {
    const amount = 500;
    setBalance((value) => value + amount);
    setTransactions((current) => [
      { id: Date.now(), merchant: 'Demo top up', detail: 'Demo funds · Just now', amount, icon: '+', category: 'Income' },
      ...current,
    ]);
    notify('Added $500 in demo funds');
  }

  function sendTransfer(event) {
    event.preventDefault();
    const amount = Number(transfer.amount);
    if (!transfer.recipient.trim() || !Number.isFinite(amount) || amount <= 0) {
      notify('Enter a recipient and valid amount');
      return;
    }
    if (amount > balance) {
      notify('Demo balance is too low');
      return;
    }
    setBalance((value) => value - amount);
    setTransactions((current) => [
      {
        id: Date.now(),
        merchant: transfer.recipient.trim(),
        detail: 'Transfer · Just now',
        amount: -amount,
        icon: '→',
        category: 'Transfer',
      },
      ...current,
    ]);
    setTransfer({ recipient: '', amount: '' });
    setModal(null);
    notify('Demo transfer completed');
  }

  function createVirtualCard(event) {
    event.preventDefault();
    const limit = Math.max(100, Number(newCard.limit) || 1000);
    const last4 = String(Math.floor(1000 + Math.random() * 9000));
    const id = `virtual-${Date.now()}`;
    const card = {
      id,
      name: newCard.name.trim() || 'Virtual card',
      holder: 'DOMINIC H',
      last4,
      number: `4000 7712 8406 ${last4}`,
      expiry: '08/31',
      cvv: String(Math.floor(100 + Math.random() * 900)),
      frozen: false,
      limit,
      spent: 0,
      network: 'VISA',
      tone: cards.length % 2 ? 'violet' : 'blue',
    };
    setCards((current) => [...current, card]);
    setSelectedCardId(id);
    setNewCard({ name: 'Virtual card', limit: '1000' });
    setModal(null);
    setSection('cards');
    notify('Demo virtual card created');
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
          <span><b>Vault</b><small>Bank</small></span>
        </Link>

        <div className="vb-demo-pill"><span /> DEMO BANKING</div>

        <nav className="vb-nav" aria-label="Bank navigation">
          {navItems.map(([id, icon, label]) => (
            <button key={id} className={section === id ? 'active' : ''} onClick={() => setSection(id)}>
              <span>{icon}</span>{label}
            </button>
          ))}
        </nav>

        <div className="vb-sidebar-bottom">
          <button onClick={() => notify('Support is a demo in this build')}><span>?</span>Help center</button>
          <button onClick={() => notify('Settings are a demo in this build')}><span>⚙</span>Settings</button>
          <div className="vb-user-chip">
            <div className="vb-avatar">DH</div>
            <div><b>Dominic</b><small>Personal account</small></div>
            <span>⌄</span>
          </div>
        </div>
      </aside>

      <section className="vb-main">
        <header className="vb-topbar">
          <div>
            <div className="vb-mobile-logo"><span className="vb-logo-mark">V</span><b>Vault Bank</b></div>
            <h1>{section === 'overview' ? 'Welcome back, Dominic' : section[0].toUpperCase() + section.slice(1)}</h1>
            <p>{section === 'overview' ? 'Here’s your money at a glance.' : 'Manage everything from one clean workspace.'}</p>
          </div>
          <div className="vb-top-actions">
            <button className="vb-icon-button" onClick={() => notify('No new alerts')} aria-label="Notifications">♢</button>
            <button className="vb-primary-button" onClick={() => setModal('new-card')}>+ New card</button>
          </div>
        </header>

        <div className="vb-safety-note">
          <span>i</span>
          <p><b>Prototype mode.</b> Balances, cards and transfers on this page are simulated. Real deposits or card issuance require a regulated banking/card provider integration.</p>
        </div>

        {section === 'overview' && (
          <>
            <div className="vb-overview-grid">
              <article className="vb-balance-card">
                <div className="vb-panel-heading">
                  <div><span>Total balance</span><h2>{money(total)}</h2></div>
                  <button onClick={() => setSection('activity')}>•••</button>
                </div>
                <div className="vb-balance-trend"><b>+4.8%</b><span>this month</span></div>
                <TinySparkline />
                <div className="vb-account-strip">
                  <div><span>Checking</span><b>{money(balance)}</b></div>
                  <div><span>Savings</span><b>{money(savings)}</b></div>
                </div>
              </article>

              <article className="vb-quick-card">
                <div className="vb-panel-title"><div><span className="vb-kicker">QUICK ACTIONS</span><h3>Move money</h3></div></div>
                <div className="vb-quick-grid">
                  <button onClick={() => setModal('transfer')}><span>↗</span><b>Transfer</b><small>Send money</small></button>
                  <button onClick={addDemoFunds}><span>＋</span><b>Add money</b><small>Demo top up</small></button>
                  <button onClick={() => { setSection('cards'); notify('Choose a card to manage'); }}><span>▤</span><b>Cards</b><small>Manage cards</small></button>
                  <button onClick={() => notify('Bank details are hidden in demo mode')}><span>⌁</span><b>Bank details</b><small>Routing & account</small></button>
                </div>
              </article>
            </div>

            <div className="vb-content-grid">
              <article className="vb-panel vb-card-panel">
                <div className="vb-panel-title">
                  <div><span className="vb-kicker">DIGITAL CARD</span><h3>{selectedCard.name}</h3></div>
                  <button className="vb-text-button" onClick={() => setSection('cards')}>Manage →</button>
                </div>
                <CardArtwork card={selectedCard} />
                <div className="vb-card-actions">
                  <button onClick={toggleFreeze}><span>{selectedCard.frozen ? '▶' : '❄'}</span>{selectedCard.frozen ? 'Unfreeze' : 'Freeze'}</button>
                  <button onClick={() => { setRevealed((value) => !value); }}><span>◉</span>{revealed ? 'Hide' : 'Details'}</button>
                  <button onClick={() => setModal('new-card')}><span>＋</span>New card</button>
                </div>
              </article>

              <article className="vb-panel vb-spend-panel">
                <div className="vb-panel-title">
                  <div><span className="vb-kicker">AUGUST</span><h3>Spending</h3></div>
                  <b className="vb-spend-total">{money(monthlySpend)}</b>
                </div>
                <div className="vb-budget-row"><span>Monthly budget</span><b>{Math.round((monthlySpend / 2500) * 100)}% of $2,500</b></div>
                <div className="vb-progress"><span style={{ width: `${Math.min(100, monthlySpend / 25)}%` }} /></div>
                <div className="vb-spend-list">
                  <div><span className="vb-dot dot-one" /><p><b>Shopping</b><small>42% of spend</small></p><strong>$356</strong></div>
                  <div><span className="vb-dot dot-two" /><p><b>Food & drink</b><small>31% of spend</small></p><strong>$262</strong></div>
                  <div><span className="vb-dot dot-three" /><p><b>Bills & software</b><small>27% of spend</small></p><strong>$228</strong></div>
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
                  <div><b>{card.name}</b><span>•••• {card.last4}</span></div>
                </button>
              ))}
              <button className="vb-add-card-tile" onClick={() => setModal('new-card')}><span>＋</span><b>Create virtual card</b><small>Make a separate card for subscriptions, online shopping or a project.</small></button>
            </div>

            <div className="vb-card-detail-grid">
              <article className="vb-panel vb-card-management">
                <div className="vb-panel-title"><div><span className="vb-kicker">CARD CONTROLS</span><h3>{selectedCard.name}</h3></div><span className={`vb-status ${selectedCard.frozen ? 'frozen' : ''}`}>{selectedCard.frozen ? 'Frozen' : 'Active'}</span></div>
                <div className="vb-details-box">
                  <div><span>Card number</span><b>{revealed ? selectedCard.number : `•••• •••• •••• ${selectedCard.last4}`}</b></div>
                  <div><span>Expires</span><b>{revealed ? selectedCard.expiry : '••/••'}</b></div>
                  <div><span>CVV</span><b>{revealed ? selectedCard.cvv : '•••'}</b></div>
                  <button onClick={() => setRevealed((value) => !value)}>{revealed ? 'Hide details' : 'Reveal demo details'}</button>
                </div>
                <div className="vb-control-list">
                  <button onClick={toggleFreeze}><div><span>{selectedCard.frozen ? '▶' : '❄'}</span><p><b>{selectedCard.frozen ? 'Unfreeze card' : 'Freeze card'}</b><small>{selectedCard.frozen ? 'Allow demo card activity again' : 'Pause demo card activity instantly'}</small></p></div><strong>→</strong></button>
                  <button onClick={() => notify('Replacement flow is demo-only')}><div><span>↻</span><p><b>Replace card</b><small>Create a fresh card number</small></p></div><strong>→</strong></button>
                  <button onClick={() => notify('Merchant controls are demo-only')}><div><span>⌘</span><p><b>Merchant controls</b><small>Subscriptions, online purchases and categories</small></p></div><strong>→</strong></button>
                </div>
              </article>

              <article className="vb-panel vb-limit-panel">
                <span className="vb-kicker">SPENDING LIMIT</span>
                <h3>{money(selectedCard.limit)} <small>/ month</small></h3>
                <div className="vb-progress"><span style={{ width: `${Math.min(100, selectedCard.spent / selectedCard.limit * 100)}%` }} /></div>
                <div className="vb-limit-labels"><span>{money(selectedCard.spent)} spent</span><span>{money(Math.max(0, selectedCard.limit - selectedCard.spent))} left</span></div>
                <label>Monthly limit
                  <input type="range" min="100" max="10000" step="100" value={selectedCard.limit} onChange={updateLimit} />
                </label>
                <div className="vb-limit-presets">
                  {[500, 1000, 2500, 5000].map((value) => <button key={value} className={selectedCard.limit === value ? 'active' : ''} onClick={() => setCards((current) => current.map((card) => card.id === selectedCard.id ? { ...card, limit: value } : card))}>{money(value).replace('.00', '')}</button>)}
                </div>
                <div className="vb-wallet-note"><span>⌁</span><div><b>Apple / Google Wallet ready</b><small>Tokenized-wallet provisioning can be connected when a real issuer is configured.</small></div></div>
              </article>
            </div>
          </div>
        )}

        {section === 'activity' && <TransactionPanel transactions={transactions} large />}

        {section === 'payments' && (
          <div className="vb-empty-page">
            <div className="vb-empty-icon">→</div>
            <span className="vb-kicker">PAYMENTS</span>
            <h2>Send money without the clutter.</h2>
            <p>Create a demo transfer to see how the finished payment flow behaves. Production transfers stay disabled until a real provider is connected.</p>
            <button className="vb-primary-button" onClick={() => setModal('transfer')}>New transfer</button>
          </div>
        )}
      </section>

      {modal === 'transfer' && (
        <div className="vb-modal-backdrop" onMouseDown={() => setModal(null)}>
          <form className="vb-modal" onSubmit={sendTransfer} onMouseDown={(event) => event.stopPropagation()}>
            <div className="vb-modal-head"><div><span className="vb-kicker">DEMO TRANSFER</span><h2>Send money</h2></div><button type="button" onClick={() => setModal(null)}>×</button></div>
            <label>Recipient<input autoFocus value={transfer.recipient} onChange={(event) => setTransfer({ ...transfer, recipient: event.target.value })} placeholder="Name or email" /></label>
            <label>Amount<div className="vb-money-input"><span>$</span><input inputMode="decimal" value={transfer.amount} onChange={(event) => setTransfer({ ...transfer, amount: event.target.value })} placeholder="0.00" /></div></label>
            <div className="vb-modal-balance"><span>Available demo balance</span><b>{money(balance)}</b></div>
            <button className="vb-primary-button vb-full" type="submit">Send demo transfer</button>
            <p className="vb-modal-disclaimer">No real funds move in this prototype.</p>
          </form>
        </div>
      )}

      {modal === 'new-card' && (
        <div className="vb-modal-backdrop" onMouseDown={() => setModal(null)}>
          <form className="vb-modal" onSubmit={createVirtualCard} onMouseDown={(event) => event.stopPropagation()}>
            <div className="vb-modal-head"><div><span className="vb-kicker">DIGITAL CARD</span><h2>Create a virtual card</h2></div><button type="button" onClick={() => setModal(null)}>×</button></div>
            <div className="vb-mini-card-preview"><span className="vb-logo-mark">V</span><div><small>NEW VIRTUAL CARD</small><b>{newCard.name || 'Virtual card'}</b></div><strong>VISA</strong></div>
            <label>Card name<input autoFocus maxLength="24" value={newCard.name} onChange={(event) => setNewCard({ ...newCard, name: event.target.value })} placeholder="Subscriptions" /></label>
            <label>Monthly limit<div className="vb-money-input"><span>$</span><input inputMode="numeric" value={newCard.limit} onChange={(event) => setNewCard({ ...newCard, limit: event.target.value })} /></div></label>
            <button className="vb-primary-button vb-full" type="submit">Create demo card</button>
            <p className="vb-modal-disclaimer">This creates a simulated card only. Live card issuance requires an approved card-issuing provider.</p>
          </form>
        </div>
      )}

      {toast && <div className="vb-toast">✓ {toast}</div>}
    </main>
  );
}

function TransactionPanel({ transactions, onAll, large = false }) {
  return (
    <article className={`vb-panel vb-transactions ${large ? 'is-large' : ''}`}>
      <div className="vb-panel-title">
        <div><span className="vb-kicker">ACTIVITY</span><h3>{large ? 'All transactions' : 'Recent transactions'}</h3></div>
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
