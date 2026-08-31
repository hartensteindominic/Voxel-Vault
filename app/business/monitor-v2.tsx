'use client';

import type { ChangeEvent, FormEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import './monitor-v2.css';

type Direction = 'in' | 'out';
type Filter = 'all' | 'in' | 'out' | 'recurring' | 'review';

type Transaction = {
  id: string;
  date: string;
  merchant: string;
  category: string;
  direction: Direction;
  amount: number;
  recurring?: boolean;
  confidence: number;
};

type Snapshot = {
  cash: number;
  income: number;
  expenses: number;
  net: number;
  recurring: number;
  forecast: number;
  runwayDays: number;
  categories: { name: string; amount: number; percent: number }[];
  recent: Transaction[];
};

const STORAGE_KEY = 'galactic-business-monitor-v2';

const seedTransactions: Transaction[] = [
  { id: '1', date: 'Today', merchant: 'Stripe payouts', category: 'Revenue', direction: 'in', amount: 18420, confidence: 99 },
  { id: '2', date: 'Today', merchant: 'Meta Ads', category: 'Advertising', direction: 'out', amount: 3180, recurring: true, confidence: 98 },
  { id: '3', date: 'Aug 30', merchant: 'Northstar Invoice #1842', category: 'Revenue', direction: 'in', amount: 7200, confidence: 97 },
  { id: '4', date: 'Aug 29', merchant: 'Gusto Payroll', category: 'Payroll', direction: 'out', amount: 8940, recurring: true, confidence: 99 },
  { id: '5', date: 'Aug 28', merchant: 'AWS Cloud Services', category: 'Software & Cloud', direction: 'out', amount: 1680, recurring: true, confidence: 97 },
  { id: '6', date: 'Aug 27', merchant: 'Office lease', category: 'Rent', direction: 'out', amount: 4200, recurring: true, confidence: 99 },
  { id: '7', date: 'Aug 26', merchant: 'Adobe Creative Cloud', category: 'Software & Cloud', direction: 'out', amount: 117, recurring: true, confidence: 99 },
  { id: '8', date: 'Aug 25', merchant: 'Supply Depot', category: 'Inventory', direction: 'out', amount: 2250, confidence: 91 },
  { id: '9', date: 'Aug 24', merchant: 'Acme Client Payment', category: 'Revenue', direction: 'in', amount: 12600, confidence: 97 },
  { id: '10', date: 'Aug 22', merchant: 'Google Workspace', category: 'Software & Cloud', direction: 'out', amount: 148, recurring: true, confidence: 99 },
];

function money(value: number, digits = 0) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function classify(merchant: string, direction: Direction) {
  const text = merchant.toLowerCase();
  if (direction === 'in') return { category: 'Revenue', confidence: 98 };
  if (/payroll|gusto|salary|wage|contractor/.test(text)) return { category: 'Payroll', confidence: 99 };
  if (/meta|facebook|google ads|marketing|adwords|tiktok ads/.test(text)) return { category: 'Advertising', confidence: 98 };
  if (/aws|adobe|workspace|software|hosting|cloud|saas|notion|slack/.test(text)) return { category: 'Software & Cloud', confidence: 96 };
  if (/rent|lease|office/.test(text)) return { category: 'Rent', confidence: 98 };
  if (/supplier|supply|inventory|wholesale|materials/.test(text)) return { category: 'Inventory', confidence: 92 };
  if (/insurance/.test(text)) return { category: 'Insurance', confidence: 91 };
  if (/tax|irs/.test(text)) return { category: 'Taxes', confidence: 90 };
  return { category: 'Other', confidence: 74 };
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === ',' && !quoted) {
      cells.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

function localAnswer(question: string, snapshot: Snapshot) {
  const q = question.toLowerCase();
  const biggest = snapshot.categories[0];
  if (/revenue|income|received|sales/.test(q)) {
    return `You have ${money(snapshot.income)} of tracked inflows and ${money(snapshot.expenses)} of tracked expenses, producing ${snapshot.net >= 0 ? '+' : ''}${money(snapshot.net)} net cash flow.`;
  }
  if (/spend|expense|cost|where/.test(q)) {
    return biggest
      ? `${biggest.name} is your largest tracked expense category at ${money(biggest.amount)} (${biggest.percent}% of spending). Total tracked spending is ${money(snapshot.expenses)}.`
      : 'There are no tracked expenses yet.';
  }
  if (/runway|cash/.test(q)) {
    return `Operating cash is ${money(snapshot.cash)}. Based only on the tracked spending pace, the simple runway estimate is about ${snapshot.runwayDays} days and projected 30-day ending cash is ${money(snapshot.forecast)}.`;
  }
  if (/recurring|subscription|software/.test(q)) {
    return `${money(snapshot.recurring)} of tracked spending is marked recurring. Review renewals, usage, owners, and price changes before the next billing cycle.`;
  }
  if (/hire|employee|afford/.test(q)) {
    return `Current tracked net cash flow is ${snapshot.net >= 0 ? '+' : ''}${money(snapshot.net)} with ${money(snapshot.forecast)} projected ending cash. A hiring decision should include salary, payroll taxes, benefits, and a runway target.`;
  }
  return `I see ${money(snapshot.cash)} operating cash, ${money(snapshot.income)} received, ${money(snapshot.expenses)} spent, and ${snapshot.net >= 0 ? '+' : ''}${money(snapshot.net)} net cash flow. Ask about spending, revenue, recurring costs, runway, or a hiring scenario.`;
}

function Logo() {
  return <span className="gvLogo" aria-hidden="true"><i /><b>✦</b></span>;
}

export function BusinessMonitorV2() {
  const [cash, setCash] = useState(84230.72);
  const [transactions, setTransactions] = useState<Transaction[]>(seedTransactions);
  const [hydrated, setHydrated] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [showAdd, setShowAdd] = useState(false);
  const [merchant, setMerchant] = useState('');
  const [amount, setAmount] = useState('');
  const [direction, setDirection] = useState<Direction>('out');
  const [recurring, setRecurring] = useState(false);
  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState('Cash flow is positive. Payroll is your largest expense and recurring software costs are worth reviewing before the next billing cycle.');
  const [asking, setAsking] = useState(false);
  const [status, setStatus] = useState('Demo workspace · read-only monitoring mode');
  const [hireCost, setHireCost] = useState('6500');
  const [revenueChange, setRevenueChange] = useState('0');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { cash?: unknown; transactions?: unknown };
        if (typeof parsed.cash === 'number' && Number.isFinite(parsed.cash)) setCash(parsed.cash);
        if (Array.isArray(parsed.transactions) && parsed.transactions.length) setTransactions(parsed.transactions as Transaction[]);
        setStatus('Saved business workspace restored on this device');
      }
    } catch {
      setStatus('Saved workspace could not be restored, so demo data is loaded');
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ cash, transactions }));
  }, [cash, hydrated, transactions]);

  const snapshot = useMemo<Snapshot>(() => {
    const income = transactions.filter((item) => item.direction === 'in').reduce((sum, item) => sum + item.amount, 0);
    const expenses = transactions.filter((item) => item.direction === 'out').reduce((sum, item) => sum + item.amount, 0);
    const net = income - expenses;
    const recurringTotal = transactions.filter((item) => item.direction === 'out' && item.recurring).reduce((sum, item) => sum + item.amount, 0);
    const totals = new Map<string, number>();
    transactions.filter((item) => item.direction === 'out').forEach((item) => totals.set(item.category, (totals.get(item.category) || 0) + item.amount));
    const categories = [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([name, categoryAmount]) => ({
      name,
      amount: categoryAmount,
      percent: expenses ? Math.round((categoryAmount / expenses) * 100) : 0,
    }));
    const dailySpend = expenses / 30;
    const runwayDays = dailySpend ? Math.max(0, Math.round(cash / dailySpend)) : 999;
    const forecast = Math.max(0, cash + net * 0.68);
    return { cash, income, expenses, net, recurring: recurringTotal, forecast, runwayDays, categories, recent: transactions.slice(0, 12) };
  }, [cash, transactions]);

  const health = useMemo(() => {
    let score = 50;
    if (snapshot.net > 0) score += 18;
    else score -= 18;
    if (snapshot.runwayDays >= 180) score += 16;
    else if (snapshot.runwayDays >= 90) score += 10;
    else if (snapshot.runwayDays < 45) score -= 14;
    const lowConfidence = transactions.filter((item) => item.confidence < 80).length;
    score -= Math.min(10, lowConfidence * 3);
    const concentration = snapshot.categories[0]?.percent || 0;
    if (concentration > 55) score -= 8;
    if (snapshot.recurring < snapshot.expenses * 0.5) score += 6;
    return Math.max(0, Math.min(100, score));
  }, [snapshot, transactions]);

  const anomalies = useMemo(() => {
    const outgoing = transactions.filter((item) => item.direction === 'out').map((item) => item.amount).sort((a, b) => a - b);
    if (!outgoing.length) return [] as Transaction[];
    const median = outgoing[Math.floor(outgoing.length / 2)] || 0;
    return transactions.filter((item) => item.direction === 'out' && item.amount > Math.max(1500, median * 2.2)).slice(0, 3);
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    const term = search.trim().toLowerCase();
    return transactions.filter((item) => {
      const matchesText = !term || `${item.merchant} ${item.category} ${item.date}`.toLowerCase().includes(term);
      const matchesFilter = filter === 'all'
        || (filter === 'in' && item.direction === 'in')
        || (filter === 'out' && item.direction === 'out')
        || (filter === 'recurring' && Boolean(item.recurring))
        || (filter === 'review' && item.confidence < 80);
      return matchesText && matchesFilter;
    });
  }, [filter, search, transactions]);

  const scenario = useMemo(() => {
    const monthlyHire = Math.max(0, Number(hireCost) || 0);
    const revenuePct = Math.max(-100, Math.min(300, Number(revenueChange) || 0));
    const adjustedIncome = snapshot.income * (1 + revenuePct / 100);
    const scenarioNet = adjustedIncome - snapshot.expenses - monthlyHire;
    const endingCash = Math.max(0, cash + scenarioNet);
    return { scenarioNet, endingCash };
  }, [cash, hireCost, revenueChange, snapshot]);

  const alerts = useMemo(() => {
    const list: { tone: 'warn' | 'good' | 'info'; title: string; body: string }[] = [];
    if (snapshot.net < 0) list.push({ tone: 'warn', title: 'Cash flow is negative', body: `${money(Math.abs(snapshot.net))} more went out than came in across tracked activity.` });
    else list.push({ tone: 'good', title: 'Cash flow is positive', body: `${money(snapshot.net)} net from tracked activity.` });
    if (anomalies[0]) list.push({ tone: 'warn', title: 'Large expense detected', body: `${anomalies[0].merchant} is ${money(anomalies[0].amount)} and stands out from typical tracked expenses.` });
    const review = transactions.find((item) => item.confidence < 80);
    if (review) list.push({ tone: 'warn', title: 'Category needs review', body: `${review.merchant} was categorized with ${review.confidence}% confidence.` });
    if (snapshot.runwayDays < 90) list.push({ tone: 'warn', title: 'Runway needs attention', body: `Simple tracked-spend runway is about ${snapshot.runwayDays} days.` });
    if (list.length < 3) list.push({ tone: 'info', title: 'Recurring spend', body: `${money(snapshot.recurring)} is marked recurring and should be reviewed before renewals.` });
    return list.slice(0, 3);
  }, [anomalies, snapshot, transactions]);

  function addTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const numeric = Number(amount);
    const cleanMerchant = merchant.trim();
    if (!cleanMerchant || !Number.isFinite(numeric) || numeric <= 0) return;
    const ai = classify(cleanMerchant, direction);
    const item: Transaction = {
      id: `manual_${Date.now()}`,
      date: 'Today',
      merchant: cleanMerchant,
      category: ai.category,
      direction,
      amount: numeric,
      recurring,
      confidence: ai.confidence,
    };
    setTransactions((current) => [item, ...current]);
    setCash((current) => current + (direction === 'in' ? numeric : -numeric));
    setStatus(`Added ${cleanMerchant}; AI classified it as ${ai.category} with ${ai.confidence}% confidence`);
    setMerchant('');
    setAmount('');
    setRecurring(false);
    setShowAdd(false);
  }

  async function importCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const lines = (await file.text()).replace(/\r/g, '').split('\n').filter((line) => line.trim());
      if (lines.length < 2) throw new Error('CSV needs a header row and at least one transaction.');
      const headers = parseCsvLine(lines[0]).map((value) => value.toLowerCase());
      const merchantIndex = headers.findIndex((value) => ['merchant', 'description', 'name', 'memo'].includes(value));
      const amountIndex = headers.findIndex((value) => ['amount', 'value'].includes(value));
      const typeIndex = headers.findIndex((value) => ['type', 'direction', 'transaction type'].includes(value));
      if (merchantIndex < 0 || amountIndex < 0) throw new Error('CSV must include merchant/description and amount columns.');
      const imported: Transaction[] = [];
      lines.slice(1).forEach((line, index) => {
        const cells = parseCsvLine(line);
        const cleanMerchant = cells[merchantIndex]?.trim();
        const rawText = (cells[amountIndex] || '').replace(/[$,()]/g, '');
        const rawBase = Number(rawText);
        const raw = cells[amountIndex]?.includes('(') ? -Math.abs(rawBase) : rawBase;
        if (!cleanMerchant || !Number.isFinite(raw) || raw === 0) return;
        const type = (cells[typeIndex] || '').toLowerCase();
        const rowDirection: Direction = /credit|income|received|deposit|in/.test(type) ? 'in' : /debit|expense|spent|withdrawal|out/.test(type) ? 'out' : raw < 0 ? 'out' : 'in';
        const ai = classify(cleanMerchant, rowDirection);
        imported.push({
          id: `csv_${Date.now()}_${index}`,
          date: 'Imported',
          merchant: cleanMerchant,
          category: ai.category,
          direction: rowDirection,
          amount: Math.abs(raw),
          confidence: ai.confidence,
        });
      });
      if (!imported.length) throw new Error('No valid transaction rows were found.');
      setTransactions((current) => [...imported, ...current]);
      setStatus(`Imported and categorized ${imported.length} transactions. Operating cash was not changed by the import.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'CSV import failed.');
    }
  }

  async function askAi(event?: FormEvent<HTMLFormElement>, suggested?: string) {
    event?.preventDefault();
    const question = (suggested || query).trim();
    if (!question || asking) return;
    setQuery(question);
    setAsking(true);
    setAnswer('Analyzing the tracked business data…');
    try {
      const response = await fetch('/api/business-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, snapshot }),
      });
      const data = await response.json() as { reply?: string };
      setAnswer(data.reply || localAnswer(question, snapshot));
    } catch {
      setAnswer(localAnswer(question, snapshot));
    } finally {
      setAsking(false);
    }
  }

  function exportCsv() {
    const rows = ['date,merchant,category,direction,amount,recurring,confidence', ...transactions.map((item) => [
      item.date,
      `"${item.merchant.replace(/"/g, '""')}"`,
      `"${item.category.replace(/"/g, '""')}"`,
      item.direction,
      item.amount.toFixed(2),
      item.recurring ? 'yes' : 'no',
      item.confidence,
    ].join(','))];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'galactic-business-transactions.csv';
    link.click();
    URL.revokeObjectURL(url);
    setStatus('Exported the current tracked transaction list');
  }

  function resetDemo() {
    setCash(84230.72);
    setTransactions(seedTransactions);
    setSearch('');
    setFilter('all');
    setAnswer('Cash flow is positive. Payroll is your largest expense and recurring software costs are worth reviewing before the next billing cycle.');
    setStatus('Demo workspace reset');
  }

  return (
    <main className="gvApp">
      <aside className="gvSidebar">
        <a className="gvBrand" href="#overview"><Logo /><span>Galactic<br />Business</span></a>
        <nav>
          <a className="active" href="#overview"><span>⌂</span>Overview</a>
          <a href="#transactions"><span>⇄</span>Transactions</a>
          <a href="#ai"><span>✦</span>AI Manager</a>
          <a href="#watchlist"><span>◇</span>Watchlist</a>
          <a href="#scenario"><span>⌁</span>Scenario Lab</a>
          <a href="#data"><span>▤</span>Data</a>
        </nav>
        <div className="gvSideSpacer" />
        <section className="gvMode"><span>✦</span><div><b>Read-only AI monitor</b><small>Analyzes financial data. Never moves money.</small></div></section>
        <section className="gvConnection"><i /> <div><b>Data connection</b><small>Manual + CSV active</small></div></section>
      </aside>

      <section className="gvDashboard" id="overview">
        <header className="gvHeader">
          <div><p className="gvEyebrow">GALACTIC TRUST BUSINESS</p><h1>AI Financial Monitor</h1><span>Track what came in, what went out, what changed, and what needs attention.</span></div>
          <div className="gvHeaderTools">
            <label className="gvSearch"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search finances…" /></label>
            <button type="button" className="gvAlertButton" onClick={() => document.querySelector('#watchlist')?.scrollIntoView()} aria-label="Open watchlist">◇<i>{alerts.length}</i></button>
          </div>
        </header>

        <section className="gvTopGrid">
          <article className="gvHero">
            <div className="gvHeroContent"><small>OPERATING CASH</small><strong>{money(cash, 2)}</strong><p className={snapshot.net >= 0 ? 'positive' : 'negative'}>{snapshot.net >= 0 ? '↑' : '↓'} {money(Math.abs(snapshot.net))} <span>net tracked cash flow</span></p></div>
            <div className="gvPlanet"><i /><b>✦</b></div>
            <div className="gvHeroFooter"><span>30-day forecast <b>{money(snapshot.forecast)}</b></span><span>Simple runway <b>{snapshot.runwayDays} days</b></span></div>
          </article>

          <article className="gvHealthCard">
            <div className="gvCardHead"><div><small>BUSINESS HEALTH</small><h2>{health}/100</h2></div><span className={health >= 75 ? 'good' : health >= 55 ? 'fair' : 'risk'}>{health >= 75 ? 'Healthy' : health >= 55 ? 'Watch' : 'At risk'}</span></div>
            <div className="gvHealthTrack"><i style={{ width: `${health}%` }} /></div>
            <div className="gvHealthStats"><span><b>{snapshot.net >= 0 ? 'Positive' : 'Negative'}</b><small>cash flow</small></span><span><b>{snapshot.runwayDays}d</b><small>runway</small></span><span><b>{transactions.filter((item) => item.confidence < 80).length}</b><small>needs review</small></span></div>
          </article>
        </section>

        <section className="gvMetrics">
          <article><span className="blue">↙</span><div><small>Money Received</small><strong>{money(snapshot.income)}</strong><p>{transactions.filter((item) => item.direction === 'in').length} tracked inflows</p></div></article>
          <article><span className="pink">↗</span><div><small>Money Spent</small><strong>{money(snapshot.expenses)}</strong><p>{money(snapshot.recurring)} recurring</p></div></article>
          <article><span className={snapshot.net >= 0 ? 'green' : 'orange'}>⌁</span><div><small>Net Cash Flow</small><strong>{snapshot.net >= 0 ? '+' : '−'}{money(Math.abs(snapshot.net))}</strong><p>Tracked period</p></div></article>
          <article><span className="violet">◎</span><div><small>Recurring Share</small><strong>{snapshot.expenses ? Math.round((snapshot.recurring / snapshot.expenses) * 100) : 0}%</strong><p>of tracked spending</p></div></article>
        </section>

        <section className="gvActionBar" id="data">
          <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={importCsv} />
          <button type="button" onClick={() => fileRef.current?.click()}><span>⇩</span><b>Import CSV</b><small>Bring in bank/accounting exports</small></button>
          <button type="button" onClick={() => setShowAdd((value) => !value)}><span>＋</span><b>Add Activity</b><small>Track money in or out</small></button>
          <button type="button" onClick={exportCsv}><span>⇧</span><b>Export</b><small>Download current data</small></button>
          <button type="button" onClick={() => void askAi(undefined, 'What needs my attention today?')}><span>✦</span><b>Daily Brief</b><small>Ask AI what changed</small></button>
        </section>

        {showAdd && <form className="gvAddForm" onSubmit={addTransaction}>
          <label><span>Merchant or source</span><input value={merchant} onChange={(event) => setMerchant(event.target.value)} placeholder="e.g. Meta Ads" autoFocus /></label>
          <label><span>Amount</span><input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="0.00" /></label>
          <label><span>Direction</span><select value={direction} onChange={(event) => setDirection(event.target.value as Direction)}><option value="out">Money out</option><option value="in">Money in</option></select></label>
          <label className="gvCheck"><input type="checkbox" checked={recurring} onChange={(event) => setRecurring(event.target.checked)} /><span>Recurring</span></label>
          <button type="submit">Add + categorize</button>
        </form>}

        <section className="gvMainGrid">
          <div className="gvLeftStack">
            <section className="gvPanel" id="transactions">
              <div className="gvPanelHead"><div><small>TRANSACTIONS</small><h2>Financial activity</h2></div><b>{filteredTransactions.length} shown</b></div>
              <div className="gvFilters">
                {([['all', 'All'], ['in', 'Received'], ['out', 'Spent'], ['recurring', 'Recurring'], ['review', 'Needs review']] as [Filter, string][]).map(([value, label]) => <button type="button" key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{label}</button>)}
              </div>
              <div className="gvTransactionList">
                {filteredTransactions.slice(0, 12).map((item) => <article key={item.id}>
                  <span className={`gvTxIcon ${item.direction}`}>{item.direction === 'in' ? '↙' : '↗'}</span>
                  <div className="gvTxMeta"><b>{item.merchant}</b><small>{item.category} · AI {item.confidence}%{item.recurring ? ' · recurring' : ''}</small></div>
                  <div className={`gvTxAmount ${item.direction}`}><b>{item.direction === 'in' ? '+' : '−'}{money(item.amount, 2)}</b><small>{item.date}</small></div>
                </article>)}
                {!filteredTransactions.length && <p className="gvEmpty">No transactions match the current search and filter.</p>}
              </div>
            </section>

            <section className="gvPanel" id="scenario">
              <div className="gvPanelHead"><div><small>SCENARIO LAB</small><h2>What happens if…</h2></div><span className="gvPill">Planning only</span></div>
              <div className="gvScenarioControls">
                <label><span>New monthly hire cost</span><div><b>$</b><input value={hireCost} onChange={(event) => setHireCost(event.target.value)} inputMode="decimal" /></div></label>
                <label><span>Revenue change</span><div><input value={revenueChange} onChange={(event) => setRevenueChange(event.target.value)} inputMode="decimal" /><b>%</b></div></label>
              </div>
              <div className="gvScenarioResult"><span><small>Scenario net cash flow</small><b className={scenario.scenarioNet >= 0 ? 'positive' : 'negative'}>{scenario.scenarioNet >= 0 ? '+' : '−'}{money(Math.abs(scenario.scenarioNet))}</b></span><span><small>Estimated ending cash</small><b>{money(scenario.endingCash)}</b></span></div>
              <p className="gvFine">Uses the current tracked period as a simple planning baseline. It is not an accounting forecast or guarantee.</p>
            </section>
          </div>

          <aside className="gvRightStack">
            <section className="gvAiPanel" id="ai">
              <div className="gvAiHead"><div><span>✦</span><div><small>GALACTIC AI</small><h2>Financial Manager</h2></div></div><b>READ-ONLY</b></div>
              <div className="gvAiMessage">{answer}</div>
              <div className="gvAiChips">{['Where is money going?', 'How is our runway?', 'Can we afford to hire?', 'Show recurring costs'].map((text) => <button type="button" key={text} onClick={() => void askAi(undefined, text)}>{text}</button>)}</div>
              <form onSubmit={(event) => void askAi(event)}><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ask your finances anything…" /><button type="submit" disabled={asking}>{asking ? '…' : '➤'}</button></form>
              <p>Analysis only. The AI cannot transfer, withdraw, invest, borrow, or approve payments.</p>
            </section>

            <section className="gvPanel" id="watchlist">
              <div className="gvPanelHead"><div><small>AI WATCHLIST</small><h2>Needs attention</h2></div><b>{alerts.length}</b></div>
              <div className="gvWatchlist">{alerts.map((alert) => <article key={alert.title} className={alert.tone}><span>{alert.tone === 'good' ? '✓' : alert.tone === 'warn' ? '!' : 'i'}</span><div><b>{alert.title}</b><p>{alert.body}</p></div></article>)}</div>
            </section>

            <section className="gvPanel">
              <div className="gvPanelHead"><div><small>SPENDING MIX</small><h2>Top categories</h2></div><b>{money(snapshot.expenses)}</b></div>
              <div className="gvCategories">{snapshot.categories.slice(0, 5).map((category) => <article key={category.name}><div><span>{category.name}</span><b>{category.percent}%</b></div><i><b style={{ width: `${Math.max(3, category.percent)}%` }} /></i><small>{money(category.amount)}</small></article>)}</div>
            </section>

            <section className="gvDataCard">
              <div><span>◎</span><div><small>LIVE BANK SYNC</small><b>Not connected yet</b></div></div>
              <p>This version analyzes manual entries and CSV imports. A production read-only bank/accounting connector can be added later without giving Galactic AI permission to move money.</p>
            </section>
          </aside>
        </section>

        <div className="gvStatus" role="status"><span>●</span>{status}<button type="button" onClick={resetDemo}>Reset demo</button></div>
        <footer>Galactic Trust Business is a financial monitoring and decision-support product, not a bank or accounting firm. Forecasts and AI outputs are estimates based only on the data provided.</footer>
      </section>
    </main>
  );
}
