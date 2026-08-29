'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import styles from './bank.module.css';

const initialCards = [
  {
    id: 'daily',
    name: 'Everyday',
    holder: 'DOMINIC H.',
    last4: '8246',
    number: '4242 5849 7210 8246',
    expiry: '12/30',
    cvc: '482',
    frozen: false,
    limit: 1200,
    spent: 386.42,
    tone: 'violet',
  },
  {
    id: 'online',
    name: 'Online only',
    holder: 'DOMINIC H.',
    last4: '1918',
    number: '4242 7401 3390 1918',
    expiry: '08/31',
    cvc: '731',
    frozen: false,
    limit: 500,
    spent: 118.74,
    tone: 'lime',
  },
  {
    id: 'travel',
    name: 'Travel',
    holder: 'DOMINIC H.',
    last4: '6621',
    number: '4242 0920 6108 6621',
    expiry: '03/31',
    cvc: '205',
    frozen: true,
    limit: 2500,
    spent: 0,
    tone: 'sunset',
  },
];

const initialActivity = [
  { id: 1, merchant: 'Apple', meta: 'Today · Digital card', amount: -18.99, icon: 'A' },
  { id: 2, merchant: 'Payroll deposit', meta: 'Today · Checking', amount: 1850, icon: '↗' },
  { id: 3, merchant: 'DoorDash', meta: 'Yesterday · Everyday •8246', amount: -32.41, icon: 'D' },
  { id: 4, merchant: 'Spotify', meta: 'Aug 27 · Online only •1918', amount: -11.99, icon: 'S' },
  { id: 5, merchant: 'Target', meta: 'Aug 26 · Everyday •8246', amount: -64.27, icon: 'T' },
  { id: 6, merchant: 'Savings pocket', meta: 'Aug 25 · Automatic transfer', amount: -125, icon: '◎' },
];

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export default function BankDashboard() {
  const [balance, setBalance] = useState(4826.54);
  const [savings, setSavings] = useState(2200);
  const [cards, setCards] = useState(initialCards);
  const [activity, setActivity] = useState(initialActivity);
  const [activeCardId, setActiveCardId] = useState('daily');
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [sheet, setSheet] = useState(null);
  const [amount, setAmount] = useState('');
  const [toast, setToast] = useState('');

  const activeCard = cards.find((card) => card.id === activeCardId) || cards[0];
  const total = useMemo(() => balance + savings, [balance, savings]);

  function flash(message) {
    setToast(message);
    window.setTimeout(() => setToast(''), 2200);
  }

  function toggleFrozen() {
    setCards((current) => current.map((card) => (
      card.id === activeCard.id ? { ...card, frozen: !card.frozen } : card
    )));
    flash(activeCard.frozen ? 'Demo card unfrozen' : 'Demo card frozen');
  }

  function updateLimit(nextLimit) {
    const numeric = Number(nextLimit);
    if (!Number.isFinite(numeric) || numeric < 0) return;
    setCards((current) => current.map((card) => (
      card.id === activeCard.id ? { ...card, limit: numeric } : card
    )));
  }

  function completeMoneyAction(kind) {
    const numeric = Number(amount);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      flash('Enter an amount greater than $0');
      return;
    }

    if (kind === 'add') {
      setBalance((current) => current + numeric);
      setActivity((current) => [{
        id: Date.now(),
        merchant: 'Demo cash added',
        meta: 'Just now · Simulated deposit',
        amount: numeric,
        icon: '+',
      }, ...current]);
      flash(`${money.format(numeric)} added in demo mode`);
    } else if (kind === 'send') {
      if (numeric > balance) {
        flash('Demo balance is too low');
        return;
      }
      setBalance((current) => current - numeric);
      setActivity((current) => [{
        id: Date.now(),
        merchant: 'Demo transfer',
        meta: 'Just now · Simulated payment',
        amount: -numeric,
        icon: '↗',
      }, ...current]);
      flash(`${money.format(numeric)} sent in demo mode`);
    } else if (kind === 'save') {
      if (numeric > balance) {
        flash('Demo balance is too low');
        return;
      }
      setBalance((current) => current - numeric);
      setSavings((current) => current + numeric);
      setActivity((current) => [{
        id: Date.now(),
        merchant: 'Savings pocket',
        meta: 'Just now · Internal demo transfer',
        amount: -numeric,
        icon: '◎',
      }, ...current]);
      flash(`${money.format(numeric)} moved to savings`);
    }

    setAmount('');
    setSheet(null);
  }

  return (
    <main className={styles.shell}>
      <div className={styles.glowOne} aria-hidden="true" />
      <div className={styles.glowTwo} aria-hidden="true" />

      <header className={styles.header}>
        <Link href="/" className={styles.brand} aria-label="Voxel Vault home">
          <span className={styles.brandMark}>V</span>
          <span><b>Voxel</b> Bank</span>
        </Link>
        <div className={styles.demoPill}><span /> DEMO BANKING</div>
        <nav className={styles.headerNav} aria-label="Bank navigation">
          <a href="#cards">Cards</a>
          <a href="#activity">Activity</a>
          <Link href="/vault">Vault</Link>
          <button className={styles.avatar} type="button" onClick={() => flash('Profile controls are demo-only')}>D</button>
        </nav>
      </header>

      <section className={styles.notice}>
        <b>Prototype mode.</b> No bank account is opened, no money moves, and every card number on this page is fictional test data.
      </section>

      <div className={styles.content}>
        <section className={styles.heroGrid}>
          <div className={styles.balancePanel}>
            <div className={styles.eyebrow}>TOTAL BALANCE</div>
            <div className={styles.totalBalance}>{money.format(total)}</div>
            <div className={styles.balanceChange}><span>↑ 4.8%</span> this month</div>

            <div className={styles.quickActions}>
              <button type="button" onClick={() => setSheet('add')}><span>＋</span>Add money</button>
              <button type="button" onClick={() => setSheet('send')}><span>↗</span>Send</button>
              <button type="button" onClick={() => setSheet('save')}><span>◎</span>Save</button>
              <button type="button" onClick={() => flash('Statements are not generated in demo mode')}><span>↓</span>Statement</button>
            </div>

            <div className={styles.accounts}>
              <button type="button" className={styles.accountRow} onClick={() => flash('Checking selected')}>
                <span className={`${styles.accountIcon} ${styles.checkingIcon}`}>$</span>
                <span><b>Everyday checking</b><small>•• 4729</small></span>
                <strong>{money.format(balance)}</strong>
              </button>
              <button type="button" className={styles.accountRow} onClick={() => flash('Savings selected')}>
                <span className={`${styles.accountIcon} ${styles.savingsIcon}`}>◎</span>
                <span><b>High-yield pocket</b><small>Demo APY · not an offer</small></span>
                <strong>{money.format(savings)}</strong>
              </button>
            </div>
          </div>

          <aside className={styles.insightPanel}>
            <div className={styles.insightTop}>
              <span className={styles.eyebrow}>AUGUST SPENDING</span>
              <button type="button" onClick={() => flash('Budget editor coming next')}>•••</button>
            </div>
            <div className={styles.spendAmount}>{money.format(1012.82)}</div>
            <div className={styles.progressTrack}><div className={styles.progressValue} /></div>
            <div className={styles.spendMeta}><span>$1,012 spent</span><span>$1,487 left</span></div>
            <div className={styles.categories}>
              <div><span className={styles.catDotOne} /><b>Shopping</b><strong>$346</strong></div>
              <div><span className={styles.catDotTwo} /><b>Food</b><strong>$282</strong></div>
              <div><span className={styles.catDotThree} /><b>Bills</b><strong>$214</strong></div>
              <div><span className={styles.catDotFour} /><b>Other</b><strong>$171</strong></div>
            </div>
          </aside>
        </section>

        <section className={styles.cardsSection} id="cards">
          <div className={styles.sectionHeading}>
            <div><span className={styles.eyebrow}>DIGITAL CARDS</span><h2>Your cards</h2></div>
            <button type="button" className={styles.secondaryButton} onClick={() => flash('New card issuance needs a regulated card provider')}>＋ New card</button>
          </div>

          <div className={styles.cardsLayout}>
            <div className={styles.cardPicker}>
              {cards.map((card) => (
                <button key={card.id} type="button" className={`${styles.cardChoice} ${activeCardId === card.id ? styles.cardChoiceActive : ''}`} onClick={() => { setActiveCardId(card.id); setDetailsVisible(false); }}>
                  <span className={`${styles.miniCard} ${styles[card.tone]}`}><i>V</i></span>
                  <span><b>{card.name}</b><small>{card.frozen ? 'Frozen · ' : ''}•••• {card.last4}</small></span>
                  <span className={styles.chevron}>›</span>
                </button>
              ))}
            </div>

            <div className={styles.cardStage}>
              <div className={`${styles.digitalCard} ${styles[activeCard.tone]} ${activeCard.frozen ? styles.frozenCard : ''}`}>
                <div className={styles.cardTop}><span className={styles.cardBrand}>VOXEL</span><span className={styles.cardStatus}>{activeCard.frozen ? 'FROZEN' : 'ACTIVE'}</span></div>
                <div className={styles.cardChip}><span /><span /><span /></div>
                <div className={styles.cardNumber}>{detailsVisible ? activeCard.number : `••••  ••••  ••••  ${activeCard.last4}`}</div>
                <div className={styles.cardBottom}>
                  <div><small>CARDHOLDER</small><b>{activeCard.holder}</b></div>
                  <div><small>EXPIRES</small><b>{detailsVisible ? activeCard.expiry : '••/••'}</b></div>
                  <div><small>CVC</small><b>{detailsVisible ? activeCard.cvc : '•••'}</b></div>
                  <span className={styles.networkMark}>◎</span>
                </div>
              </div>

              <div className={styles.cardControls}>
                <button type="button" onClick={() => setDetailsVisible((visible) => !visible)}><span>◉</span>{detailsVisible ? 'Hide details' : 'Show details'}</button>
                <button type="button" onClick={toggleFrozen}><span>{activeCard.frozen ? '▶' : '❄'}</span>{activeCard.frozen ? 'Unfreeze' : 'Freeze'}</button>
                <button type="button" onClick={() => flash('A new fictional card number would be generated here')}><span>↻</span>Replace</button>
                <button type="button" onClick={() => flash('Wallet provisioning requires a real card issuer')}><span>◇</span>Add to wallet</button>
              </div>
            </div>

            <aside className={styles.limitPanel}>
              <div className={styles.limitHeader}><span className={styles.eyebrow}>SPEND CONTROL</span><b>{money.format(activeCard.limit)} / month</b></div>
              <div className={styles.limitMeter}><div style={{ width: `${Math.min(100, (activeCard.spent / Math.max(activeCard.limit, 1)) * 100)}%` }} /></div>
              <div className={styles.limitNumbers}><span>{money.format(activeCard.spent)} used</span><span>{money.format(Math.max(0, activeCard.limit - activeCard.spent))} available</span></div>
              <label className={styles.limitLabel}>
                Monthly limit
                <div className={styles.limitInput}><span>$</span><input inputMode="decimal" value={activeCard.limit} onChange={(event) => updateLimit(event.target.value)} /></div>
              </label>
              <div className={styles.securityList}>
                <div><span>✓</span><p><b>Online payments</b><small>Allowed</small></p><button type="button" onClick={() => flash('Online payment toggle updated in demo mode')}>On</button></div>
                <div><span>✓</span><p><b>Contactless</b><small>Allowed</small></p><button type="button" onClick={() => flash('Contactless toggle updated in demo mode')}>On</button></div>
                <div><span>✓</span><p><b>ATM withdrawals</b><small>Demo setting</small></p><button type="button" onClick={() => flash('ATM toggle updated in demo mode')}>On</button></div>
              </div>
            </aside>
          </div>
        </section>

        <section className={styles.activitySection} id="activity">
          <div className={styles.sectionHeading}>
            <div><span className={styles.eyebrow}>MONEY MOVEMENT</span><h2>Recent activity</h2></div>
            <button className={styles.textButton} type="button" onClick={() => flash('Showing all demo activity')}>See all →</button>
          </div>
          <div className={styles.activityTable}>
            {activity.slice(0, 7).map((item) => (
              <button key={item.id} type="button" className={styles.activityRow} onClick={() => flash(`${item.merchant} is a simulated transaction`)}>
                <span className={styles.merchantIcon}>{item.icon}</span>
                <span className={styles.activityCopy}><b>{item.merchant}</b><small>{item.meta}</small></span>
                <strong className={item.amount > 0 ? styles.positive : ''}>{item.amount > 0 ? '+' : ''}{money.format(item.amount)}</strong>
              </button>
            ))}
          </div>
        </section>

        <footer className={styles.footer}>
          <span>Voxel Bank · Interactive prototype</span>
          <span>No real banking, deposits, transfers, credit, debit cards, or FDIC insurance.</span>
        </footer>
      </div>

      {sheet && (
        <div className={styles.modalBackdrop} role="presentation" onMouseDown={() => setSheet(null)}>
          <section className={styles.moneySheet} role="dialog" aria-modal="true" aria-labelledby="money-sheet-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className={styles.closeButton} type="button" onClick={() => setSheet(null)}>×</button>
            <span className={styles.eyebrow}>SIMULATED ACTION</span>
            <h2 id="money-sheet-title">{sheet === 'add' ? 'Add demo money' : sheet === 'send' ? 'Send demo money' : 'Move to savings'}</h2>
            <p>{sheet === 'add' ? 'Increase the on-screen checking balance.' : sheet === 'send' ? 'Create a simulated outgoing transfer.' : 'Move simulated checking funds into your savings pocket.'}</p>
            <label>Amount</label>
            <div className={styles.sheetAmount}><span>$</span><input autoFocus inputMode="decimal" placeholder="0.00" value={amount} onChange={(event) => setAmount(event.target.value)} /></div>
            <div className={styles.presetAmounts}>
              {[25, 100, 500].map((value) => <button type="button" key={value} onClick={() => setAmount(String(value))}>${value}</button>)}
            </div>
            <button className={styles.primaryButton} type="button" onClick={() => completeMoneyAction(sheet)}>{sheet === 'add' ? 'Add demo money' : sheet === 'send' ? 'Send demo payment' : 'Move demo funds'}</button>
            <small className={styles.sheetDisclaimer}>This changes local UI state only. No payment rail or financial institution is contacted.</small>
          </section>
        </div>
      )}

      {toast && <div className={styles.toast} role="status">{toast}</div>}
    </main>
  );
}
