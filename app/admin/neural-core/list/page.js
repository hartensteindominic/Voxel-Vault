'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { getSupabaseBrowserAsync } from '../../../../lib/supabase-browser';
import { connectVoxelFlipWallet } from '../../../../lib/voxelflip';
import styles from './listing.module.css';

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const TOKEN_RE = /^\d+$/;

function short(value) {
  return value ? `${value.slice(0, 6)}…${value.slice(-4)}` : '—';
}

function number(value, digits = 6) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: digits }) : '—';
}

function suggestedPrice(core) {
  const band = core?.recommendation?.suggestedPriceBandEth;
  if (!Array.isArray(band) || band.length < 2) return '';
  const low = Number(band[0]);
  const high = Number(band[1]);
  if (!Number.isFinite(low) || !Number.isFinite(high) || low <= 0 || high <= 0) return '';
  return ((low + high) / 2).toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
}

export default function NeuralCoreListingAssistant() {
  const [authState, setAuthState] = useState('loading');
  const [token, setToken] = useState('');
  const [wallet, setWallet] = useState('');
  const [tokenId, setTokenId] = useState('');
  const [priceEth, setPriceEth] = useState('');
  const [durationDays, setDurationDays] = useState('30');
  const [useCreatorFee, setUseCreatorFee] = useState(true);
  const [core, setCore] = useState(null);
  const [prepared, setPrepared] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const initialWallet = query.get('wallet') || '';
    const initialToken = query.get('tokenId') || '';
    const initialPrice = query.get('price') || '';
    if (ADDRESS_RE.test(initialWallet)) setWallet(initialWallet);
    if (TOKEN_RE.test(initialToken)) setTokenId(initialToken);
    if (initialPrice) setPriceEth(initialPrice);
  }, []);

  const loadCore = useCallback(async (accessToken, selectedWallet) => {
    if (!accessToken || !ADDRESS_RE.test(selectedWallet || '')) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/neural-core?wallet=${encodeURIComponent(selectedWallet)}`, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Neural Core market data could not be loaded.');
      setCore(data);
      if (!tokenId && data?.inventory?.items?.[0]?.tokenId) setTokenId(String(data.inventory.items[0].tokenId));
      setPriceEth(current => current || suggestedPrice(data));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Neural Core market data could not be loaded.');
    } finally {
      setBusy(false);
    }
  }, [tokenId]);

  useEffect(() => {
    let cancelled = false;
    let subscription;
    (async () => {
      try {
        const client = await getSupabaseBrowserAsync();
        const { data } = await client.auth.getSession();
        if (cancelled) return;
        const accessToken = data?.session?.access_token || '';
        if (!accessToken) {
          setAuthState('signed-out');
          return;
        }
        setToken(accessToken);
        setAuthState('ready');
        const result = client.auth.onAuthStateChange((_event, session) => {
          const next = session?.access_token || '';
          setToken(next);
          setAuthState(next ? 'ready' : 'signed-out');
        });
        subscription = result?.data?.subscription;
      } catch (err) {
        if (!cancelled) {
          setAuthState('signed-out');
          setError(err instanceof Error ? err.message : 'Google session could not be loaded.');
        }
      }
    })();
    return () => {
      cancelled = true;
      subscription?.unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    if (authState === 'ready' && token && ADDRESS_RE.test(wallet)) loadCore(token, wallet);
  }, [authState, token, wallet, loadCore]);

  async function connectWallet() {
    setBusy(true);
    setError('');
    setPrepared(null);
    try {
      const result = await connectVoxelFlipWallet();
      setWallet(result.address);
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

  async function prepareListing() {
    setPrepared(null);
    setError('');
    if (!ADDRESS_RE.test(wallet)) return setError('Connect the wallet that owns this VoxelFlip.');
    if (!TOKEN_RE.test(tokenId)) return setError('Enter the VoxelFlip token ID.');
    if (!priceEth || Number(priceEth) <= 0) return setError('Enter a listing price greater than 0 ETH.');

    setBusy(true);
    try {
      const response = await fetch('/api/admin/neural-core/listing-actions', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ wallet, tokenId, priceEth, durationDays: Number(durationDays), useCreatorFee }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'OpenSea could not prepare the listing.');
      setPrepared(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OpenSea could not prepare the listing.');
    } finally {
      setBusy(false);
    }
  }

  const inventory = core?.inventory?.items || [];
  const recommendation = core?.recommendation || {};
  const evidence = recommendation?.evidence || {};
  const priceBand = useMemo(() => Array.isArray(recommendation?.suggestedPriceBandEth) ? recommendation.suggestedPriceBandEth : null, [recommendation]);
  const openSeaUrl = prepared?.openSeaUrl || (core?.contract && TOKEN_RE.test(tokenId) ? `https://opensea.io/item/base/${core.contract}/${tokenId}` : '');

  if (authState === 'loading') {
    return <main className={styles.page}><section className={styles.locked}><h1>Loading listing assistant…</h1></section></main>;
  }

  if (authState === 'signed-out') {
    return <main className={styles.page}>
      <nav className={styles.nav}><Link href="/studio">VoxelPop</Link><em>LISTING ASSISTANT · PRIVATE</em></nav>
      <section className={styles.locked}>
        <small>GOOGLE SESSION REQUIRED</small>
        <h1>Sign in before listing.</h1>
        <p>This assistant uses the same private Neural Core authorization. It never receives your wallet private key.</p>
        <Link href="/studio#my-voxels">Open Studio and sign in →</Link>
      </section>
    </main>;
  }

  return <main className={styles.page}>
    <nav className={styles.nav}>
      <Link href="/admin/neural-core">← Neural Core</Link>
      <em>VOXELFLIP · LISTING ASSISTANT</em>
    </nav>

    <header className={styles.hero}>
      <small>PRICE → VERIFY OWNER → PREPARE → WALLET APPROVAL</small>
      <h1>List with<br/><em>VoxelPop.</em></h1>
      <p>Neural Core can recommend and prepare the OpenSea listing. Your connected wallet remains the final authority. No server-side private key, no silent sale, no automatic signature.</p>
    </header>

    <div className={styles.shell}>
      <section className={styles.panel}>
        <div className={styles.panelHead}><div><small>MARKET EVIDENCE</small><h2>{recommendation.action || 'Price discovery'}</h2></div><span className={styles.badge}>{String(recommendation.confidence || 'LOW').toUpperCase()} CONFIDENCE</span></div>
        <div className={styles.grid}>
          <article className={styles.metric}><small>FLOOR ASK</small><b>{core?.market?.floorPriceEth ? `${number(core.market.floorPriceEth)} ETH` : '—'}</b></article>
          <article className={styles.metric}><small>TOP OFFER</small><b>{core?.market?.topOfferEth ? `${number(core.market.topOfferEth)} ETH` : '—'}</b></article>
          <article className={styles.metric}><small>PRICED SALES</small><b>{evidence.independentPricedSales ?? '—'}</b></article>
        </div>
        <div className={styles.notice} style={{marginTop:12}}>{priceBand ? `Observed price band: ${number(priceBand[0])}–${number(priceBand[1])} ETH. This is evidence-based guidance, not a guaranteed value.` : 'Neural Core does not have enough independent sale evidence to claim a reliable price band yet. You can still choose a manual test asking price.'}</div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHead}><div><small>YOUR LISTING</small><h2>Prepare OpenSea actions</h2></div><span className={styles.badge}>AUTO-SIGN · OFF</span></div>
        <div className={styles.form}>
          <div className={styles.field}>
            <label>Owner wallet</label>
            <input value={wallet} readOnly placeholder="Connect wallet" />
          </div>
          <button className={styles.secondary} type="button" onClick={connectWallet} disabled={busy}>{wallet ? `Reconnect ${short(wallet)}` : 'Connect Base wallet'}</button>

          <div className={styles.field}>
            <label>VoxelFlip</label>
            {inventory.length ? <select value={tokenId} onChange={event => {setTokenId(event.target.value);setPrepared(null)}}>
              <option value="">Choose a VoxelFlip</option>
              {inventory.map(item => <option key={item.tokenId} value={item.tokenId}>VoxelFlip #{item.tokenId} · {item.listed ? `listed ${item.listingPriceEth || ''}` : 'not listed'}</option>)}
            </select> : <input inputMode="numeric" value={tokenId} onChange={event => {setTokenId(event.target.value.replace(/\D/g,''));setPrepared(null)}} placeholder="e.g. 2" />}
          </div>

          <div className={styles.field}>
            <label>Asking price · ETH</label>
            <input inputMode="decimal" value={priceEth} onChange={event => {setPriceEth(event.target.value);setPrepared(null)}} placeholder="0.015" />
          </div>

          <div className={styles.field}>
            <label>Duration</label>
            <select value={durationDays} onChange={event => {setDurationDays(event.target.value);setPrepared(null)}}>
              <option value="7">7 days</option>
              <option value="30">30 days</option>
              <option value="90">90 days</option>
              <option value="180">180 days</option>
            </select>
          </div>

          <label className={styles.check}><input type="checkbox" checked={useCreatorFee} onChange={event => {setUseCreatorFee(event.target.checked);setPrepared(null)}}/><span>Include optional creator earnings when OpenSea supports them for this collection. This does not guarantee royalty enforcement on every marketplace.</span></label>

          <div className={styles.actions}>
            <button className={styles.primary} type="button" onClick={prepareListing} disabled={busy || !wallet || !tokenId || !priceEth}>{busy ? 'Checking Base + OpenSea…' : 'Prepare listing →'}</button>
            {openSeaUrl ? <a className={styles.secondary} href={openSeaUrl} target="_blank" rel="noreferrer">Open on OpenSea ↗</a> : <button className={styles.secondary} type="button" disabled>OpenSea</button>}
          </div>
        </div>
        {error && <div className={styles.error} style={{marginTop:14}}>{error}</div>}
      </section>

      {prepared && <section className={styles.panel}>
        <div className={styles.panelHead}><div><small>PREPARED</small><h2>OpenSea accepted the listing plan.</h2></div><span className={styles.badge}>NOT LISTED YET</span></div>
        <div className={styles.success}>VoxelFlip #{prepared.tokenId} is confirmed as owned by {short(prepared.owner)}. Price: {prepared.priceEth} ETH for {prepared.durationDays} days. Nothing has been signed or published yet.</div>
        <div className={styles.steps}>
          {(prepared.actionTypes || []).map((type, index) => <div className={styles.step} key={`${type}-${index}`}><b>{String(index + 1).padStart(2,'0')} · {type}</b><span>wallet action</span></div>)}
          {!prepared.actionTypes?.length && <div className={styles.step}><b>OpenSea returned no executable steps.</b><span>retry safely</span></div>}
        </div>
        <div className={styles.notice} style={{marginTop:14}}>The next engineering step is executing these official actions in your wallet from VoxelPop. Until that parser is verified against the live OpenSea action shape, finish on OpenSea rather than signing an unverified payload.</div>
        <div className={styles.actions} style={{marginTop:14}}>
          <a className={styles.primary} href={prepared.openSeaUrl} target="_blank" rel="noreferrer">Finish on OpenSea ↗</a>
          <Link className={styles.secondary} href="/admin/neural-core">Back to Neural Core</Link>
        </div>
      </section>}

      <section className={styles.panel}>
        <div className={styles.notice}>Safety rule: the Listing Assistant may price, verify ownership and prepare official OpenSea actions. It may not sign, list, transfer or spend without a wallet approval path that has been separately verified.</div>
      </section>
    </div>
  </main>;
}
