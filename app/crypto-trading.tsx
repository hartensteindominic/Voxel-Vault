'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

type SymbolCode = 'BTC' | 'ETH' | 'USDC';
type Side = 'buy' | 'sell';

type Asset = {
  symbol: SymbolCode;
  name: string;
  demoPriceUsd: number;
  demoHolding: number;
  demoValueUsd: number;
};

type CryptoStatus = {
  ok: boolean;
  mode: 'demo' | 'partner';
  providerName: string | null;
  liveTradingEnabled: boolean;
  disclosure: string;
  assets: Asset[];
};

const fallbackAssets: Asset[] = [
  { symbol: 'BTC', name: 'Bitcoin', demoPriceUsd: 68240.18, demoHolding: 0.0142, demoValueUsd: 968.01 },
  { symbol: 'ETH', name: 'Ethereum', demoPriceUsd: 3648.72, demoHolding: 0.63, demoValueUsd: 2298.69 },
  { symbol: 'USDC', name: 'USD Coin', demoPriceUsd: 1, demoHolding: 425.5, demoValueUsd: 425.5 }
];

function money(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value);
}

function idempotencyKey() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `crypto_${crypto.randomUUID()}`;
  return `crypto_${Date.now()}_${Math.random().toString(36).slice(2, 14)}`;
}

export function CryptoTrading() {
  const [status, setStatus] = useState<CryptoStatus>({
    ok: true,
    mode: 'demo',
    providerName: null,
    liveTradingEnabled: false,
    disclosure: 'Crypto trading is in demo mode. No real assets are purchased or sold.',
    assets: fallbackAssets
  });
  const [symbol, setSymbol] = useState<SymbolCode>('BTC');
  const [side, setSide] = useState<Side>('buy');
  const [amount, setAmount] = useState('25');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/crypto/status', { cache: 'no-store' })
      .then((response) => response.json())
      .then((data) => {
        if (data?.ok) setStatus({ ...data, assets: data.assets?.length ? data.assets : fallbackAssets });
      })
      .catch(() => setMessage('Crypto status is temporarily unavailable.'));
  }, []);

  const asset = useMemo(
    () => status.assets.find((item) => item.symbol === symbol) || fallbackAssets[0],
    [status.assets, symbol]
  );

  const numericAmount = Number(amount);
  const estimatedUnits = Number.isFinite(numericAmount) && numericAmount > 0
    ? numericAmount / asset.demoPriceUsd
    : 0;

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');

    if (!Number.isFinite(numericAmount) || numericAmount < 1 || numericAmount > 10000) {
      setMessage('Enter an amount between $1 and $10,000.');
      return;
    }

    setBusy(true);
    try {
      const response = await fetch('/api/crypto/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey()
        },
        body: JSON.stringify({ symbol, side, usdAmount: numericAmount })
      });
      const data = await response.json();
      if (!response.ok || !data?.ok) throw new Error(data?.error?.message || 'Crypto order could not be created.');
      setMessage(data.order?.message || 'Crypto order submitted.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Crypto order could not be created.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="cryptoPanel" id="crypto" aria-labelledby="crypto-heading">
      <div className="sectionHeading cryptoHeading">
        <div>
          <h2 id="crypto-heading">Crypto</h2>
          <small>{status.mode === 'demo' ? 'Practice buy & sell' : status.providerName || 'Trading'}</small>
        </div>
        <span className={`modePill ${status.mode}`}>{status.mode === 'demo' ? 'DEMO' : 'LIVE'}</span>
      </div>

      <div className="cryptoAssetTabs" role="tablist" aria-label="Crypto assets">
        {status.assets.map((item) => (
          <button
            key={item.symbol}
            type="button"
            className={symbol === item.symbol ? 'active' : ''}
            onClick={() => setSymbol(item.symbol)}
            role="tab"
            aria-selected={symbol === item.symbol}
          >
            <span className={`coinIcon ${item.symbol.toLowerCase()}`}>{item.symbol === 'BTC' ? '₿' : item.symbol === 'ETH' ? '◆' : '$'}</span>
            <span><b>{item.symbol}</b><small>{money(item.demoPriceUsd)}</small></span>
          </button>
        ))}
      </div>

      <div className="cryptoHolding">
        <span><small>Your {asset.name}</small><strong>{asset.demoHolding.toLocaleString(undefined, { maximumFractionDigits: 8 })} {asset.symbol}</strong></span>
        <span className="cryptoValue">{money(asset.demoValueUsd)}</span>
      </div>

      <form className="cryptoTradeForm" onSubmit={submitOrder}>
        <div className="tradeToggle" aria-label="Buy or sell">
          <button type="button" className={side === 'buy' ? 'active' : ''} onClick={() => setSide('buy')}>Buy</button>
          <button type="button" className={side === 'sell' ? 'active' : ''} onClick={() => setSide('sell')}>Sell</button>
        </div>

        <label className="cryptoAmountLabel">
          Amount in USD
          <div className="cryptoAmountInput"><span>$</span><input type="number" min="1" max="10000" step="1" value={amount} onChange={(event) => setAmount(event.target.value)} /></div>
        </label>

        <div className="cryptoEstimate">
          <span>Estimated {asset.symbol}</span>
          <b>{estimatedUnits.toLocaleString(undefined, { maximumFractionDigits: asset.symbol === 'BTC' ? 8 : 6 })}</b>
        </div>

        <button className={`cryptoSubmit ${side}`} type="submit" disabled={busy}>
          {busy ? 'Working…' : `${status.mode === 'demo' ? 'Simulate' : 'Review'} ${side === 'buy' ? 'Buy' : 'Sell'} ${asset.symbol}`}
        </button>
      </form>

      <p className="cryptoDisclosure">{status.disclosure} Crypto can lose value. No guaranteed returns.</p>
      {message && <div className="cryptoMessage" role="status">{message}</div>}
    </section>
  );
}
