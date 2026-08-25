'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { getSupabaseBrowserAsync } from '../../../lib/supabase-browser';
import { connectVoxelFlipWallet } from '../../../lib/voxelflip';
import styles from './neural-core.module.css';

function short(value) {
  return value ? `${value.slice(0, 6)}…${value.slice(-4)}` : '—';
}

function number(value, digits = 4) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: digits }) : '—';
}

function eth(value) {
  return value == null ? '—' : `${number(value, 6)} ETH`;
}

function dollars(value) {
  const n = Number(value);
  return Number.isFinite(n) ? `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '—';
}

function time(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : '—';
}

function statusClass(ok) {
  return ok ? styles.good : styles.wait;
}

export default function NeuralCorePage() {
  const [token, setToken] = useState('');
  const [authState, setAuthState] = useState('loading');
  const [wallet, setWallet] = useState('');
  const [core, setCore] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [setupRequired, setSetupRequired] = useState(false);

  const loadCore = useCallback(async (accessToken, selectedWallet = '') => {
    if (!accessToken) return;
    setBusy(true);
    setError('');
    try {
      const query = selectedWallet ? `?wallet=${encodeURIComponent(selectedWallet)}` : '';
      const response = await fetch(`/api/admin/neural-core${query}`, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setSetupRequired(Boolean(data.setupRequired));
        throw new Error(data.error || 'Neural Core could not be loaded.');
      }
      setSetupRequired(false);
      setCore(data);
      if (data.wallet) setWallet(data.wallet);
      setAuthState('authorized');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Neural Core could not be loaded.');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let subscription;
    (async () => {
      try {
        const client = await getSupabaseBrowserAsync();
        const { data } = await client.auth.getSession();
        const accessToken = data?.session?.access_token || '';
        if (cancelled) return;
        if (!accessToken) {
          setAuthState('signed-out');
          return;
        }
        setToken(accessToken);
        await loadCore(accessToken);
        const result = client.auth.onAuthStateChange((_event, session) => {
          const next = session?.access_token || '';
          setToken(next);
          if (!next) {
            setAuthState('signed-out');
            setCore(null);
          }
        });
        subscription = result?.data?.subscription;
      } catch (err) {
        if (!cancelled) {
          setAuthState('signed-out');
          setError(err instanceof Error ? err.message : 'Google account state could not be loaded.');
        }
      }
    })();
    return () => {
      cancelled = true;
      subscription?.unsubscribe?.();
    };
  }, [loadCore]);

  useEffect(() => {
    if (!token || authState !== 'authorized' || !wallet) return;
    const timer = setInterval(() => loadCore(token, wallet), 30_000);
    return () => clearInterval(timer);
  }, [token, authState, wallet, loadCore]);

  async function connectWallet() {
    setBusy(true);
    setError('');
    try {
      const result = await connectVoxelFlipWallet();
      const selected = result.address;
      const response = await fetch('/api/admin/neural-core', {
        method: 'POST',
        headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'set-wallet', wallet: selected }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Neural Core wallet could not be saved.');
      setWallet(selected);
      setCore(data);
    } catch (err) {
      if (err?.code === 'NO_WALLET_PROVIDER' && err?.deepLink) {
        location.href = err.deepLink;
        return;
      }
      setError(err instanceof Error ? err.message : 'Wallet connection failed.');
    } finally {
      setBusy(false);
    }
  }

  async function exportMemory() {
    if (!token || !wallet) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/neural-core?wallet=${encodeURIComponent(wallet)}&export=1`, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Memory export failed.');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `voxelflip-neural-memory-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Memory export failed.');
    } finally {
      setBusy(false);
    }
  }

  const market = core?.market || {};
  const recommendation = core?.recommendation || {};
  const learning = core?.learning || [];
  const inventory = core?.inventory?.items || [];
  const sources = core?.sources || {};
  const priceBand = useMemo(() => Array.isArray(recommendation.suggestedPriceBandEth) ? recommendation.suggestedPriceBandEth : null, [recommendation.suggestedPriceBandEth]);

  if (authState === 'loading') {
    return <main className={styles.page}><div className={styles.center}><div className={styles.pulse}>✦</div><p>Loading Neural Core…</p></div></main>;
  }

  if (authState === 'signed-out') {
    return <main className={styles.page}>
      <nav className={styles.nav}><Link href="/studio">VoxelPop</Link><em>NEURAL CORE · PRIVATE</em></nav>
      <section className={styles.locked}>
        <div className={styles.pulse}>✦</div>
        <small>PRIVATE BACKEND</small>
        <h1>Google sign-in<br/><em>required.</em></h1>
        <p>Neural Core uses the same VoxelPop Google account session, then verifies that account again on the server against a private admin allowlist.</p>
        <Link className={styles.primaryLink} href="/studio#my-voxels">Open Studio and sign in with Google →</Link>
        <span>After Google shows connected in Studio, return to /admin/neural-core.</span>
        {error && <div className={styles.notice}>{error}</div>}
      </section>
    </main>;
  }

  return <main className={styles.page}>
    <nav className={styles.nav}>
      <Link href="/studio"><img src="/voxelpop/voxelpop-logo.png" alt="VoxelPop"/><b>VoxelPop</b></Link>
      <em>VOXEL VAULT · NEURAL CORE</em>
      <span>PRIVATE</span>
    </nav>

    <header className={styles.hero}>
      <p>OBSERVE → REMEMBER → COMPARE → RECOMMEND → HUMAN APPROVAL</p>
      <h1>The backend<br/><em>brain.</em></h1>
      <span>Market memory for VoxelFlip. It learns only from observed data, never invents a pattern, and never signs, buys, lists, transfers or mints by itself.</span>
      <div className={styles.heroActions}>
        <button onClick={() => loadCore(token, wallet)} disabled={busy}>{busy ? 'Refreshing…' : 'Force refresh data'}</button>
        <button onClick={connectWallet} disabled={busy}>{wallet ? `Wallet ${short(wallet)}` : 'Connect Base wallet'}</button>
        <button onClick={exportMemory} disabled={busy || !core?.memory?.available || !wallet}>Export memory</button>
      </div>
      {error && <div className={styles.notice}>{error}</div>}
      {setupRequired && <div className={styles.setup}>Admin access is fail-closed. Configure <code>NEURAL_CORE_ADMIN_EMAILS</code> or <code>NEURAL_CORE_ADMIN_USER_IDS</code> in Vercel, then refresh. Do not put service-role keys in this page.</div>}
    </header>

    <div className={styles.shell}>
      <section className={styles.panel}>
        <div className={styles.panelHead}><div><small>MARKET PULSE</small><h2>What the market is actually doing</h2></div><span>{core?.checkedAt ? `Updated ${time(core.checkedAt)}` : 'Waiting'}</span></div>
        <div className={styles.metrics}>
          <article><small>ETH / USD</small><b>{dollars(market.ethUsd)}</b><span>{market.ethChange24hPercent == null ? '24h unavailable' : `${market.ethChange24hPercent >= 0 ? '+' : ''}${number(market.ethChange24hPercent, 2)}% · 24h`}</span></article>
          <article><small>BASE GAS</small><b>{market.baseGasGwei == null ? '—' : `${number(market.baseGasGwei, 4)} gwei`}</b><span>live RPC estimate</span></article>
          <article><small>VOXELFLIP FLOOR</small><b>{eth(market.floorPriceEth)}</b><span>asking floor, not realized value</span></article>
          <article><small>TOP OFFER</small><b>{eth(market.topOfferEth)}</b><span>observed collection offers</span></article>
          <article><small>24H SALES</small><b>{number(market.sales24h, 0)}</b><span>independent market events</span></article>
          <article><small>24H VOLUME</small><b>{eth(market.volume24hEth)}</b><span>observed / reported</span></article>
        </div>
        <div className={styles.sourceRow}>
          <span className={statusClass(sources.openSea?.healthy)}>OpenSea {sources.openSea?.healthy ? 'LIVE' : 'WAIT'}</span>
          <span className={statusClass(sources.coingecko?.available)}>ETH price {sources.coingecko?.available ? 'LIVE' : 'WAIT'}</span>
          <span className={statusClass(sources.baseRpc?.available)}>Base RPC {sources.baseRpc?.available ? 'LIVE' : 'WAIT'}</span>
          <span className={statusClass(core?.memory?.available)}>Memory {core?.memory?.available ? 'LIVE' : 'WAIT'}</span>
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHead}><div><small>DECISION ENGINE</small><h2>{recommendation.action || 'Waiting for evidence'}</h2></div><span className={styles.confidence}>{String(recommendation.confidence || 'none').toUpperCase()} CONFIDENCE</span></div>
        <div className={styles.recommendation}>
          {priceBand
            ? <strong>Observed pricing band: {number(priceBand[0], 6)}–{number(priceBand[1], 6)} ETH</strong>
            : <strong>No defensible price band yet.</strong>}
          <p>{recommendation.reason || 'Connect the wallet and live market sources to begin.'}</p>
          <div className={styles.evidence}>
            <span>Independent priced sales: {recommendation.evidence?.independentPricedSales ?? '—'}</span>
            <span>Median sale: {eth(recommendation.evidence?.medianSaleEth)}</span>
            <span>Realized profit: {eth(recommendation.evidence?.realizedProfitEth)}</span>
          </div>
        </div>
        <p className={styles.disclaimer}>{core?.valuePolicy?.principle || 'NFT value cannot be guaranteed.'}</p>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHead}><div><small>YOUR INVENTORY</small><h2>Owned VoxelFlip assets</h2></div><span>{inventory.length} observed</span></div>
        {!wallet && <div className={styles.empty}>Connect the Base wallet that owns your VoxelFlip NFTs.</div>}
        {wallet && !inventory.length && <div className={styles.empty}>No VoxelFlip inventory was returned by the current OpenSea account feed yet. Indexing can lag after a mint.</div>}
        <div className={styles.inventory}>
          {inventory.map(item => <article key={item.tokenId || item.name}>
            <div className={styles.thumb}>{item.imageUrl ? <img src={item.imageUrl} alt=""/> : <span>◈</span>}</div>
            <div><small>VOXELFLIP #{item.tokenId}</small><h3>{item.name}</h3><p>{item.listed ? `Listed at ${eth(item.listingPriceEth)}` : 'Not currently detected as listed'}</p></div>
            {item.openSeaUrl && <a href={item.openSeaUrl} target="_blank" rel="noreferrer">OpenSea ↗</a>}
          </article>)}
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHead}><div><small>LEARNING LOG</small><h2>Patterns only when the sample earns them</h2></div><span>{learning.length} current</span></div>
        <div className={styles.learning}>
          {learning.map((pattern, index) => <article key={`${pattern.type}-${index}`}>
            <div><small>{pattern.type}</small><b>{pattern.value == null ? 'Not enough data' : `${number(pattern.value, 6)}${pattern.unit === 'percent' ? '%' : pattern.unit === 'ETH' ? ' ETH' : pattern.unit ? ` ${pattern.unit}` : ''}`}</b></div>
            <p>{pattern.note}</p>
            <span>{String(pattern.confidence || 'low').toUpperCase()} · n={pattern.sampleSize ?? 0}</span>
          </article>)}
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHead}><div><small>MEMORY</small><h2>Persistent observations</h2></div><span>{core?.memory?.entries ?? 0} loaded</span></div>
        <div className={styles.metrics}>
          <article><small>MARKET SNAPSHOTS</small><b>{core?.memory?.snapshots ?? 0}</b><span>stored no more than every 30m</span></article>
          <article><small>RECOMMENDATIONS</small><b>{core?.memory?.recommendations ?? 0}</b><span>stored no more than every 6h</span></article>
          <article><small>REALIZED PROFIT</small><b>{eth(core?.ledger?.realizedProfitEth)}</b><span>{core?.ledger?.costCoverageComplete ? 'cost coverage complete' : 'reinvestment blocked until costs complete'}</span></article>
        </div>
        {core?.memory?.error && <div className={styles.notice}>{core.memory.error}</div>}
        <div className={styles.log}>
          {(core?.memory?.latest || []).slice(0, 10).map(item => <div key={item.id}><b>{item.kind}</b><span>{time(item.observed_at)}</span><em>{item.confidence || 'recorded'}</em></div>)}
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHead}><div><small>AUTOPILOT SAFETY</small><h2>The brain can think. The wallet still decides.</h2></div><span className={styles.lockBadge}>EXECUTION LOCKED</span></div>
        <div className={styles.locks}>
          <article><b>OBSERVE</b><span>ON</span><p>Market feeds and wallet inventory.</p></article>
          <article><b>REMEMBER</b><span>{core?.memory?.available ? 'ON' : 'WAIT'}</span><p>Snapshots, recommendations and cost context.</p></article>
          <article><b>AUTO-LIST</b><span>OFF</span><p>No marketplace order is signed automatically.</p></article>
          <article><b>AUTO-BUY</b><span>OFF</span><p>No ETH or WETH can be spent automatically.</p></article>
          <article><b>AUTO-MINT</b><span>OFF</span><p>No on-chain mint is signed automatically.</p></article>
        </div>
        <div className={styles.actions}>
          <Link href="/voxelflip/factory">Factory loop →</Link>
          <Link href="/voxelflip/autopilot">Autopilot monitor →</Link>
          <Link href="/studio#my-voxels">My Voxels →</Link>
        </div>
      </section>
    </div>

    <footer className={styles.footer}><span>VOXEL VAULT NEURAL CORE · PRIVATE BACKEND</span><span>Automatic signing remains OFF.</span></footer>
  </main>;
}
