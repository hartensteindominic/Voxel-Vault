'use client';

import type { ChangeEvent, FormEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import './reference-dashboard.css';

type Direction = 'in' | 'out';

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

type FinanceState = {
  cash: number;
  transactions: Transaction[];
};

type AiSnapshot = {
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

const STORAGE_KEY = 'galactic-business-reference-v1';

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

const categoryIcons: Record<string, string> = {
  'Payroll': '♟',
  'Advertising': '◉',
  'Rent': '⌂',
  'Inventory': '▣',
  'Software & Cloud': '✦',
  'Revenue': '↙',
  'Other': '•',
};

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
  if (/payroll|gusto|salary|wage/.test(text)) return { category: 'Payroll', confidence: 99 };
  if (/meta|facebook|google ads|marketing|adwords/.test(text)) return { category: 'Advertising', confidence: 98 };
  if (/aws|adobe|workspace|software|hosting|cloud|saas/.test(text)) return { category: 'Software & Cloud', confidence: 96 };
  if (/rent|lease/.test(text)) return { category: 'Rent', confidence: 98 };
  if (/supplier|supply|inventory|wholesale/.test(text)) return { category: 'Inventory', confidence: 92 };
  return { category: 'Other', confidence: 74 };
}

function localAnswer(question: string, snapshot: AiSnapshot) {
  const q = question.toLowerCase();
  const biggest = snapshot.categories[0];
  if (/revenue|received|income|sales/.test(q)) {
    return `The business received ${money(snapshot.income)} in the tracked period. After ${money(snapshot.expenses)} of spending, net cash flow is ${snapshot.net >= 0 ? '+' : ''}${money(snapshot.net)}.`;
  }
  if (/spend|expense|where|cost/.test(q)) {
    return biggest
      ? `${biggest.name} is the largest tracked spending area at ${money(biggest.amount)} (${biggest.percent}% of expenses). Total spending is ${money(snapshot.expenses)}.`
      : `No spending has been tracked yet.`;
  }
  if (/runway|cash/.test(q)) {
    return `Available operating cash is ${money(snapshot.cash)}. At the current tracked spending pace, the simple runway estimate is about ${snapshot.runwayDays} days. This is a planning signal, not an accounting forecast.`;
  }
  if (/hire|employee|afford/.test(q)) {
    return `Current net cash flow is ${snapshot.net >= 0 ? '+' : ''}${money(snapshot.net)} and the 30-day ending-cash estimate is ${money(snapshot.forecast)}. Model the full compensation, taxes, benefits, and at least several months of runway before committing to a hire.`;
  }
  if (/subscription|recurring|software/.test(q)) {
    return `${money(snapshot.recurring)} of tracked spending is marked recurring. Review recurring vendors for owner, usage, renewal date, and price changes before the next billing cycle.`;
  }
  return `I see ${money(snapshot.income)} received, ${money(snapshot.expenses)} spent, and ${snapshot.net >= 0 ? '+' : ''}${money(snapshot.net)} net cash flow. Ask me about spending, revenue, runway, recurring costs, or a planned hire.`;
}

function PlanetLogo() {
  return (
    <span className="rbPlanetLogo" aria-hidden="true">
      <span className="rbPlanetBody" />
      <span className="rbPlanetRing" />
      <span className="rbPlanetStar">★</span>
    </span>
  );
}

function Sparkline({ variant }: { variant: 'blue' | 'teal' }) {
  const d = variant === 'blue'
    ? 'M2 38 C18 28 25 38 41 31 S64 35 81 23 S101 30 119 19 S141 26 157 14 S177 22 194 7 S215 12 228 2'
    : 'M2 38 C17 34 27 41 44 34 S69 37 86 28 S109 31 126 22 S148 29 166 17 S188 20 205 9 S219 13 230 3';
  return (
    <svg className={`rbSpark ${variant}`} viewBox="0 0 232 44" aria-hidden="true">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function ReferenceBusinessDashboard() {
  const [cash, setCash] = useState(84230.72);
  const [transactions, setTransactions] = useState(seedTransactions);
  const [hydrated, setHydrated] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [merchant, setMerchant] = useState('');
  const [amount, setAmount] = useState('');
  const [direction, setDirection] = useState<Direction>('out');
  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState('Your business is cash-flow positive. Payroll is the largest expense, and recurring software costs are worth reviewing before the next billing cycle.');
  const [asking, setAsking] = useState(false);
  const [status, setStatus] = useState('Demo workspace · read-only monitoring mode');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<FinanceState>;
        if (typeof parsed.cash === 'number' && Number.isFinite(parsed.cash)) setCash(parsed.cash);
        if (Array.isArray(parsed.transactions) && parsed.transactions.length) setTransactions(parsed.transactions);
        setStatus('Saved business workspace restored on this device');
      }
    } catch {
      setStatus('Using demo data because saved data could not be restored');
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ cash, transactions } satisfies FinanceState));
  }, [cash, hydrated, transactions]);

  const snapshot = useMemo<AiSnapshot>(() => {
    const income = transactions.filter((item) => item.direction === 'in').reduce((sum, item) => sum + item.amount, 0);
    const expenses = transactions.filter((item) => item.direction === 'out').reduce((sum, item) => sum + item.amount, 0);
    const net = income - expenses;
    const recurring = transactions.filter((item) => item.direction === 'out' && item.recurring).reduce((sum, item) => sum + item.amount, 0);
    const totals = new Map<string, number>();
    transactions.filter((item) => item.direction === 'out').forEach((item) => totals.set(item.category, (totals.get(item.category) || 0) + item.amount));
    const categories = [...totals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, categoryAmount]) => ({
        name,
        amount: categoryAmount,
        percent: expenses ? Math.round((categoryAmount / expenses) * 100) : 0,
      }));
    const dailySpend = expenses / 30;
    const runwayDays = dailySpend ? Math.max(0, Math.round(cash / dailySpend)) : 999;
    const forecast = Math.max(0, cash + net * 0.68);
    return { cash, income, expenses, net, recurring, forecast, runwayDays, categories, recent: transactions.slice(0, 8) };
  }, [cash, transactions]);

  const alerts = useMemo(() => {
    const results = [
      { tone: 'warning', icon: '!', title: 'Software cost increased', body: `Recurring costs total ${money(snapshot.recurring)}. Review renewals and price changes.` },
      { tone: 'good', icon: '↗', title: 'Cash flow is positive', body: `${snapshot.net >= 0 ? '+' : ''}${money(snapshot.net)} net from tracked activity.` },
      { tone: 'info', icon: '◈', title: 'Revenue pace', body: `${money(snapshot.income)} received across ${transactions.filter((item) => item.direction === 'in').length} tracked inflows.` },
    ];
    const lowConfidence = transactions.find((item) => item.confidence < 80);
    if (lowConfidence) results.unshift({ tone: 'warning', icon: '?', title: 'Category needs review', body: `${lowConfidence.merchant} was classified with ${lowConfidence.confidence}% confidence.` });
    return results.slice(0, 3);
  }, [snapshot, transactions]);

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
      confidence: ai.confidence,
    };
    setTransactions((current) => [item, ...current]);
    setCash((current) => current + (direction === 'in' ? numeric : -numeric));
    setStatus(`AI categorized ${cleanMerchant} as ${ai.category} with ${ai.confidence}% confidence`);
    setMerchant('');
    setAmount('');
    setShowAdd(false);
  }

  async function importCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const lines = (await file.text()).replace(/\r/g, '').split('\n').filter(Boolean);
      if (lines.length < 2) throw new Error('CSV needs a header row plus transactions.');
      const headers = lines[0].split(',').map((value) => value.trim().toLowerCase());
      const merchantIndex = headers.findIndex((value) => ['merchant', 'description', 'name', 'memo'].includes(value));
      const amountIndex = headers.findIndex((value) => ['amount', 'value'].includes(value));
      const typeIndex = headers.findIndex((value) => ['type', 'direction'].includes(value));
      if (merchantIndex < 0 || amountIndex < 0) throw new Error('CSV must include merchant/description and amount columns.');
      const imported = lines.slice(1).flatMap((line, index) => {
        const cells = line.split(',').map((value) => value.trim().replace(/^"|"$/g, ''));
        const cleanMerchant = cells[merchantIndex];
        const raw = Number((cells[amountIndex] || '').replace(/[$,]/g, ''));
        if (!cleanMerchant || !Number.isFinite(raw) || raw === 0) return [];
        const type = (cells[typeIndex] || '').toLowerCase();
        const rowDirection: Direction = /income|credit|in|received/.test(type) ? 'in' : /expense|debit|out|spent/.test(type) ? 'out' : raw < 0 ? 'out' : 'in';
        const ai = classify(cleanMerchant, rowDirection);
        return [{
          id: `csv_${Date.now()}_${index}`,
          date: 'Imported',
          merchant: cleanMerchant,
          category: ai.category,
          direction: rowDirection,
          amount: Math.abs(raw),
          confidence: ai.confidence,
        } satisfies Transaction];
      });
      if (!imported.length) throw new Error('No valid transaction rows were found.');
      setTransactions((current) => [...imported, ...current]);
      setStatus(`Imported and AI-categorized ${imported.length} transactions. Cash balance was not changed.`);
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
    setAnswer('Analyzing your tracked cash flow…');
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

  return (
    <main className="rbApp">
      <aside className="rbSidebar">
        <a className="rbBrand" href="#overview"><PlanetLogo /><span>Galactic<br />Business</span></a>
        <nav className="rbNav" aria-label="Business finance navigation">
          <a className="active" href="#overview"><span>⌂</span>Dashboard</a>
          <a href="#cashflow"><span>▣</span>Cash Flow</a>
          <a href="#transactions"><span>⇄</span>Transactions</a>
          <a href="#received"><span>↙</span>Money Received</a>
          <a href="#spent"><span>↗</span>Spending</a>
          <a href="#ai-manager"><span>✦</span>AI Manager</a>
          <a href="#forecast"><span>⌁</span>Forecasts</a>
          <a href="#alerts"><span>◇</span>Alerts</a>
          <a href="#reports"><span>▤</span>Reports</a>
        </nav>
        <div className="rbSidebarSpacer" />
        <div className="rbModeCard">
          <span className="rbModeOrb">✦</span>
          <strong>AI monitoring active</strong>
          <p>Read, analyze, explain. Never move money automatically.</p>
        </div>
        <div className="rbSideUtilities">
          <a href="#data"><span>⚙</span>Data & Settings</a>
          <a href="#help"><span>?</span>Help Center</a>
        </div>
      </aside>

      <section className="rbDashboard" id="overview">
        <header className="rbHeader">
          <div>
            <h1>Welcome back, Nova Labs! <span>👋</span></h1>
            <p>Here&apos;s what&apos;s happening across your business today.</p>
          </div>
          <div className="rbHeaderTools">
            <label className="rbSearch"><input placeholder="Search finances…" /><span>⌕</span></label>
            <button className="rbBell" type="button" aria-label="Financial alerts">♧<i>{alerts.length}</i></button>
            <button className="rbProfile" type="button"><span className="rbAvatar">N</span><b>Nova Labs</b><span>⌄</span></button>
          </div>
        </header>

        <div className="rbContentGrid">
          <section className="rbMainColumn">
            <article className="rbHero" id="cashflow">
              <div className="rbHeroCopy">
                <div className="rbHeroLabel">Operating Cash <span>◉</span></div>
                <div className="rbHeroAmount">{money(cash, 2)}</div>
                <div className={`rbHeroGrowth ${snapshot.net < 0 ? 'negative' : ''}`}>
                  {snapshot.net >= 0 ? '↑' : '↓'} <b>{money(Math.abs(snapshot.net))}</b> <span>net tracked cash flow</span>
                </div>
              </div>
              <div className="rbHeroStars">✦</div>
              <div className="rbHeroPlanet big"><span /></div>
              <div className="rbHeroPlanet small"><span /></div>
              <div className="rbHeroHorizon" />
            </article>

            <section className="rbQuickActions" id="data">
              <input ref={fileRef} className="rbHiddenInput" type="file" accept=".csv,text/csv" onChange={importCsv} />
              <button type="button" onClick={() => fileRef.current?.click()}><span className="blue">⇩</span><b>Import Data</b><small>Bank or CSV export</small></button>
              <button type="button" onClick={() => setShowAdd((value) => !value)}><span className="teal">＋</span><b>Add Activity</b><small>Record money in/out</small></button>
              <button type="button" onClick={() => void askAi(undefined, 'What needs my attention today?')}><span className="purple">✦</span><b>Ask AI</b><small>Explain the numbers</small></button>
              <a href="#forecast"><span className="pink">⌁</span><b>Forecast</b><small>See what happens next</small></a>
            </section>

            {showAdd && (
              <form className="rbAddForm" onSubmit={addTransaction}>
                <div><label>Merchant or source</label><input value={merchant} onChange={(event) => setMerchant(event.target.value)} placeholder="e.g. Meta Ads" autoFocus /></div>
                <div><label>Amount</label><input value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" inputMode="decimal" /></div>
                <div><label>Direction</label><select value={direction} onChange={(event) => setDirection(event.target.value as Direction)}><option value="out">Money out</option><option value="in">Money in</option></select></div>
                <button type="submit">AI categorize</button>
              </form>
            )}

            <div className="rbAccountGrid">
              <article className="rbMetricCard" id="received">
                <div className="rbMetricTitle"><span className="rbMetricIcon blue">↙</span><span>Money Received<strong>{money(snapshot.income, 2)}</strong><small>Tracked this period</small></span><b className="rbTrend up">+12.4%</b></div>
                <Sparkline variant="blue" />
              </article>
              <article className="rbMetricCard" id="spent">
                <div className="rbMetricTitle"><span className="rbMetricIcon teal">↗</span><span>Money Spent<strong>{money(snapshot.expenses, 2)}</strong><small>{money(snapshot.recurring)} recurring</small></span><b className="rbTrend down">−3.8%</b></div>
                <Sparkline variant="teal" />
              </article>
            </div>

            <section className="rbActivityCard" id="transactions">
              <div className="rbSectionHeading"><div><h2>Recent Activity</h2><small>AI-categorized business transactions</small></div><span>{transactions.length} tracked</span></div>
              <div className="rbActivityList">
                {transactions.slice(0, 7).map((item) => (
                  <div className="rbActivityRow" key={item.id}>
                    <span className={`rbMerchantIcon ${item.direction}`}>{categoryIcons[item.category] || '•'}</span>
                    <span className="rbActivityMeta"><b>{item.merchant}</b><small>{item.category} · AI {item.confidence}%{item.recurring ? ' · recurring' : ''}</small></span>
                    <span className={`rbActivityAmount ${item.direction}`}><b>{item.direction === 'in' ? '+' : '−'}{money(item.amount, 2)}</b><small>{item.date}</small></span>
                  </div>
                ))}
              </div>
            </section>
          </section>

          <aside className="rbRightColumn">
            <section className="rbAiCard" id="ai-manager">
              <div className="rbAiTop"><div><span className="rbAiOrb">✦</span><span><small>GALACTIC AI</small><h2>Financial Manager</h2></span></div><i>LIVE</i></div>
              <div className="rbAiMessage">{answer}</div>
              <div className="rbChips">
                {['Where is money going?', 'Can we afford to hire?', 'How is our runway?'].map((text) => <button key={text} type="button" onClick={() => void askAi(undefined, text)}>{text}</button>)}
              </div>
              <form className="rbComposer" onSubmit={(event) => void askAi(event)}><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ask your finances anything…" /><button type="submit" disabled={asking} aria-label="Ask AI">➤</button></form>
              <p>Analysis only. The AI cannot transfer, withdraw, invest, or approve payments.</p>
            </section>

            <section className="rbAlertsCard" id="alerts">
              <div className="rbSectionHeading"><div><h2>AI Watchlist</h2><small>What needs attention</small></div><a href="#alerts">View All</a></div>
              <div className="rbAlertsList">
                {alerts.map((alert) => (
                  <article className={alert.tone} key={alert.title}><span>{alert.icon}</span><div><b>{alert.title}</b><p>{alert.body}</p></div><em>›</em></article>
                ))}
              </div>
            </section>

            <section className="rbInsightsCard" id="reports">
              <div className="rbSectionHeading"><div><h2>Spending Insights</h2><small>This tracked period</small></div><button type="button">This Month⌄</button></div>
              <div className="rbInsightsTotal"><strong>{money(snapshot.expenses, 2)}</strong><span>Total Spent <i>AI analyzed</i></span></div>
              <div className="rbInsightsBody">
                <div className="rbLegend">
                  {snapshot.categories.map((category, index) => (
                    <div key={category.name}><span className={`rbDot d${index + 1}`} />{category.name}<b>{money(category.amount)}&nbsp;&nbsp; {category.percent}%</b></div>
                  ))}
                </div>
                <div className="rbDonut" aria-label="Business spending breakdown"><span>✦</span></div>
              </div>
            </section>

            <section className="rbForecastCard" id="forecast">
              <div><span className="rbForecastIcon">⌁</span><div><small>30-DAY FORECAST</small><h2>{money(snapshot.forecast)}</h2></div></div>
              <p>Projected ending cash based on tracked inflows and outflows. Estimated simple runway: <b>{snapshot.runwayDays} days</b>.</p>
              <div className="rbForecastTrack"><i style={{ width: `${Math.min(100, Math.max(12, snapshot.runwayDays / 1.8))}%` }} /></div>
            </section>
          </aside>
        </div>

        <div className="rbStatus" role="status"><span>●</span>{status}</div>
        <footer className="rbFooter" id="help">Business monitoring is currently a demo workspace until production data connectors are configured. Forecasts and AI outputs are decision-support tools, not accounting, tax, legal, credit, or investment advice.</footer>
      </section>
    </main>
  );
}
