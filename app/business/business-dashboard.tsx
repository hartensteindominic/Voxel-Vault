'use client';

import type { ChangeEvent, FormEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import './business.css';

type TransactionType = 'income' | 'expense';

type Transaction = {
  id: string;
  date: string;
  description: string;
  category: string;
  type: TransactionType;
  amount: number;
  recurring?: boolean;
  confidence: number;
};

type Insight = {
  tone: 'good' | 'warn' | 'info';
  title: string;
  body: string;
};

type StoredFinanceState = {
  transactions: Transaction[];
  cash: number;
};

const STORAGE_KEY = 'galactic-business-finance-v2';

const seedTransactions: Transaction[] = [
  { id: 't1', date: 'Aug 31', description: 'Stripe payouts', category: 'Revenue', type: 'income', amount: 8420, confidence: 99 },
  { id: 't2', date: 'Aug 30', description: 'Meta Ads', category: 'Advertising', type: 'expense', amount: 1742, recurring: true, confidence: 98 },
  { id: 't3', date: 'Aug 29', description: 'Acme Client Invoice #1842', category: 'Revenue', type: 'income', amount: 4500, confidence: 97 },
  { id: 't4', date: 'Aug 28', description: 'Gusto Payroll', category: 'Payroll', type: 'expense', amount: 3980, recurring: true, confidence: 99 },
  { id: 't5', date: 'Aug 27', description: 'AWS Cloud Services', category: 'Software & Cloud', type: 'expense', amount: 638, recurring: true, confidence: 96 },
  { id: 't6', date: 'Aug 25', description: 'Office lease', category: 'Rent', type: 'expense', amount: 2200, recurring: true, confidence: 99 },
  { id: 't7', date: 'Aug 23', description: 'Client payment - Northstar', category: 'Revenue', type: 'income', amount: 5500, confidence: 95 },
  { id: 't8', date: 'Aug 22', description: 'Adobe Creative Cloud', category: 'Software & Cloud', type: 'expense', amount: 89.99, recurring: true, confidence: 99 },
  { id: 't9', date: 'Aug 20', description: 'Google Workspace', category: 'Software & Cloud', type: 'expense', amount: 72, recurring: true, confidence: 99 },
  { id: 't10', date: 'Aug 18', description: 'Business insurance', category: 'Insurance', type: 'expense', amount: 420, recurring: true, confidence: 94 },
];

function money(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

function classify(description: string, type: TransactionType) {
  const text = description.toLowerCase();
  if (type === 'income') return { category: 'Revenue', confidence: 97 };
  if (/meta|facebook|google ads|adwords|marketing/.test(text)) return { category: 'Advertising', confidence: 98 };
  if (/gusto|payroll|salary|wage/.test(text)) return { category: 'Payroll', confidence: 99 };
  if (/aws|adobe|workspace|software|saas|hosting|cloud/.test(text)) return { category: 'Software & Cloud', confidence: 96 };
  if (/rent|lease/.test(text)) return { category: 'Rent', confidence: 98 };
  if (/insurance/.test(text)) return { category: 'Insurance', confidence: 96 };
  if (/inventory|supplier|wholesale/.test(text)) return { category: 'Inventory', confidence: 91 };
  if (/flight|hotel|uber|lyft|travel/.test(text)) return { category: 'Travel', confidence: 90 };
  if (/electric|water|utility|internet|phone/.test(text)) return { category: 'Utilities', confidence: 91 };
  if (/irs|tax/.test(text)) return { category: 'Taxes', confidence: 94 };
  return { category: 'Other', confidence: 68 };
}

function isTransaction(value: unknown): value is Transaction {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<Transaction>;
  return typeof item.id === 'string'
    && typeof item.date === 'string'
    && typeof item.description === 'string'
    && typeof item.category === 'string'
    && (item.type === 'income' || item.type === 'expense')
    && typeof item.amount === 'number'
    && Number.isFinite(item.amount)
    && typeof item.confidence === 'number';
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
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

function parseAmount(raw: string) {
  const parenthetical = /^\(.*\)$/.test(raw.trim());
  const numeric = Number(raw.replace(/[\s,$()]/g, ''));
  if (!Number.isFinite(numeric)) return NaN;
  return parenthetical ? -Math.abs(numeric) : numeric;
}

function parseCsv(text: string) {
  const lines = text.replace(/\r/g, '').split('\n').filter((line) => line.trim());
  if (lines.length < 2) throw new Error('CSV needs a header row and at least one transaction.');

  const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase().replace(/[^a-z0-9]/g, ''));
  const indexOf = (...names: string[]) => headers.findIndex((header) => names.includes(header));
  const descriptionIndex = indexOf('description', 'merchant', 'name', 'memo');
  const amountIndex = indexOf('amount', 'value');
  const dateIndex = indexOf('date', 'transactiondate');
  const typeIndex = indexOf('type', 'transactiontype', 'direction');
  const categoryIndex = indexOf('category', 'aicategory');
  const recurringIndex = indexOf('recurring', 'isrecurring');

  if (descriptionIndex < 0 || amountIndex < 0) {
    throw new Error('CSV must include description and amount columns.');
  }

  const imported: Transaction[] = [];
  lines.slice(1).forEach((line, lineIndex) => {
    const cells = parseCsvLine(line);
    const description = String(cells[descriptionIndex] || '').trim();
    const signedAmount = parseAmount(String(cells[amountIndex] || ''));
    if (!description || !Number.isFinite(signedAmount) || signedAmount === 0) return;

    const rawType = typeIndex >= 0 ? String(cells[typeIndex] || '').toLowerCase() : '';
    const type: TransactionType = /income|credit|received|inflow/.test(rawType)
      ? 'income'
      : /expense|debit|spent|outflow/.test(rawType)
        ? 'expense'
        : signedAmount < 0
          ? 'expense'
          : 'income';
    const ai = classify(description, type);
    const suppliedCategory = categoryIndex >= 0 ? String(cells[categoryIndex] || '').trim() : '';
    const recurringRaw = recurringIndex >= 0 ? String(cells[recurringIndex] || '').toLowerCase() : '';

    imported.push({
      id: `csv_${Date.now()}_${lineIndex}`,
      date: dateIndex >= 0 && cells[dateIndex] ? cells[dateIndex] : 'Imported',
      description,
      category: suppliedCategory || ai.category,
      type,
      amount: Math.abs(signedAmount),
      recurring: /^(true|yes|1|recurring)$/.test(recurringRaw),
      confidence: suppliedCategory ? 100 : ai.confidence
    });
  });

  if (!imported.length) throw new Error('No valid transactions were found in the CSV.');
  return imported;
}

function csvCell(value: string | number | boolean | undefined) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function answerQuestion(question: string, transactions: Transaction[], cash: number) {
  const q = question.toLowerCase();
  const income = transactions.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const expenses = transactions.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const net = income - expenses;
  const recurring = transactions.filter((t) => t.type === 'expense' && t.recurring).reduce((sum, t) => sum + t.amount, 0);
  const biggest = [...transactions].filter((t) => t.type === 'expense').sort((a, b) => b.amount - a.amount)[0];
  const adSpend = transactions.filter((t) => t.category === 'Advertising').reduce((sum, t) => sum + t.amount, 0);
  const software = transactions.filter((t) => t.category === 'Software & Cloud').reduce((sum, t) => sum + t.amount, 0);

  if (/advert|marketing|meta|facebook/.test(q)) return `Advertising spend is ${money(adSpend)} in the tracked period. That is ${expenses ? Math.round((adSpend / expenses) * 100) : 0}% of expenses. I would watch it against revenue generated from those campaigns before increasing budget.`;
  if (/software|subscription|saas/.test(q)) return `Software and cloud spend is ${money(software)}. Recurring operating expenses currently total about ${money(recurring)}. Review recurring vendors monthly and cancel tools with no clear owner or usage.`;
  if (/afford|hire|employee/.test(q)) return `Current tracked net cash flow is ${money(net)} and cash available is ${money(cash)}. A new fixed monthly hire should be tested against at least 3-6 months of runway. This view does not yet include every tax, debt, or future obligation, so treat it as a planning signal rather than approval.`;
  if (/biggest|highest|largest|expense/.test(q) && biggest) return `The largest tracked expense is ${biggest.description} at ${money(biggest.amount)} in ${biggest.category}.`;
  if (/runway|cash/.test(q)) return `Cash available is ${money(cash)}. Based only on the tracked expense pace, estimated runway is about ${expenses ? (cash / expenses).toFixed(1) : '—'} tracked periods. Connect complete account data before relying on this for decisions.`;
  if (/income|revenue|received|sales/.test(q)) return `Tracked money received is ${money(income)} and tracked money spent is ${money(expenses)}, leaving net cash flow of ${money(net)}.`;
  return `For the tracked period, the business received ${money(income)}, spent ${money(expenses)}, and generated ${money(net)} in net cash flow. The biggest controllable areas are ${biggest ? `${biggest.category} and recurring operating costs` : 'recurring operating costs'}. Ask me about advertising, subscriptions, runway, hiring, or the largest expense.`;
}

export function BusinessDashboard() {
  const [transactions, setTransactions] = useState(seedTransactions);
  const [cash, setCash] = useState(24850);
  const [hydrated, setHydrated] = useState(false);
  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState('I monitor the business money coming in and going out. Ask what changed, where money is going, or whether a planned expense looks sustainable.');
  const [showAdd, setShowAdd] = useState(false);
  const [newDescription, setNewDescription] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newType, setNewType] = useState<TransactionType>('expense');
  const [dataMessage, setDataMessage] = useState('Local demo workspace · changes stay on this device');
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<StoredFinanceState>;
        if (Array.isArray(parsed.transactions)) {
          const valid = parsed.transactions.filter(isTransaction);
          if (valid.length) setTransactions(valid);
        }
        if (typeof parsed.cash === 'number' && Number.isFinite(parsed.cash)) setCash(parsed.cash);
        setDataMessage('Saved business workspace restored from this device');
      }
    } catch {
      setDataMessage('Could not restore saved data; using the demo workspace');
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const state: StoredFinanceState = { transactions, cash };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [cash, hydrated, transactions]);

  const stats = useMemo(() => {
    const income = transactions.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const expenses = transactions.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    const recurring = transactions.filter((t) => t.type === 'expense' && t.recurring).reduce((sum, t) => sum + t.amount, 0);
    const net = income - expenses;
    const margin = income ? Math.round((net / income) * 100) : 0;
    return { income, expenses, recurring, net, margin };
  }, [transactions]);

  const categories = useMemo(() => {
    const totals = new Map<string, number>();
    transactions.filter((t) => t.type === 'expense').forEach((t) => totals.set(t.category, (totals.get(t.category) || 0) + t.amount));
    return [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [transactions]);

  const anomalies = useMemo(() => {
    const findings: string[] = [];
    const expenses = transactions.filter((t) => t.type === 'expense');
    const byCategory = new Map<string, Transaction[]>();
    expenses.forEach((transaction) => {
      const group = byCategory.get(transaction.category) || [];
      group.push(transaction);
      byCategory.set(transaction.category, group);
    });

    expenses.forEach((transaction) => {
      const group = byCategory.get(transaction.category) || [];
      if (group.length < 2) return;
      const comparison = group.filter((item) => item.id !== transaction.id);
      const average = comparison.reduce((sum, item) => sum + item.amount, 0) / Math.max(1, comparison.length);
      if (average > 0 && transaction.amount >= 250 && transaction.amount > average * 2.25) {
        findings.push(`${transaction.description} is ${Math.round(transaction.amount / average)}× the usual tracked ${transaction.category.toLowerCase()} amount.`);
      }
    });

    const seen = new Set<string>();
    transactions.forEach((transaction) => {
      const key = `${transaction.type}:${transaction.description.toLowerCase()}:${transaction.amount.toFixed(2)}`;
      if (seen.has(key)) findings.push(`Possible duplicate: ${transaction.description} for ${money(transaction.amount)} appears more than once.`);
      seen.add(key);
    });

    return [...new Set(findings)].slice(0, 3);
  }, [transactions]);

  const insights = useMemo<Insight[]>(() => {
    const adSpend = transactions.filter((t) => t.category === 'Advertising').reduce((sum, t) => sum + t.amount, 0);
    const software = transactions.filter((t) => t.category === 'Software & Cloud').reduce((sum, t) => sum + t.amount, 0);
    const lowConfidence = transactions.filter((t) => t.confidence < 80).length;
    const result: Insight[] = [];

    if (anomalies[0]) result.push({ tone: 'warn', title: 'Potential anomaly detected', body: anomalies[0] });
    result.push({ tone: stats.net >= 0 ? 'good' : 'warn', title: stats.net >= 0 ? 'Positive cash flow' : 'Cash flow needs attention', body: `${money(stats.net)} net from ${money(stats.income)} received and ${money(stats.expenses)} spent.` });
    if (adSpend > stats.expenses * 0.2) result.push({ tone: 'warn', title: 'Advertising is a major spend area', body: `${money(adSpend)} represents ${Math.round((adSpend / stats.expenses) * 100)}% of tracked expenses. Compare it with attributable revenue.` });
    result.push({ tone: 'info', title: 'Recurring cost base', body: `${money(stats.recurring)} is marked recurring. Software and cloud account for ${money(software)}.` });
    if (lowConfidence) result.push({ tone: 'warn', title: `${lowConfidence} transaction${lowConfidence > 1 ? 's' : ''} need review`, body: 'Classification confidence is below 80%. Confirm the category before using reports for accounting.' });
    return result.slice(0, 3);
  }, [anomalies, transactions, stats]);

  function addTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Number(newAmount);
    const description = newDescription.trim();
    if (!description || !Number.isFinite(amount) || amount <= 0) return;
    const ai = classify(description, newType);
    const item: Transaction = {
      id: `t_${Date.now()}`,
      date: new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date()),
      description,
      category: ai.category,
      type: newType,
      amount,
      confidence: ai.confidence,
      recurring: false
    };
    setTransactions((current) => [item, ...current]);
    setCash((current) => current + (newType === 'income' ? amount : -amount));
    setDataMessage(`Saved ${newType === 'income' ? 'money received' : 'expense'} and updated the working cash balance`);
    setNewDescription('');
    setNewAmount('');
    setShowAdd(false);
  }

  function askAi(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = query.trim();
    if (!text) return;
    setAnswer(answerQuestion(text, transactions, cash));
  }

  async function importCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const imported = parseCsv(await file.text());
      setTransactions((current) => [...imported, ...current]);
      setDataMessage(`Imported ${imported.length} transactions. Current cash was left unchanged because CSV history may not represent today’s bank balance.`);
    } catch (error) {
      setDataMessage(error instanceof Error ? error.message : 'CSV import failed.');
    }
  }

  function exportCsv() {
    const header = ['date', 'description', 'category', 'type', 'amount', 'recurring', 'confidence'];
    const rows = transactions.map((transaction) => [
      transaction.date,
      transaction.description,
      transaction.category,
      transaction.type,
      transaction.amount.toFixed(2),
      Boolean(transaction.recurring),
      transaction.confidence
    ].map(csvCell).join(','));
    const blob = new Blob([[header.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `galactic-business-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setDataMessage(`Exported ${transactions.length} tracked transactions`);
  }

  return (
    <main className="bizShell">
      <aside className="bizSidebar">
        <a className="bizBrand" href="/"><span className="bizMark">✦</span><span><b>Galactic</b><small>Business AI</small></span></a>
        <nav>
          <a className="active" href="#overview"><span>⌂</span>Overview</a>
          <a href="#transactions"><span>⇄</span>Transactions</a>
          <a href="#cashflow"><span>⌁</span>Cash Flow</a>
          <a href="#ai-manager"><span>✦</span>AI Manager</a>
          <a href="#reports"><span>▤</span>Reports</a>
        </nav>
        <div className="bizSideBottom">
          <div className="monitorBadge"><i />Monitoring active<small>Read & analyze only</small></div>
          <a href="/">← Personal dashboard</a>
        </div>
      </aside>

      <section className="bizMain" id="overview">
        <header className="bizHeader">
          <div><p className="eyebrow">BUSINESS FINANCE CONTROL CENTER</p><h1>Good morning, Nova Labs.</h1><p>Your AI finance manager is watching cash flow, spending, and money received.</p></div>
          <div className="bizHeaderActions">
            <span className="livePill"><i />AI monitoring</span>
            <input ref={importRef} className="csvInput" type="file" accept=".csv,text/csv" onChange={importCsv} />
            <button className="secondaryAction" type="button" onClick={() => importRef.current?.click()}>Import CSV</button>
            <button className="secondaryAction" type="button" onClick={exportCsv}>Export</button>
            <button type="button" onClick={() => setShowAdd((value) => !value)}>+ Add transaction</button>
          </div>
        </header>

        <div className="dataStatus" role="status"><span>●</span>{dataMessage}</div>

        {showAdd && (
          <form className="addTransaction" onSubmit={addTransaction}>
            <div><label>Description</label><input value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="e.g. Meta Ads" autoFocus /></div>
            <div><label>Amount</label><input value={newAmount} onChange={(e) => setNewAmount(e.target.value)} placeholder="0.00" inputMode="decimal" /></div>
            <div><label>Type</label><select value={newType} onChange={(e) => setNewType(e.target.value as TransactionType)}><option value="expense">Money out</option><option value="income">Money in</option></select></div>
            <button type="submit">Analyze & add</button>
          </form>
        )}

        <section className="healthHero">
          <div className="healthLead"><span className="healthDot">✦</span><div><small>BUSINESS HEALTH</small><strong>{stats.net >= 0 ? 'Healthy' : 'Needs attention'}</strong><p>{stats.net >= 0 ? 'Positive operating signal based on tracked cash activity' : 'Tracked spending is currently above tracked money received'}</p></div></div>
          <div className="healthMetric"><small>Cash available</small><strong>{money(cash)}</strong><span>Working balance on this device</span></div>
          <div className="healthMetric"><small>Net cash flow</small><strong className={stats.net >= 0 ? 'positive' : 'negative'}>{stats.net >= 0 ? '+' : ''}{money(stats.net)}</strong><span>{stats.margin}% of revenue</span></div>
          <div className="healthMetric"><small>AI watchlist</small><strong>{anomalies.length}</strong><span>{anomalies.length ? 'Potential anomalies found' : 'No duplicate/spike signals'}</span></div>
        </section>

        <section className="metricGrid" id="cashflow">
          <article><div className="metricIcon income">↓</div><span>Money received</span><strong>{money(stats.income)}</strong><small>Tracked this period</small></article>
          <article><div className="metricIcon expense">↑</div><span>Money spent</span><strong>{money(stats.expenses)}</strong><small>Tracked this period</small></article>
          <article><div className="metricIcon forecast">⌁</div><span>30-day forecast</span><strong>{money(Math.max(0, cash + stats.net * 0.82))}</strong><small>Projected ending cash</small></article>
          <article><div className="metricIcon margin">%</div><span>Cash-flow margin</span><strong>{stats.margin}%</strong><small>Net / money received</small></article>
        </section>

        <div className="bizGrid">
          <section className="bizPanel transactionsPanel" id="transactions">
            <div className="panelHead"><div><p className="eyebrow">AUTOMATIC CLASSIFICATION</p><h2>Recent transactions</h2></div><span>{transactions.length} tracked</span></div>
            <div className="transactionTable">
              <div className="transactionRow tableHead"><span>Transaction</span><span>AI category</span><span>Confidence</span><span>Amount</span></div>
              {transactions.slice(0, 8).map((item) => (
                <div className="transactionRow" key={item.id}>
                  <span className="merchant"><i className={item.type}>{item.type === 'income' ? '↓' : '↑'}</i><span><b>{item.description}</b><small>{item.date}{item.recurring ? ' · recurring' : ''}</small></span></span>
                  <span><em>{item.category}</em></span>
                  <span className={item.confidence < 80 ? 'confidence low' : 'confidence'}>{item.confidence}%</span>
                  <span className={`txAmount ${item.type}`}>{item.type === 'income' ? '+' : '−'}{money(item.amount)}</span>
                </div>
              ))}
            </div>
          </section>

          <aside className="bizPanel aiPanel" id="ai-manager">
            <div className="aiTitle"><span>✦</span><div><p className="eyebrow">GALACTIC AI</p><h2>Finance Manager</h2></div><i className="online" /></div>
            <div className="aiAnswer">{answer}</div>
            <div className="questionChips">
              {['Where is money going?', 'Can we afford to hire?', 'How much on advertising?'].map((text) => <button key={text} type="button" onClick={() => { setQuery(text); setAnswer(answerQuestion(text, transactions, cash)); }}>{text}</button>)}
            </div>
            <form className="aiComposer" onSubmit={askAi}><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ask about your business finances…" /><button type="submit" aria-label="Ask AI">➤</button></form>
            <small className="aiSafety">Analysis only. Galactic AI cannot move, withdraw, or invest your money.</small>
          </aside>
        </div>

        <div className="bizGrid lowerGrid">
          <section className="bizPanel" id="reports">
            <div className="panelHead"><div><p className="eyebrow">EXPENSE MIX</p><h2>Where the money goes</h2></div><span>{money(stats.expenses)} total</span></div>
            <div className="categoryBars">
              {categories.map(([name, value]) => {
                const pct = stats.expenses ? Math.round((value / stats.expenses) * 100) : 0;
                return <div className="categoryBar" key={name}><div><span>{name}</span><b>{money(value)} · {pct}%</b></div><div className="barTrack"><i style={{ width: `${pct}%` }} /></div></div>;
              })}
            </div>
          </section>

          <section className="bizPanel insightPanel">
            <div className="panelHead"><div><p className="eyebrow">AI WATCHLIST</p><h2>What needs attention</h2></div><span>Updated now</span></div>
            <div className="insightList">
              {insights.map((insight) => <article key={insight.title} className={insight.tone}><span>{insight.tone === 'good' ? '✓' : insight.tone === 'warn' ? '!' : '✦'}</span><div><b>{insight.title}</b><p>{insight.body}</p></div></article>)}
            </div>
          </section>
        </div>

        <footer className="bizFoot">Transactions and cash are stored locally on this device until a production database/account connector is added. AI classifications and forecasts are decision-support tools, not accounting, tax, legal, credit, or investment advice.</footer>
      </section>
    </main>
  );
}
