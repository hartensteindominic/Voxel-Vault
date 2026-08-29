'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

const initialCards = [
  { id: 'everyday', name: 'Everyday demo', holder: 'VAULT MEMBER', last4: '4821', frozen: false, limit: 3500, spent: 1284.62, tone: 'violet' },
  { id: 'online', name: 'Online demo', holder: 'VAULT MEMBER', last4: '1940', frozen: false, limit: 1200, spent: 316.18, tone: 'blue' },
];

const initialTransactions = [
  { id: 1, merchant: 'Acme Hosting', detail: 'Simulated software purchase · Today', amount: -24, icon: 'A', category: 'Software' },
  { id: 2, merchant: 'Coffee District', detail: 'Simulated food purchase · Today', amount: -7.85, icon: 'C', category: 'Food' },
  { id: 3, merchant: 'Demo payroll', detail: 'Simulated income · Yesterday', amount: 2850, icon: '↗', category: 'Income' },
  { id: 4, merchant: 'Metro Market', detail: 'Simulated groceries · Aug 27', amount: -83.46, icon: 'M', category: 'Shopping' },
  { id: 5, merchant: 'Cloudbox', detail: 'Simulated software purchase · Aug 26', amount: -18, icon: 'C', category: 'Software' },
  { id: 6, merchant: 'Northstar Energy', detail: 'Simulated utility bill · Aug 25', amount: -121.32, icon: 'N', category: 'Bills' },
  { id: 7, merchant: 'Demo tax refund', detail: 'Simulated deposit · Aug 23', amount: 412.7, icon: '+', category: 'Income' },
  { id: 8, merchant: 'Transit Pass', detail: 'Simulated transportation · Aug 22', amount: -42, icon: 'T', category: 'Travel' },
];

const initialBills = [
  { id: 'energy', name: 'Northstar Energy', amount: 121.32, due: 'Sep 3', autopay: false, paid: false, icon: 'N' },
  { id: 'cloud', name: 'Cloudbox Pro', amount: 18, due: 'Sep 7', autopay: true, paid: false, icon: 'C' },
  { id: 'mobile', name: 'Demo Mobile', amount: 64, due: 'Sep 12', autopay: false, paid: false, icon: 'D' },
];

const initialGoals = [
  { id: 'buffer', name: 'Emergency buffer', target: 10000, current: 5400, emoji: '☂' },
  { id: 'trip', name: 'Future trip', target: 3500, current: 1275, emoji: '✦' },
];

const recipients = [
  { id: 'studio', name: 'Studio Ops', detail: 'Demo recipient', initials: 'SO' },
  { id: 'alex', name: 'Alex Demo', detail: 'Demo recipient', initials: 'AD' },
  { id: 'rent', name: 'Rent Sandbox', detail: 'Demo recipient', initials: 'RS' },
];

const navItems = [
  ['overview', '⌂', 'Overview'],
  ['accounts', '◎', 'Accounts'],
  ['cards', '▤', 'Digital cards'],
  ['activity', '↕', 'Activity'],
  ['payments', '→', 'Transfers'],
  ['bills', '◫', 'Bills'],
  ['goals', '◇', 'Goals'],
  ['security', '⌾', 'Security'],
];

function money(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function pageTitle(section) {
  return {
    overview: ['Good afternoon', 'A complete digital-banking interface, safely simulated.'],
    accounts: ['Accounts', 'See your simulated checking and savings structure.'],
    cards: ['Digital cards', 'Create and control UI-only cards for different spending needs.'],
    activity: ['Activity', 'Search and review every simulated transaction.'],
    payments: ['Transfers', 'Prototype recipient and money-movement flows without moving funds.'],
    bills: ['Bills & subscriptions', 'Organize recurring payments and autopay behavior in sandbox mode.'],
    goals: ['Savings goals', 'Plan and allocate simulated balances toward goals.'],
    security: ['Security center', 'Control demo card access, alerts, and account security settings.'],
  }[section] || ['Voxel Bank', 'Sandbox banking interface'];
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
      <defs><linearGradient id="lineFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="currentColor" stopOpacity="0.26" /><stop offset="1" stopColor="currentColor" stopOpacity="0" /></linearGradient></defs>
      <path className="vb-spark-area" d="M2 62 C25 55 40 58 57 44 S92 56 111 38 S144 42 160 28 S190 35 207 18 S236 20 258 8 L258 76 L2 76 Z" />
      <path className="vb-spark-line" d="M2 62 C25 55 40 58 57 44 S92 56 111 38 S144 42 160 28 S190 35 207 18 S236 20 258 8" />
    </svg>
  );
}

function Toggle({ checked, onChange, label }) {
  return <button type="button" className={`vb-toggle ${checked ? 'on' : ''}`} onClick={onChange} aria-pressed={checked} aria-label={label}><span /></button>;
}

export default function BankClient() {
  const [section, setSection] = useState('overview');
  const [balance, setBalance] = useState(12486.32);
  const [savings, setSavings] = useState(8200);
  const [cards, setCards] = useState(initialCards);
  const [transactions, setTransactions] = useState(initialTransactions);
  const [bills, setBills] = useState(initialBills);
  const [goals, setGoals] = useState(initialGoals);
  const [selectedCardId, setSelectedCardId] = useState('everyday');
  const [revealed, setRevealed] = useState(false);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState('');
  const [transfer, setTransfer] = useState({ recipient: '', amount: '' });
  const [moveMoney, setMoveMoney] = useState({ direction: 'checking-to-savings', amount: '' });
  const [newCard, setNewCard] = useState({ name: 'Virtual demo card', limit: '1000' });
  const [newGoal, setNewGoal] = useState({ name: 'New savings goal', target: '2500' });
  const [activityQuery, setActivityQuery] = useState('');
  const [activityFilter, setActivityFilter] = useState('All');
  const [security, setSecurity] = useState({ biometrics: true, alerts: true, online: true, travel: false });

  const selectedCard = cards.find((card) => card.id === selectedCardId) || cards[0];
  const total = balance + savings;
  const monthlySpend = useMemo(() => transactions.filter((tx) => tx.amount < 0).reduce((sum, tx) => sum + Math.abs(tx.amount), 0), [transactions]);
  const upcomingBills = useMemo(() => bills.filter((bill) => !bill.paid).reduce((sum, bill) => sum + bill.amount, 0), [bills]);
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      const queryMatch = `${tx.merchant} ${tx.detail} ${tx.category}`.toLowerCase().includes(activityQuery.toLowerCase());
      const filterMatch = activityFilter === 'All' || tx.category === activityFilter;
      return queryMatch && filterMatch;
    });
  }, [transactions, activityQuery, activityFilter]);

  const [title, subtitle] = pageTitle(section);

  function notify(message) {
    setToast(message);
    window.setTimeout(() => setToast(''), 2200);
  }

  function toggleFreeze(cardId = selectedCard.id) {
    const target = cards.find((card) => card.id === cardId);
    setCards((current) => current.map((card) => card.id === cardId ? { ...card, frozen: !card.frozen } : card));
    notify(target?.frozen ? 'Demo card unfrozen' : 'Demo card frozen');
  }

  function addDemoFunds() {
    const amount = 500;
    setBalance((value) => value + amount);
    setTransactions((current) => [{ id: Date.now(), merchant: 'Demo top up', detail: 'Simulation only · Just now', amount, icon: '+', category: 'Income' }, ...current]);
    notify('Added $500 to the simulated balance');
  }

  function simulateTransfer(event) {
    event.preventDefault();
    const amount = Number(transfer.amount);
    if (!transfer.recipient.trim() || !Number.isFinite(amount) || amount <= 0) return notify('Enter a demo recipient and valid amount');
    if (amount > balance) return notify('Simulated checking balance is too low');
    setBalance((value) => value - amount);
    setTransactions((current) => [{ id: Date.now(), merchant: transfer.recipient.trim(), detail: 'Simulated transfer · Just now', amount: -amount, icon: '→', category: 'Transfer' }, ...current]);
    setTransfer({ recipient: '', amount: '' });
    setModal(null);
    notify('Transfer simulated — no money moved');
  }

  function simulateInternalMove(event) {
    event.preventDefault();
    const amount = Number(moveMoney.amount);
    if (!Number.isFinite(amount) || amount <= 0) return notify('Enter a valid demo amount');
    if (moveMoney.direction === 'checking-to-savings') {
      if (amount > balance) return notify('Simulated checking balance is too low');
      setBalance((value) => value - amount);
      setSavings((value) => value + amount);
    } else {
      if (amount > savings) return notify('Simulated savings balance is too low');
      setSavings((value) => value - amount);
      setBalance((value) => value + amount);
    }
    setTransactions((current) => [{ id: Date.now(), merchant: 'Between demo accounts', detail: 'Internal simulation · Just now', amount: 0, icon: '↔', category: 'Transfer' }, ...current]);
    setMoveMoney({ ...moveMoney, amount: '' });
    setModal(null);
    notify('Balance allocation simulated');
  }

  function createVirtualCard(event) {
    event.preventDefault();
    if (cards.length >= 6) return notify('Demo card limit reached');
    const limit = Math.min(10000, Math.max(100, Number(newCard.limit) || 1000));
    const sequence = String(cards.length + 1).padStart(4, '0');
    const id = `virtual-${Date.now()}`;
    const card = { id, name: newCard.name.trim() || 'Virtual demo card', holder: 'VAULT MEMBER', last4: sequence, frozen: false, limit, spent: 0, tone: cards.length % 2 ? 'violet' : 'blue' };
    setCards((current) => [...current, card]);
    setSelectedCardId(id);
    setNewCard({ name: 'Virtual demo card', limit: '1000' });
    setModal(null);
    setSection('cards');
    notify('Simulated digital card created');
  }

  function createGoal(event) {
    event.preventDefault();
    const target = Math.max(100, Number(newGoal.target) || 2500);
    setGoals((current) => [...current, { id: `goal-${Date.now()}`, name: newGoal.name.trim() || 'Savings goal', target, current: 0, emoji: '◇' }]);
    setNewGoal({ name: 'New savings goal', target: '2500' });
    setModal(null);
    notify('Demo savings goal created');
  }

  function addToGoal(goalId, amount = 100) {
    if (balance < amount) return notify('Simulated checking balance is too low');
    setBalance((value) => value - amount);
    setSavings((value) => value + amount);
    setGoals((current) => current.map((goal) => goal.id === goalId ? { ...goal, current: Math.min(goal.target, goal.current + amount) } : goal));
    notify(`${money(amount)} allocated to the demo goal`);
  }

  function simulateBillPayment(bill) {
    if (bill.paid) return;
    if (balance < bill.amount) return notify('Simulated checking balance is too low');
    setBalance((value) => value - bill.amount);
    setBills((current) => current.map((item) => item.id === bill.id ? { ...item, paid: true } : item));
    setTransactions((current) => [{ id: Date.now(), merchant: bill.name, detail: 'Simulated bill payment · Just now', amount: -bill.amount, icon: bill.icon, category: 'Bills' }, ...current]);
    notify('Bill payment simulated — no money moved');
  }

  function lockAllCards() {
    setCards((current) => current.map((card) => ({ ...card, frozen: true })));
    notify('All demo cards frozen');
  }

  function updateLimit(event) {
    const next = Number(event.target.value);
    setCards((current) => current.map((card) => card.id === selectedCard.id ? { ...card, limit: next } : card));
  }

  return (
    <main className="vb-shell">
      <aside className="vb-sidebar">
        <Link href="/" className="vb-logo" aria-label="Back to Voxel Vault"><span className="vb-logo-mark">V</span><span><b>Vault</b><small>Bank sandbox</small></span></Link>
        <div className="vb-demo-pill"><span /> DEMO · NOT MONEY</div>
        <nav className="vb-nav" aria-label="Bank sandbox navigation">
          {navItems.map(([id, icon, label]) => <button key={id} className={section === id ? 'active' : ''} onClick={() => setSection(id)}><span>{icon}</span>{label}</button>)}
        </nav>
        <div className="vb-sidebar-bottom">
          <button onClick={() => notify('Help center is not connected in this prototype')}><span>?</span>Help center</button>
          <button onClick={() => setSection('security')}><span>⚙</span>Settings</button>
          <div className="vb-user-chip"><div className="vb-avatar">VV</div><div><b>Demo member</b><small>Sandbox account</small></div><span>⌄</span></div>
        </div>
      </aside>

      <section className="vb-main">
        <header className="vb-topbar">
          <div><div className="vb-mobile-logo"><span className="vb-logo-mark">V</span><b>Vault Bank</b></div><h1>{title}</h1><p>{subtitle}</p></div>
          <div className="vb-top-actions"><button className="vb-icon-button" onClick={() => notify('No new demo alerts')} aria-label="Notifications">♢</button><button className="vb-secondary-button" onClick={() => setSection('security')}>Security</button></div>
        </header>

        <div className="vb-mobile-nav" aria-label="Mobile bank navigation">
          {navItems.map(([id, icon, label]) => <button key={id} className={section === id ? 'active' : ''} onClick={() => setSection(id)}><span>{icon}</span>{label}</button>)}
        </div>

        <div className="vb-safety-note" role="note"><span>i</span><p><b>SANDBOX FINANCE · NOT MONEY.</b> Balances, transactions, cards, bills, goals, and controls below are simulated. No deposit is held, no payment is sent, and no debit or credit card is issued. A live launch requires approved banking, identity, ledger, fraud, and card-issuing providers.</p></div>

        {section === 'overview' && (
          <>
            <div className="vb-overview-grid">
              <article className="vb-balance-card">
                <div className="vb-panel-heading"><div><span>Total demo balance · not money</span><h2>{money(total)}</h2></div><button onClick={() => setSection('accounts')} aria-label="Open accounts">•••</button></div>
                <div className="vb-balance-trend"><b>SIMULATED</b><span>30-day balance trend</span></div><TinySparkline />
                <div className="vb-account-strip"><button onClick={() => setSection('accounts')}><span>Demo checking</span><b>{money(balance)}</b></button><button onClick={() => setSection('accounts')}><span>Demo savings</span><b>{money(savings)}</b></button></div>
              </article>

              <article className="vb-quick-card">
                <div className="vb-panel-title"><div><span className="vb-kicker">QUICK ACTIONS</span><h3>Banking shortcuts</h3></div></div>
                <div className="vb-quick-grid">
                  <button onClick={() => setModal('transfer')}><span>↗</span><b>Transfer</b><small>Simulate only</small></button>
                  <button onClick={() => setModal('move-money')}><span>↔</span><b>Move money</b><small>Between demos</small></button>
                  <button onClick={() => setSection('bills')}><span>◫</span><b>Pay bills</b><small>{money(upcomingBills)} upcoming</small></button>
                  <button onClick={addDemoFunds}><span>＋</span><b>Demo deposit</b><small>Add local balance</small></button>
                </div>
              </article>
            </div>

            <div className="vb-metric-grid">
              <button onClick={() => setSection('activity')}><span>MONTHLY SPEND</span><b>{money(monthlySpend)}</b><small>Across demo activity</small></button>
              <button onClick={() => setSection('bills')}><span>UPCOMING BILLS</span><b>{money(upcomingBills)}</b><small>{bills.filter((bill) => !bill.paid).length} scheduled demos</small></button>
              <button onClick={() => setSection('cards')}><span>ACTIVE CARDS</span><b>{cards.filter((card) => !card.frozen).length}</b><small>{cards.length} total demo cards</small></button>
              <button onClick={() => setSection('goals')}><span>GOAL PROGRESS</span><b>{Math.round(goals.reduce((sum, goal) => sum + goal.current, 0) / goals.reduce((sum, goal) => sum + goal.target, 0) * 100)}%</b><small>Across savings goals</small></button>
            </div>

            <div className="vb-content-grid">
              <article className="vb-panel vb-card-panel">
                <div className="vb-panel-title"><div><span className="vb-kicker">PRIMARY DIGITAL CARD</span><h3>{selectedCard.name}</h3></div><button className="vb-text-button" onClick={() => setSection('cards')}>Manage →</button></div>
                <CardArtwork card={selectedCard} />
                <div className="vb-card-actions"><button onClick={() => toggleFreeze()}><span>{selectedCard.frozen ? '▶' : '❄'}</span>{selectedCard.frozen ? 'Unfreeze' : 'Freeze'}</button><button onClick={() => setRevealed((value) => !value)}><span>◉</span>{revealed ? 'Hide' : 'Demo ID'}</button><button onClick={() => setSection('activity')}><span>↕</span>Activity</button></div>
              </article>

              <article className="vb-panel vb-goal-overview">
                <div className="vb-panel-title"><div><span className="vb-kicker">SAVINGS</span><h3>Your goals</h3></div><button className="vb-text-button" onClick={() => setSection('goals')}>View all →</button></div>
                {goals.slice(0, 2).map((goal) => <div className="vb-mini-goal" key={goal.id}><span>{goal.emoji}</span><div><p><b>{goal.name}</b><small>{money(goal.current)} of {money(goal.target)}</small></p><div className="vb-progress"><span style={{ width: `${Math.min(100, goal.current / goal.target * 100)}%` }} /></div></div><strong>{Math.round(goal.current / goal.target * 100)}%</strong></div>)}
              </article>
            </div>
            <TransactionPanel transactions={transactions.slice(0, 5)} onAll={() => setSection('activity')} />
          </>
        )}

        {section === 'accounts' && (
          <div className="vb-cards-page">
            <div className="vb-account-cards">
              <article className="vb-account-card vb-account-card-dark"><span>DEMO CHECKING</span><h2>{money(balance)}</h2><small>Available simulation balance</small><div><b>VV-SBX-CHECKING</b><em>Not a bank account</em></div></article>
              <article className="vb-account-card"><span>DEMO SAVINGS</span><h2>{money(savings)}</h2><small>Goal-backed simulation balance</small><div><b>VV-SBX-SAVINGS</b><em>Not a deposit account</em></div></article>
            </div>
            <div className="vb-account-actions"><button onClick={() => setModal('move-money')}><span>↔</span><div><b>Move between accounts</b><small>Reallocate simulated balances</small></div></button><button onClick={addDemoFunds}><span>＋</span><div><b>Add demo funds</b><small>Local state only</small></div></button><button onClick={() => setSection('goals')}><span>◇</span><div><b>Manage savings goals</b><small>Organize the savings demo</small></div></button></div>
            <article className="vb-panel vb-account-detail"><div className="vb-panel-title"><div><span className="vb-kicker">ACCOUNT DETAILS</span><h3>Checking sandbox</h3></div><span className="vb-status">SIMULATED</span></div><div className="vb-detail-grid"><div><span>Account type</span><b>UI simulation</b></div><div><span>Routing number</span><b>NOT ISSUED</b></div><div><span>Account number</span><b>NOT ISSUED</b></div><div><span>Deposit insurance</span><b>NOT APPLICABLE</b></div></div><p className="vb-muted-copy">These screens model what a banking product could look like. They do not create a regulated account, hold deposits, or provide a payment rail.</p></article>
          </div>
        )}

        {section === 'cards' && (
          <div className="vb-cards-page">
            <div className="vb-card-gallery">
              {cards.map((card) => <button key={card.id} className={`vb-card-choice ${card.id === selectedCard.id ? 'selected' : ''}`} onClick={() => { setSelectedCardId(card.id); setRevealed(false); }}><CardArtwork card={card} compact /><div><b>{card.name}</b><span>DEMO · {card.last4}</span></div></button>)}
            </div>
            <div className="vb-card-detail-grid">
              <article className="vb-panel vb-card-management"><div className="vb-panel-title"><div><span className="vb-kicker">CARD CONTROLS · DEMO</span><h3>{selectedCard.name}</h3></div><span className={`vb-status ${selectedCard.frozen ? 'frozen' : ''}`}>{selectedCard.frozen ? 'Frozen' : 'Sandbox'}</span></div><div className="vb-details-box"><div><span>Demo card ID</span><b>{revealed ? `VV-DEMO-${selectedCard.last4}` : 'VV-DEMO-••••'}</b></div><div><span>Payment account number</span><b>NOT ISSUED</b></div><div><span>Security code</span><b>NOT ISSUED</b></div><button onClick={() => setRevealed((value) => !value)}>{revealed ? 'Hide demo ID' : 'Reveal demo ID'}</button></div><div className="vb-control-list"><button onClick={() => toggleFreeze()}><div><span>{selectedCard.frozen ? '▶' : '❄'}</span><p><b>{selectedCard.frozen ? 'Unfreeze demo card' : 'Freeze demo card'}</b><small>{selectedCard.frozen ? 'Resume simulated activity' : 'Pause simulated activity instantly'}</small></p></div><strong>→</strong></button><button onClick={() => notify('Replacement is simulated only')}><div><span>↻</span><p><b>Replace demo card</b><small>No payment credential is generated</small></p></div><strong>→</strong></button><button onClick={() => notify('Merchant controls are simulated only')}><div><span>⌘</span><p><b>Merchant controls</b><small>Prototype category and subscription controls</small></p></div><strong>→</strong></button></div></article>
              <article className="vb-panel vb-limit-panel"><span className="vb-kicker">SIMULATED SPENDING LIMIT</span><h3>{money(selectedCard.limit)} <small>/ month</small></h3><div className="vb-progress"><span style={{ width: `${Math.min(100, selectedCard.spent / selectedCard.limit * 100)}%` }} /></div><div className="vb-limit-labels"><span>{money(selectedCard.spent)} simulated</span><span>{money(Math.max(0, selectedCard.limit - selectedCard.spent))} left</span></div><label>Monthly demo limit<input aria-label="Monthly demo card limit" type="range" min="100" max="10000" step="100" value={selectedCard.limit} onChange={updateLimit} /></label><div className="vb-limit-presets">{[500, 1000, 2500, 5000].map((value) => <button key={value} className={selectedCard.limit === value ? 'active' : ''} onClick={() => setCards((current) => current.map((card) => card.id === selectedCard.id ? { ...card, limit: value } : card))}>{money(value).replace('.00', '')}</button>)}</div><div className="vb-wallet-note"><span>⌁</span><div><b>Mobile-wallet launch gate</b><small>Provisioning stays disabled until a real issuer supports tokenized wallet credentials.</small></div></div></article>
            </div>
            <button className="vb-add-card-row" onClick={() => setModal('new-card')}><span>＋</span><div><b>Create another digital demo card</b><small>Add a separate UI-only card for subscriptions, shopping, travel, or a project.</small></div><strong>→</strong></button>
          </div>
        )}

        {section === 'activity' && (
          <div className="vb-cards-page">
            <div className="vb-activity-toolbar"><div className="vb-search"><span>⌕</span><input value={activityQuery} onChange={(event) => setActivityQuery(event.target.value)} placeholder="Search demo activity" /></div><div className="vb-filter-chips">{['All', 'Income', 'Food', 'Shopping', 'Software', 'Bills', 'Transfer'].map((filter) => <button key={filter} className={activityFilter === filter ? 'active' : ''} onClick={() => setActivityFilter(filter)}>{filter}</button>)}</div></div>
            <TransactionPanel transactions={filteredTransactions} large emptyMessage="No matching demo transactions." />
          </div>
        )}

        {section === 'payments' && (
          <div className="vb-cards-page">
            <article className="vb-transfer-hero"><div><span className="vb-kicker">TRANSFER SANDBOX</span><h2>Send in seconds. Simulate only.</h2><p>Choose a saved demo recipient or enter a new one. No ACH, wire, card payment, bank account, or settlement is behind this screen.</p><button className="vb-primary-button" onClick={() => setModal('transfer')}>Simulate transfer</button></div><div className="vb-transfer-orbit">→</div></article>
            <article className="vb-panel"><div className="vb-panel-title"><div><span className="vb-kicker">RECIPIENTS</span><h3>Send again</h3></div></div><div className="vb-recipient-grid">{recipients.map((recipient) => <button key={recipient.id} onClick={() => { setTransfer({ recipient: recipient.name, amount: '' }); setModal('transfer'); }}><span>{recipient.initials}</span><b>{recipient.name}</b><small>{recipient.detail}</small></button>)}</div></article>
            <article className="vb-panel vb-card-management"><div className="vb-panel-title"><div><span className="vb-kicker">PRODUCTION LAUNCH GATE</span><h3>What must be connected before this can be a real bank product</h3></div><span className="vb-status frozen">NOT CONNECTED</span></div><div className="vb-control-list"><button type="button" onClick={() => notify('Provider selection is intentionally not configured')}><div><span>1</span><p><b>Regulated banking / money-movement partner</b><small>Account structure, disclosures, settlement, and program approval</small></p></div><strong>—</strong></button><button type="button" onClick={() => notify('Identity verification is intentionally not configured')}><div><span>2</span><p><b>Identity, KYC, and eligibility</b><small>Verification, sanctions screening, and account eligibility</small></p></div><strong>—</strong></button><button type="button" onClick={() => notify('Ledger is intentionally not configured')}><div><span>3</span><p><b>Ledger, reconciliation, and fraud controls</b><small>Authoritative balances, transaction state, limits, and monitoring</small></p></div><strong>—</strong></button><button type="button" onClick={() => notify('Card issuing is intentionally not configured')}><div><span>4</span><p><b>Approved card issuer / processor</b><small>Cardholder terms, credential issuance, authorization, disputes, and tokenized wallets</small></p></div><strong>—</strong></button></div></article>
          </div>
        )}

        {section === 'bills' && (
          <div className="vb-cards-page">
            <div className="vb-bill-summary"><article><span>UPCOMING</span><b>{money(upcomingBills)}</b><small>Next 30 days · demo</small></article><article><span>AUTOPAY</span><b>{bills.filter((bill) => bill.autopay && !bill.paid).length}</b><small>Simulated schedules</small></article><article><span>PAID</span><b>{bills.filter((bill) => bill.paid).length}</b><small>This demo cycle</small></article></div>
            <article className="vb-panel"><div className="vb-panel-title"><div><span className="vb-kicker">RECURRING PAYMENTS</span><h3>Upcoming bills</h3></div></div><div className="vb-bill-list">{bills.map((bill) => <div className={`vb-bill ${bill.paid ? 'paid' : ''}`} key={bill.id}><span className="vb-bill-icon">{bill.icon}</span><div><b>{bill.name}</b><small>{bill.paid ? 'Simulated paid' : `Due ${bill.due}`}</small></div><strong>{money(bill.amount)}</strong><label><small>Autopay</small><Toggle checked={bill.autopay} onChange={() => setBills((current) => current.map((item) => item.id === bill.id ? { ...item, autopay: !item.autopay } : item))} label={`Toggle demo autopay for ${bill.name}`} /></label><button disabled={bill.paid} onClick={() => simulateBillPayment(bill)}>{bill.paid ? 'Paid demo' : 'Simulate pay'}</button></div>)}</div></article>
            <div className="vb-info-banner"><span>i</span><p><b>Autopay is visual only.</b> Turning it on does not authorize a merchant, schedule a bank debit, or move funds.</p></div>
          </div>
        )}

        {section === 'goals' && (
          <div className="vb-cards-page">
            <div className="vb-goals-grid">{goals.map((goal) => <article className="vb-goal-card" key={goal.id}><div className="vb-goal-top"><span>{goal.emoji}</span><button onClick={() => notify('Goal settings are simulated')}>•••</button></div><h3>{goal.name}</h3><p><b>{money(goal.current)}</b> of {money(goal.target)}</p><div className="vb-progress"><span style={{ width: `${Math.min(100, goal.current / goal.target * 100)}%` }} /></div><div className="vb-goal-footer"><small>{Math.round(goal.current / goal.target * 100)}% complete</small><button onClick={() => addToGoal(goal.id)}>+ $100 demo</button></div></article>)}<button className="vb-new-goal" onClick={() => setModal('new-goal')}><span>＋</span><b>Create savings goal</b><small>Plan a target using simulated balances.</small></button></div>
            <article className="vb-panel"><div className="vb-panel-title"><div><span className="vb-kicker">SAVINGS SUMMARY</span><h3>{money(savings)} in demo savings</h3></div></div><p className="vb-muted-copy">Goal allocations are presentation state inside this sandbox. They do not create subaccounts, yield, interest, or an insured deposit product.</p></article>
          </div>
        )}

        {section === 'security' && (
          <div className="vb-security-grid">
            <article className="vb-panel vb-security-score"><span className="vb-kicker">SECURITY SCORE · DEMO</span><div className="vb-score-ring"><b>92</b><small>/100</small></div><h3>Strong setup</h3><p>These controls demonstrate the experience. They do not replace production authentication, risk, or fraud systems.</p><button className="vb-danger-button" onClick={lockAllCards}>Freeze all demo cards</button></article>
            <article className="vb-panel"><div className="vb-panel-title"><div><span className="vb-kicker">ACCOUNT SECURITY</span><h3>Controls</h3></div></div><div className="vb-settings-list"><div><span>⌾</span><p><b>Biometric sign-in</b><small>Prototype setting</small></p><Toggle checked={security.biometrics} onChange={() => setSecurity({ ...security, biometrics: !security.biometrics })} label="Toggle biometric sign-in demo" /></div><div><span>♢</span><p><b>Instant activity alerts</b><small>Prototype setting</small></p><Toggle checked={security.alerts} onChange={() => setSecurity({ ...security, alerts: !security.alerts })} label="Toggle activity alerts demo" /></div><div><span>⌁</span><p><b>Online card activity</b><small>Prototype setting</small></p><Toggle checked={security.online} onChange={() => setSecurity({ ...security, online: !security.online })} label="Toggle online card activity demo" /></div><div><span>✈</span><p><b>Travel mode</b><small>Prototype setting</small></p><Toggle checked={security.travel} onChange={() => setSecurity({ ...security, travel: !security.travel })} label="Toggle travel mode demo" /></div></div></article>
            <article className="vb-panel vb-security-wide"><div className="vb-panel-title"><div><span className="vb-kicker">RECENT SECURITY ACTIVITY</span><h3>Account access</h3></div></div><div className="vb-security-event"><span>✓</span><div><b>Demo member signed in</b><small>This device · Just now</small></div><strong>Current</strong></div><div className="vb-security-event"><span>✓</span><div><b>Security settings reviewed</b><small>Sandbox session · Today</small></div><strong>Trusted</strong></div></article>
          </div>
        )}
      </section>

      {modal === 'transfer' && <div className="vb-modal-backdrop" onMouseDown={() => setModal(null)}><form className="vb-modal" onSubmit={simulateTransfer} onMouseDown={(event) => event.stopPropagation()}><div className="vb-modal-head"><div><span className="vb-kicker">SIMULATION ONLY</span><h2>Simulate a transfer</h2></div><button type="button" onClick={() => setModal(null)} aria-label="Close transfer dialog">×</button></div><label>Demo recipient<input autoFocus value={transfer.recipient} onChange={(event) => setTransfer({ ...transfer, recipient: event.target.value })} placeholder="Example: Studio Ops" /></label><label>Demo amount<div className="vb-money-input"><span>$</span><input inputMode="decimal" value={transfer.amount} onChange={(event) => setTransfer({ ...transfer, amount: event.target.value })} placeholder="0.00" /></div></label><div className="vb-modal-balance"><span>Available demo checking · not money</span><b>{money(balance)}</b></div><button className="vb-primary-button vb-full" type="submit">Simulate transfer</button><p className="vb-modal-disclaimer">Nothing leaves this browser state. No ACH, wire, card payment, or other real funds movement is initiated.</p></form></div>}

      {modal === 'move-money' && <div className="vb-modal-backdrop" onMouseDown={() => setModal(null)}><form className="vb-modal" onSubmit={simulateInternalMove} onMouseDown={(event) => event.stopPropagation()}><div className="vb-modal-head"><div><span className="vb-kicker">INTERNAL SIMULATION</span><h2>Move demo money</h2></div><button type="button" onClick={() => setModal(null)} aria-label="Close move money dialog">×</button></div><label>Direction<select value={moveMoney.direction} onChange={(event) => setMoveMoney({ ...moveMoney, direction: event.target.value })}><option value="checking-to-savings">Checking → Savings</option><option value="savings-to-checking">Savings → Checking</option></select></label><label>Demo amount<div className="vb-money-input"><span>$</span><input inputMode="decimal" value={moveMoney.amount} onChange={(event) => setMoveMoney({ ...moveMoney, amount: event.target.value })} placeholder="0.00" /></div></label><button className="vb-primary-button vb-full" type="submit">Simulate move</button><p className="vb-modal-disclaimer">This only reallocates local demo state between two simulated balances.</p></form></div>}

      {modal === 'new-card' && <div className="vb-modal-backdrop" onMouseDown={() => setModal(null)}><form className="vb-modal" onSubmit={createVirtualCard} onMouseDown={(event) => event.stopPropagation()}><div className="vb-modal-head"><div><span className="vb-kicker">DIGITAL CARD · SANDBOX</span><h2>Create a demo card</h2></div><button type="button" onClick={() => setModal(null)} aria-label="Close digital card dialog">×</button></div><div className="vb-mini-card-preview"><span className="vb-logo-mark">V</span><div><small>NO PAYMENT CREDENTIAL</small><b>{newCard.name || 'Virtual demo card'}</b></div><strong>DEMO</strong></div><label>Demo card name<input autoFocus maxLength="24" value={newCard.name} onChange={(event) => setNewCard({ ...newCard, name: event.target.value })} placeholder="Subscriptions" /></label><label>Monthly demo limit<div className="vb-money-input"><span>$</span><input inputMode="numeric" value={newCard.limit} onChange={(event) => setNewCard({ ...newCard, limit: event.target.value })} /></div></label><button className="vb-primary-button vb-full" type="submit">Create simulated card</button><p className="vb-modal-disclaimer">This creates a UI-only card record. It does not generate a PAN, CVV, expiry, payment-network credential, or usable card.</p></form></div>}

      {modal === 'new-goal' && <div className="vb-modal-backdrop" onMouseDown={() => setModal(null)}><form className="vb-modal" onSubmit={createGoal} onMouseDown={(event) => event.stopPropagation()}><div className="vb-modal-head"><div><span className="vb-kicker">SAVINGS · SANDBOX</span><h2>Create a demo goal</h2></div><button type="button" onClick={() => setModal(null)} aria-label="Close goal dialog">×</button></div><label>Goal name<input autoFocus value={newGoal.name} onChange={(event) => setNewGoal({ ...newGoal, name: event.target.value })} /></label><label>Target amount<div className="vb-money-input"><span>$</span><input inputMode="numeric" value={newGoal.target} onChange={(event) => setNewGoal({ ...newGoal, target: event.target.value })} /></div></label><button className="vb-primary-button vb-full" type="submit">Create demo goal</button><p className="vb-modal-disclaimer">Goals are local presentation state and do not create a savings account or financial product.</p></form></div>}

      {toast && <div className="vb-toast" role="status">✓ {toast}</div>}
    </main>
  );
}

function TransactionPanel({ transactions, onAll, large = false, emptyMessage = 'No demo transactions yet.' }) {
  return (
    <article className={`vb-panel vb-transactions ${large ? 'is-large' : ''}`}>
      <div className="vb-panel-title"><div><span className="vb-kicker">SIMULATED ACTIVITY</span><h3>{large ? 'All demo transactions' : 'Recent demo transactions'}</h3></div>{onAll && <button className="vb-text-button" onClick={onAll}>View all →</button>}</div>
      <div className="vb-transaction-list">{transactions.length ? transactions.map((tx) => <div className="vb-transaction" key={tx.id}><span className="vb-merchant-icon">{tx.icon}</span><div><b>{tx.merchant}</b><small>{tx.detail}</small></div><strong className={tx.amount > 0 ? 'positive' : ''}>{tx.amount === 0 ? 'Internal' : `${tx.amount > 0 ? '+' : ''}${money(tx.amount)}`}</strong></div>) : <div className="vb-empty-state">{emptyMessage}</div>}</div>
    </article>
  );
}
