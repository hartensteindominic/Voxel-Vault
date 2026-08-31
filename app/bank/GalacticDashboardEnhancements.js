'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

const commands = [
  { id: 'dashboard', icon: '⌂', label: 'Dashboard', hint: 'Back to the top' },
  { id: 'accounts', icon: '▣', label: 'Accounts', hint: 'Checking and savings' },
  { id: 'deposit', icon: '＋', label: 'Deposit', hint: 'Open Add Money' },
  { id: 'send', icon: '↗', label: 'Send money', hint: 'Open Transfer' },
  { id: 'swap', icon: '⇄', label: 'Swap', hint: 'Jump to demo crypto' },
  { id: 'cards', icon: '▤', label: 'Cards', hint: 'View Galactic cards' },
  { id: 'activity', icon: '≡', label: 'Transaction history', hint: 'Recent activity' },
  { id: 'security', icon: '✓', label: 'Security & privacy', hint: 'Protection details' },
  { id: 'account-status', icon: '◉', label: 'My account status', hint: 'See what your signed-in account can do right now' },
  { id: 'integration-health', icon: '↻', label: 'Integration health', hint: 'Owner-only provider, webhook and reconciliation status' },
  { id: 'launch-status', icon: '🔒', label: 'Regulated launch status', hint: 'See what is required before live banking' },
  { id: 'rewards', icon: '✿', label: 'Rewards', hint: 'Galactic Stars' },
  { id: 'tour', icon: '✦', label: 'Explore the Stars', hint: 'Restart onboarding tour' },
];

const trends = {
  '1W': { change: '+2.1%', path: 'M2 42 C24 37 34 44 52 35 S84 39 102 28 S132 32 150 18 S180 23 218 8' },
  '1M': { change: '+12.4%', path: 'M2 43 C18 35 28 46 46 37 S70 40 88 28 S112 34 132 22 S158 29 178 14 S202 17 218 5' },
  '3M': { change: '+18.8%', path: 'M2 44 C22 43 30 35 50 37 S76 31 95 34 S120 23 141 25 S164 17 184 19 S203 8 218 4' },
};

const tourSteps = [
  { selector: '.gt-balance-hero', title: 'Your financial galaxy', body: 'Your total demo balance, trend and recent movement live here.' },
  { selector: '.gt-priority-actions', title: 'Three fast moves', body: 'Deposit, send and swap are always one tap away.' },
  { selector: '#activity', title: 'Clear transaction history', body: 'Recent activity keeps the amount, merchant and timing easy to scan.' },
  { selector: '#security', title: 'Trust is visible', body: 'Security, nonbank disclosures and launch status stay easy to find before any live-money launch.' },
];

const activityFilters = ['All', 'Transfers', 'Cards', 'Crypto'];

function scrollTo(selector) {
  document.querySelector(selector)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function clickQuick(label) {
  const buttons = Array.from(document.querySelectorAll('.gt-quick-actions button'));
  const match = buttons.find((button) => button.textContent?.toLowerCase().includes(label.toLowerCase()));
  match?.click();
}

function activityKind(row) {
  const category = row.querySelector('.gt-activity-meta small')?.textContent?.toLowerCase() || '';
  const name = row.querySelector('.gt-activity-meta b')?.textContent?.toLowerCase() || '';
  const text = `${category} ${name}`;
  if (/crypto|bitcoin|ethereum|btc|eth|usdc/.test(text)) return 'Crypto';
  if (/transfer|ach|funding|deposit|income/.test(text)) return 'Transfers';
  return 'Cards';
}

function ActivityFilter({ activityRoot }) {
  const [filter, setFilter] = useState('All');
  const [empty, setEmpty] = useState(false);

  useEffect(() => {
    const list = activityRoot?.querySelector('.gt-activity-list');
    if (!list) return undefined;

    const apply = () => {
      const rows = Array.from(list.querySelectorAll('.gt-activity-row'));
      let visibleCount = 0;
      rows.forEach((row) => {
        const noActivityRow = /no .*transactions yet/i.test(row.textContent || '');
        const visible = filter === 'All' || (!noActivityRow && activityKind(row) === filter);
        row.hidden = !visible;
        if (visible) visibleCount += 1;
      });
      setEmpty(filter !== 'All' && visibleCount === 0);
    };

    apply();
    const observer = new MutationObserver(apply);
    observer.observe(list, { childList: true, subtree: true, characterData: true });
    return () => {
      observer.disconnect();
      list.querySelectorAll('.gt-activity-row').forEach((row) => { row.hidden = false; });
    };
  }, [activityRoot, filter]);

  return (
    <div className="gt-activity-filter-wrap">
      <div className="gt-activity-filter" aria-label="Filter recent activity">
        {activityFilters.map((item) => (
          <button key={item} type="button" className={filter === item ? 'active' : ''} aria-pressed={filter === item} onClick={() => setFilter(item)}>{item}</button>
        ))}
      </div>
      {empty && <p className="gt-activity-filter-empty" role="status">No {filter.toLowerCase()} activity in this demo view yet.</p>}
    </div>
  );
}

function BalanceTrend() {
  const [range, setRange] = useState('1M');
  const trend = trends[range];
  return (
    <div className="gt-balance-interactive" aria-label="Illustrative demo balance trend">
      <div className="gt-balance-trend-head"><span>Illustrative demo trend</span><b>{trend.change}</b></div>
      <svg viewBox="0 0 220 50" role="img" aria-label={`${range} illustrative demo balance trend`}><path d={trend.path} /></svg>
      <div className="gt-balance-ranges">
        {Object.keys(trends).map((item) => <button key={item} type="button" className={item === range ? 'active' : ''} onClick={(event) => { event.stopPropagation(); setRange(item); }}>{item}</button>)}
      </div>
    </div>
  );
}

function PriorityActions({ run }) {
  return (
    <div className="gt-priority-actions" aria-label="Quick actions">
      <button type="button" onClick={() => run('deposit')}><span>＋</span><b>Deposit</b><small>Add demo money</small></button>
      <button type="button" onClick={() => run('send')}><span>↗</span><b>Send</b><small>Transfer demo money</small></button>
      <button type="button" onClick={() => run('swap')}><span>⇄</span><b>Swap</b><small>Demo crypto</small></button>
    </div>
  );
}

function TrustStrip() {
  return (
    <section className="gt-trust-strip" aria-label="Galactic Trust account and regulated launch status">
      <div className="gt-trust-badges"><span>🔒 Protected session</span><span>▣ Masked card data</span><span>◈ Live banking locked</span></div>
      <p><b>Galactic Trust is a financial technology product, not a bank.</b> No real customer deposits are accepted or held in this build. Banking services can become live only through an approved sponsor-bank program with bank-approved disclosures and controls. <a href="/bank/status">View your account status →</a> <a href="/bank/readiness">View regulated launch status →</a></p>
    </section>
  );
}

export default function GalacticDashboardEnhancements({ onSignOut, accountLabel = 'Galactic member' }) {
  const [targets, setTargets] = useState({ hero: null, controls: null, nav: null, activity: null });
  const [activityFilterTarget, setActivityFilterTarget] = useState(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [tourOpen, setTourOpen] = useState(false);
  const [tourIndex, setTourIndex] = useState(0);

  useEffect(() => {
    let frame;
    const findTargets = () => {
      const next = {
        hero: document.querySelector('.gt-balance-hero'),
        controls: document.querySelector('.gt-banking-controls'),
        nav: document.querySelector('.gt-nav'),
        activity: document.querySelector('#activity'),
      };
      if (next.hero && next.controls && next.nav) setTargets(next);
      else frame = requestAnimationFrame(findTargets);
    };
    findTargets();
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const activity = targets.activity;
    if (!activity) return undefined;
    let slot = activity.querySelector('.gt-activity-filter-slot');
    let created = false;
    if (!slot) {
      slot = document.createElement('div');
      slot.className = 'gt-activity-filter-slot';
      const list = activity.querySelector('.gt-activity-list');
      if (list) list.before(slot);
      else activity.appendChild(slot);
      created = true;
    }
    setActivityFilterTarget(slot);
    return () => {
      setActivityFilterTarget(null);
      if (created) slot.remove();
    };
  }, [targets.activity]);

  useEffect(() => {
    const keydown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((value) => !value);
      }
      if (event.key === 'Escape') {
        setPaletteOpen(false);
        setTourOpen(false);
        const sheetClose = document.querySelector('.gt-action-sheet .gt-sheet-header > button');
        if (sheetClose) {
          event.preventDefault();
          sheetClose.click();
        }
      }
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, []);

  useEffect(() => {
    const input = document.querySelector('.gt-search input');
    if (!input) return undefined;
    const open = (event) => { event.preventDefault(); input.blur(); setPaletteOpen(true); };
    input.addEventListener('focus', open);
    return () => input.removeEventListener('focus', open);
  }, [targets.hero]);

  useEffect(() => {
    if (!onSignOut) return undefined;
    const buttons = Array.from(document.querySelectorAll('.gt-side-utilities button'));
    const logout = buttons.find((button) => button.textContent?.toLowerCase().includes('log out'));
    if (!logout) return undefined;
    const handler = (event) => {
      event.preventDefault();
      event.stopPropagation();
      onSignOut();
    };
    logout.addEventListener('click', handler, true);
    return () => logout.removeEventListener('click', handler, true);
  }, [onSignOut, targets.nav]);

  useEffect(() => {
    const viewport = window.visualViewport;
    const sync = () => {
      const height = viewport?.height || window.innerHeight;
      document.documentElement.style.setProperty('--gt-visual-height', `${height}px`);
      document.documentElement.style.setProperty('--gt-keyboard-inset', `${Math.max(0, window.innerHeight - height)}px`);
    };
    sync();
    viewport?.addEventListener('resize', sync);
    viewport?.addEventListener('scroll', sync);
    window.addEventListener('resize', sync);
    return () => {
      viewport?.removeEventListener('resize', sync);
      viewport?.removeEventListener('scroll', sync);
      window.removeEventListener('resize', sync);
    };
  }, []);

  useEffect(() => {
    try {
      if (window.localStorage.getItem('galactic-trust:onboarding:seen:v1') !== 'yes') {
        const timer = window.setTimeout(() => setTourOpen(true), 900);
        return () => window.clearTimeout(timer);
      }
    } catch {}
    return undefined;
  }, []);

  useEffect(() => {
    document.querySelectorAll('.gt-tour-focus').forEach((node) => node.classList.remove('gt-tour-focus'));
    if (!tourOpen) return undefined;
    const step = tourSteps[tourIndex];
    const node = document.querySelector(step.selector);
    node?.classList.add('gt-tour-focus');
    node?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return () => node?.classList.remove('gt-tour-focus');
  }, [tourOpen, tourIndex]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? commands.filter((item) => `${item.label} ${item.hint}`.toLowerCase().includes(q)) : commands;
  }, [query]);

  function closeTour() {
    setTourOpen(false);
    try { window.localStorage.setItem('galactic-trust:onboarding:seen:v1', 'yes'); } catch {}
  }

  function run(id) {
    setPaletteOpen(false);
    setQuery('');
    if (id === 'dashboard') window.scrollTo({ top: 0, behavior: 'smooth' });
    else if (id === 'accounts') scrollTo('#accounts');
    else if (id === 'deposit') clickQuick('Add Money');
    else if (id === 'send') clickQuick('Transfer');
    else if (id === 'swap') scrollTo('#crypto');
    else if (id === 'cards') scrollTo('#cards');
    else if (id === 'activity') scrollTo('#activity');
    else if (id === 'security') scrollTo('#security');
    else if (id === 'account-status') window.location.assign('/bank/status');
    else if (id === 'integration-health') window.location.assign('/bank/integrations');
    else if (id === 'launch-status') window.location.assign('/bank/readiness');
    else if (id === 'rewards') scrollTo('#rewards');
    else if (id === 'tour') { setTourIndex(0); setTourOpen(true); }
  }

  return (
    <>
      {targets.hero && createPortal(<BalanceTrend />, targets.hero)}
      {targets.controls && createPortal(<><PriorityActions run={run} /><TrustStrip /></>, targets.controls)}
      {targets.nav && createPortal(<button className="gt-command-launch" type="button" onClick={() => setPaletteOpen(true)}><span>⌕</span><b>Quick jump</b><kbd>⌘K</kbd></button>, targets.nav)}
      {activityFilterTarget && targets.activity && createPortal(<ActivityFilter activityRoot={targets.activity} />, activityFilterTarget)}
      {targets.activity && createPortal(<div className="gt-history-trust"><span>✓</span><p><b>Clear history</b><small>Demo transactions stay readable and separated from any future bank-authoritative ledger.</small></p></div>, targets.activity)}

      {paletteOpen && (
        <div className="gt-command-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPaletteOpen(false); }}>
          <section className="gt-command-palette" role="dialog" aria-modal="true" aria-label="Galactic Trust command palette">
            <div className="gt-command-search"><span>⌕</span><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Jump anywhere in your galaxy…" /><kbd>ESC</kbd></div>
            <div className="gt-command-list">
              {filtered.map((item) => <button key={item.id} type="button" onClick={() => run(item.id)}><span>{item.icon}</span><p><b>{item.label}</b><small>{item.hint}</small></p><i>↵</i></button>)}
              {!filtered.length && <div className="gt-command-empty">No matching destination.</div>}
            </div>
            <footer><span>⌘K opens this anywhere</span><span>{accountLabel} · Production gated</span></footer>
          </section>
        </div>
      )}

      {tourOpen && (
        <section className="gt-tour-card" role="dialog" aria-label="Explore the Stars onboarding tour">
          <div className="gt-tour-progress">{tourSteps.map((_, index) => <i key={index} className={index <= tourIndex ? 'active' : ''} />)}</div>
          <span className="gt-tour-kicker">✦ EXPLORE THE STARS · {tourIndex + 1}/{tourSteps.length}</span>
          <h3>{tourSteps[tourIndex].title}</h3>
          <p>{tourSteps[tourIndex].body}</p>
          <div className="gt-tour-actions"><button type="button" className="secondary" onClick={closeTour}>Skip</button><button type="button" className="primary" onClick={() => { if (tourIndex >= tourSteps.length - 1) closeTour(); else setTourIndex((value) => value + 1); }}>{tourIndex >= tourSteps.length - 1 ? 'Finish tour' : 'Next star →'}</button></div>
        </section>
      )}
    </>
  );
}
