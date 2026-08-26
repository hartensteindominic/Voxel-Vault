'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { getSupabaseBrowserAsync } from '../../../../lib/supabase-browser';
import { connectVoxelFlipWallet } from '../../../../lib/voxelflip';
import styles from './listing.module.css';

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const TOKEN_RE = /^\d+$/;
const MAX_BATCH = 25;

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
  const [selectedIds, setSelectedIds] = useState([]);
  const [manualTokenId, setManualTokenId] = useState('');
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
    if (TOKEN_RE.test(initialToken)) {
      setManualTokenId(initialToken);
      setSelectedIds([initialToken]);
    }
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
      const items = Array.isArray(data?.inventory?.items) ? data.inventory.items : [];
      setSelectedIds(current => current.length ? current : (items[0]?.tokenId ? [String(items[0].tokenId)] : []));
      setPriceEth(current => current || suggestedPrice(data));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Neural Core market data could not be loaded.');
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

  const inventory = core?.inventory?.items || [];
  const recommendation = core?.recommendation || {};
  const evidence = recommendation?.evidence || {};
  const priceBand = useMemo(() => Array.isArray(recommendation?.suggestedPriceBandEth) ? recommendation.suggestedPriceBandEth : null, [recommendation]);
  const chosenIds = useMemo(() => {
    if (inventory.length) return selectedIds.filter(id => inventory.some(item => String(item.tokenId) === id));
    return TOKEN_RE.test(manualTokenId) ? [manualTokenId] : [];
  }, [inventory, selectedIds, manualTokenId]);

  function toggleToken(id) {
    const tokenId = String(id);
    setPrepared(null);
    setSelectedIds(current => current.includes(tokenId) ? current.filter(value => value !== tokenId) : [...current, tokenId]);
  }

  function selectAll() {
    const ids = inventory.map(item => String(item.tokenId)).slice(0, MAX_BATCH);
    setSelectedIds(ids);
    setPrepared(null);
    if (inventory.length > MAX_BATCH) setError(`Selected the first ${MAX_BATCH}. List the remaining VoxelFlips in another batch.`);
    else setError('');
  }

  function selectUnlisted() {
    const ids = inventory.filter(item => !item.listed).map(item => String(item.tokenId)).slice(0, MAX_BATCH);
    setSelectedIds(ids);
    setPrepared(null);
    if (inventory.filter(item => !item.listed).length > MAX_BATCH) setError(`Selected the first ${MAX_BATCH} unlisted VoxelFlips. Use another batch for the rest.`);
    else setError('');
  }

  async function listOnOpenSea() {
    setPrepared(null);
    setError('');
    if (!ADDRESS_RE.test(wallet)) return setError('Connect the wallet that owns these VoxelFlips.');
    if (!chosenIds.length) return setError('Choose at least one VoxelFlip.');
    if (chosenIds.length > MAX_BATCH) return setError(`Choose no more than ${MAX_BATCH} VoxelFlips in one batch.`);
    if (!priceEth || Number(priceEth) <= 0) return setError('Enter a listing price greater than 0 ETH.');

    setBusy(true);
    try {
      const response = await fetch('/api/admin/neural-core/listing-actions', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          wallet,
          items: chosenIds.map(tokenId => ({ tokenId, priceEth })),
          durationDays: Number(durationDays),
          useCreatorFee,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'OpenSea could not prepare the listing.');
      setPrepared(data);

      const destination = data.itemCount > 1 ? data.openSeaProfileUrl : data.openSeaUrl;
      if (destination) window.location.assign(destination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OpenSea could not prepare the listing.');
    } finally {
      setBusy(false);
    }
  }

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
      <small>CHOOSE → PRICE → VERIFY OWNER → OPENSEA → YOUR WALLET</small>
      <h1>List with<br/><em>your signature.</em></h1>
      <p>Choose one VoxelFlip, several, or all of them. VoxelPop verifies ownership and prepares the listing inputs. OpenSea handles the final marketplace flow and your wallet remains the only signer.</p>
    </header>

    <div className={styles.shell}>
      <section className={styles.panel}>
        <div className={styles.panelHead}><div><small>MARKET EVIDENCE</small><h2>{recommendation.action || 'Price discovery'}</h2></div><span className={styles.badge}>{String(recommendation.confidence || 'LOW').toUpperCase()} CONFIDENCE</span></div>
        <div className={styles.grid}>
          <article className={styles.metric}><small>FLOOR ASK</small><b>{core?.market?.floorPriceEth ? `${number(core.market.floorPriceEth)} ETH` : '—'}</b></article>
          <article className={styles.metric}><small>TOP OFFER</small><b>{core?.market?.topOfferEth ? `${number(core.market.topOfferEth)} ETH` : '—'}</b></article>
          <article className={styles.metric}><small>PRICED SALES</small><b>{evidence.independentPricedSales ?? '—'}</b></article>
        </div>
        <div className={styles.notice} style={{marginTop:12}}>{priceBand ? `Suggested starting price: ${suggestedPrice(core)} ETH from the observed ${number(priceBand[0])}–${number(priceBand[1])} ETH band. This is market guidance, not a guaranteed sale price.` : 'Neural Core does not have enough independent sale evidence for a reliable price band yet. Choose the asking price yourself and review it again on OpenSea.'}</div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHead}><div><small>YOUR LISTING</small><h2>Choose what to list</h2></div><span className={styles.badge}>AUTO-SIGN · OFF</span></div>
        <div className={styles.form}>
          <div className={styles.field}>
            <label>Owner wallet</label>
            <input value={wallet} readOnly placeholder="Connect wallet" />
          </div>
          <button className={styles.secondary} type="button" onClick={connectWallet} disabled={busy}>{wallet ? `Reconnect ${short(wallet)}` : 'Connect Base wallet'}</button>

          {inventory.length ? <>
            <div className={styles.selectionHead}>
              <div><b>{chosenIds.length} selected</b><span>{inventory.length} VoxelFlip{inventory.length === 1 ? '' : 's'} found</span></div>
              <div className={styles.miniActions}>
                <button type="button" onClick={selectUnlisted} disabled={busy}>Select unlisted</button>
                <button type="button" onClick={selectAll} disabled={busy}>Select all</button>
                <button type="button" onClick={() => {setSelectedIds([]);setPrepared(null)}} disabled={busy}>Clear</button>
              </div>
            </div>
            <div className={styles.inventoryList}>
              {inventory.map(item => {
                const id = String(item.tokenId);
                const checked = selectedIds.includes(id);
                return <label className={`${styles.inventoryItem} ${checked ? styles.inventorySelected : ''}`} key={id}>
                  <input type="checkbox" checked={checked} onChange={() => toggleToken(id)} />
                  <span><b>VoxelFlip #{id}</b><small>{item.listed ? `Already listed${item.listingPriceEth ? ` · ${item.listingPriceEth} ETH` : ''}` : 'Not currently listed'}</small></span>
                </label>;
              })}
            </div>
          </> : <div className={styles.field}>
            <label>VoxelFlip token ID</label>
            <input inputMode="numeric" value={manualTokenId} onChange={event => {setManualTokenId(event.target.value.replace(/\D/g,''));setPrepared(null)}} placeholder="e.g. 2" />
          </div>}

          <div className={styles.field}>
            <label>Asking price · ETH {chosenIds.length > 1 ? '(applied to each selected voxel)' : ''}</label>
            <input inputMode="decimal" value={priceEth} onChange={event => {setPriceEth(event.target.value);setPrepared(null)}} placeholder="0.015" />
          </div>

          <div className={styles.field}>
            <label>Duration</label>
            <select value={durationDays} onChange={event => {setDurationDays(event.target.value);setPrepared(null)}}>
              <option value="7">7 days</option>
              <option value="30">30 days · recommended default</option>
              <option value="90">90 days</option>
              <option value="180">180 days</option>
            </select>
          </div>

          <label className={styles.check}><input type="checkbox" checked={useCreatorFee} onChange={event => {setUseCreatorFee(event.target.checked);setPrepared(null)}}/><span>Include creator earnings when OpenSea supports them for this collection. Kept ON by default. OpenSea will show the actual fees and proceeds before you complete the listing.</span></label>

          <div className={styles.notice}>No reserve/private buyer is set. Nothing here can sign for you. After ownership is verified, you are sent to OpenSea to review the final marketplace terms and approve the required wallet prompt(s).</div>

          <div className={styles.actions}>
            <button className={styles.primary} type="button" onClick={listOnOpenSea} disabled={busy || !wallet || !chosenIds.length || !priceEth}>{busy ? 'Verifying Base + OpenSea…' : chosenIds.length > 1 ? `List ${chosenIds.length} on OpenSea →` : 'List on OpenSea →'}</button>
            <Link className={styles.secondary} href="/admin/neural-core">Back to Neural Core</Link>
          </div>
        </div>
        {error && <div className={styles.error} style={{marginTop:14}}>{error}</div>}
      </section>

      {prepared && <section className={styles.panel}>
        <div className={styles.panelHead}><div><small>VERIFIED PLAN</small><h2>Ready for your OpenSea approval.</h2></div><span className={styles.badge}>YOUR WALLET SIGNS</span></div>
        <div className={styles.success}>{prepared.itemCount} VoxelFlip{prepared.itemCount === 1 ? '' : 's'} verified as owned by {short(prepared.owner)}. Asking price: {prepared.items?.[0]?.priceEth} ETH each for {prepared.durationDays} days. Creator earnings: {prepared.useCreatorFee ? 'ON' : 'OFF'}.</div>
        <div className={styles.steps}>
          {(prepared.items || []).map(item => <a className={styles.stepLink} key={item.tokenId} href={item.openSeaUrl} target="_blank" rel="noreferrer"><b>VoxelFlip #{item.tokenId}</b><span>Open on OpenSea ↗</span></a>)}
        </div>
      </section>}

      <section className={styles.panel}>
        <div className={styles.notice}>Safety rule: VoxelPop may recommend prices, verify ownership, and request official OpenSea listing preparation. OpenSea and your connected wallet perform the final approval/signature. Your owner private key is never stored by VoxelPop.</div>
      </section>
    </div>
  </main>;
}
