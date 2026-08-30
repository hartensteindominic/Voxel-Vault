'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './crypto-practice.module.css';

const STARTING_CASH = 5000;
const STARTING_ASSETS = [
  { symbol: 'BTC', name: 'Bitcoin', price: 68000, holding: 0.0142 },
  { symbol: 'ETH', name: 'Ethereum', price: 3600, holding: 0.63 },
  { symbol: 'USDC', name: 'USD Coin', price: 1, holding: 425.5 },
];

function money(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function units(value, symbol) {
  return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: symbol === 'BTC' ? 8 : 6 });
}

function freshAssets() {
  return STARTING_ASSETS.map((asset) => ({ ...asset }));
}

export default function GalacticCryptoPractice() {
  const [target, setTarget] = useState(null);
  const [assets, setAssets] = useState(freshAssets);
  const [practiceCash, setPracticeCash] = useState(STARTING_CASH);
  const [symbol, setSymbol] = useState('BTC');
  const [side, setSide] = useState('buy');
  const [amount, setAmount] = useState('100');
  const [trades, setTrades] = useState([]);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let frame;
    const findPanel = () => {
      const panel = document.querySelector('.gt-crypto-panel');
      if (panel) {
        panel.classList.add('gt-crypto-enhanced');
        setTarget(panel);
      } else {
        frame = requestAnimationFrame(findPanel);
      }
    };
    findPanel();
    return () => {
      cancelAnimationFrame(frame);
      document.querySelector('.gt-crypto-panel')?.classList.remove('gt-crypto-enhanced');
    };
  }, []);

  const active = assets.find((asset) => asset.symbol === symbol) || assets[0];
  const usd = Number(amount);
  const estimatedUnits = Number.isFinite(usd) && usd > 0 ? usd / active.price : 0;
  const holdingsValue = useMemo(() => assets.reduce((sum, asset) => sum + (asset.holding * asset.price), 0), [assets]);
  const practiceTotal = practiceCash + holdingsValue;

  function submitTrade(event) {
    event.preventDefault();
    setNotice('');
    if (!Number.isFinite(usd) || usd < 1 || usd > 5000) {
      setNotice('Enter a practice trade amount between $1 and $5,000.');
      return;
    }
    if (side === 'buy' && usd > practiceCash) {
      setNotice(`Practice cash is too low. Available: ${money(practiceCash)}.`);
      return;
    }
    if (side === 'sell' && estimatedUnits > active.holding) {
      setNotice(`Your practice ${active.symbol} holding is too low for that sell.`);
      return;
    }

    setAssets((current) => current.map((asset) => (
      asset.symbol === active.symbol
        ? { ...asset, holding: Math.max(0, asset.holding + (side === 'buy' ? estimatedUnits : -estimatedUnits)) }
        : asset
    )));
    setPracticeCash((current) => side === 'buy' ? current - usd : current + usd);
    setTrades((current) => [{
      id: `${Date.now()}-${active.symbol}-${side}`,
      side,
      symbol: active.symbol,
      usd,
      units: estimatedUnits,
    }, ...current].slice(0, 5));
    setNotice(`Practice ${side} recorded. No real ${active.symbol} or money moved.`);
  }

  function resetPractice() {
    setAssets(freshAssets());
    setPracticeCash(STARTING_CASH);
    setTrades([]);
    setAmount('100');
    setSide('buy');
    setSymbol('BTC');
    setNotice('Practice portfolio reset. No bank or provider data changed.');
  }

  if (!target) return null;

  return createPortal(
    <section className={styles.practice} aria-label="Galactic Trust demo crypto practice portfolio">
      <div className={styles.boundary}>
        <span>◎</span>
        <p><b>Isolated practice portfolio</b><small>This demo cash and crypto never touch your Galactic Trust bank balance or any Increase sandbox balance.</small></p>
      </div>

      <div className={styles.summary}>
        <div><span>Practice cash</span><b>{money(practiceCash)}</b></div>
        <div><span>Demo crypto</span><b>{money(holdingsValue)}</b></div>
        <div><span>Practice total</span><b>{money(practiceTotal)}</b></div>
      </div>

      <div className={styles.assets} aria-label="Choose demo crypto asset">
        {assets.map((asset) => (
          <button key={asset.symbol} type="button" className={asset.symbol === symbol ? styles.activeAsset : ''} onClick={() => setSymbol(asset.symbol)}>
            <span className={styles.coin}>{asset.symbol === 'BTC' ? '₿' : asset.symbol === 'ETH' ? '◆' : '$'}</span>
            <span><b>{asset.symbol}</b><small>{asset.name}</small></span>
            <strong>{money(asset.price)}</strong>
          </button>
        ))}
      </div>
      <p className={styles.quoteNote}>Illustrative reference prices only · not live market quotes.</p>

      <div className={styles.holding}>
        <span><small>Your practice {active.name}</small><b>{units(active.holding, active.symbol)} {active.symbol}</b></span>
        <strong>{money(active.holding * active.price)}</strong>
      </div>

      <form className={styles.trade} onSubmit={submitTrade}>
        <div className={styles.toggle}>
          <button type="button" className={side === 'buy' ? styles.activeToggle : ''} onClick={() => setSide('buy')}>Practice Buy</button>
          <button type="button" className={side === 'sell' ? styles.activeToggle : ''} onClick={() => setSide('sell')}>Practice Sell</button>
        </div>
        <label>
          <span>Practice amount in USD</span>
          <div className={styles.amount}><span>$</span><input type="number" min="1" max="5000" step="1" value={amount} onChange={(event) => setAmount(event.target.value)} /></div>
        </label>
        <div className={styles.estimate}><span>Estimated {active.symbol}</span><b>{units(estimatedUnits, active.symbol)}</b></div>
        <button className={styles.submit} type="submit">Simulate {side === 'buy' ? 'Buy' : 'Sell'} {active.symbol}</button>
      </form>

      {notice && <p className={styles.notice} role="status">{notice}</p>}

      <div className={styles.ledgerHead}><div><span>PRACTICE LEDGER</span><b>{trades.length ? 'Recent simulated trades' : 'No trades yet'}</b></div><button type="button" onClick={resetPractice}>Reset</button></div>
      {trades.length ? (
        <div className={styles.ledger}>
          {trades.map((trade) => (
            <div key={trade.id}><span className={trade.side === 'buy' ? styles.buy : styles.sell}>{trade.side.toUpperCase()}</span><p><b>{trade.symbol}</b><small>{units(trade.units, trade.symbol)} units</small></p><strong>{money(trade.usd)}</strong></div>
          ))}
        </div>
      ) : <p className={styles.empty}>Your simulated buys and sells will appear here. This ledger is local practice state only.</p>}

      <p className={styles.disclosure}><b>Demo only.</b> No real crypto is purchased, sold, custodied, or transferred. No banking API or crypto provider is called by this practice panel. Crypto can lose value and the illustrative prices above are not investment information.</p>
    </section>,
    target
  );
}
