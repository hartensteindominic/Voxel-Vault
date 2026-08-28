'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getSupabaseBrowserAsync } from '../../../../lib/supabase-browser';

const AUTH_TIMEOUT_MS = 10000;
const API_TIMEOUT_MS = 12000;
const QUOTE_REFRESH_MS = 12000;

function withTimeout(promise, timeoutMs, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function fetchWithTimeout(input, init = {}, timeoutMs = API_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal, cache: 'no-store' });
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('Live provider request timed out. No order was assumed to be placed.');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function readJson(response) {
  return response.json().catch(() => ({}));
}

function usd(value) {
  const number = Number(value || 0);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(Number.isFinite(number) ? number : 0);
}

function short(value) {
  const text = String(value || '');
  return text.length > 18 ? `${text.slice(0, 8)}…${text.slice(-6)}` : text || '—';
}

export default function LiveDigitalRealEstatePage() {
  const [token, setToken] = useState('');
  const [authState, setAuthState] = useState('loading');
  const [state, setState] = useState(null);
  const [amount, setAmount] = useState('25');
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const [disclosuresAccepted, setDisclosuresAccepted] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const live = state?.live || {};
  const maxOrder = Number(live.orderMaxUsd || 700);
  const totalCash = useMemo(() => (state?.cash || []).reduce((sum, item) => sum + Number(item.amount || 0), 0), [state?.cash]);
  const portfolioBySymbol = useMemo(() => new Map((state?.portfolio || []).map((item) => [item.symbol, item])), [state?.portfolio]);

  const load = useCallback(async (accessToken) => {
    if (!accessToken) return;
    setBusy('load');
    setError('');
    try {
      const response = await fetchWithTimeout('/api/admin/digital-reits/live', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await readJson(response);
      if (!response.ok || !data.ok) throw new Error(data.error || 'Live real-estate status could not be loaded.');
      setState(data);
      setAuthState('authorized');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Live real-estate status could not be loaded.');
    } finally {
      setBusy('');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let subscription;
    (async () => {
      try {
        const client = await withTimeout(getSupabaseBrowserAsync(), AUTH_TIMEOUT_MS, 'Voxel Vault account setup timed out.');
        const { data } = await withTimeout(client.auth.getSession(), AUTH_TIMEOUT_MS, 'Your Google session check timed out.');
        const accessToken = data?.session?.access_token || '';
        if (cancelled) return;
        if (!accessToken) {
          setAuthState('signed-out');
          return;
        }
        setToken(accessToken);
        setAuthState('authenticated');
        await load(accessToken);
        const result = client.auth.onAuthStateChange((_event, session) => {
          const next = session?.access_token || '';
          setToken(next);
          if (!next) {
            setAuthState('signed-out');
            setState(null);
          }
        });
        subscription = result?.data?.subscription;
      } catch (err) {
        if (!cancelled) {
          setAuthState('auth-error');
          setError(err instanceof Error ? err.message : 'Owner authentication could not be loaded.');
        }
      }
    })();
    return () => {
      cancelled = true;
      subscription?.unsubscribe?.();
    };
  }, [load]);

  const requestQuote = useCallback(async (asset, { quiet = false } = {}) => {
    if (!token || !asset || busy === 'buy') return;
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount < 1 || numericAmount > maxOrder) {
      setError(`Enter a live investment amount between $1 and $${maxOrder}.`);
      return;
    }
    if (!quiet) {
      setBusy('quote');
      setNotice('');
    }
    setError('');
    try {
      const response = await fetchWithTimeout('/api/admin/digital-reits/live-quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ stockId: asset.id, paymentAmount: numericAmount }),
      });
      const data = await readJson(response);
      if (!response.ok || !data.ok) throw new Error(data.error || 'Live NBBO confirmation could not be created.');
      setSelectedAsset(asset);
      setConfirmation(data.confirmation);
      if (!quiet) setDisclosuresAccepted(false);
    } catch (err) {
      setConfirmation(null);
      setError(err instanceof Error ? err.message : 'Live NBBO confirmation could not be created.');
    } finally {
      if (!quiet) setBusy('');
    }
  }, [amount, busy, maxOrder, token]);

  useEffect(() => {
    if (!confirmation || !selectedAsset || busy === 'buy' || !live.executable) return undefined;
    const timer = window.setInterval(() => {
      requestQuote(selectedAsset, { quiet: true });
    }, QUOTE_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [confirmation, selectedAsset, busy, live.executable, requestQuote]);

  async function placeLiveBuy() {
    if (!token || !confirmation || !disclosuresAccepted || busy) return;
    const accepted = window.confirm(
      `REAL MONEY ORDER\n\nPlace a ${usd(confirmation.paymentAmount)} market buy of ${confirmation.quote?.symbol || selectedAsset?.symbol || 'this security'} through the configured live Dinari account?\n\nMarket price can move before execution. This is not a purchase of a deed to a specific house.`
    );
    if (!accepted) return;

    setBusy('buy');
    setError('');
    setNotice('');
    try {
      const response = await fetchWithTimeout('/api/admin/digital-reits/live-buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ confirmationToken: confirmation.confirmationToken }),
      });
      const data = await readJson(response);
      if (!response.ok || !data.ok) throw new Error(data.error || 'Live order was not accepted.');
      const orderId = data.order?.id || data.order?.order_request_id || data.order?.order_id || 'provider order created';
      setNotice(`LIVE order request accepted by Dinari: ${orderId}. Voxel Vault will only show the position after the provider portfolio reports it.`);
      setConfirmation(null);
      setSelectedAsset(null);
      setDisclosuresAccepted(false);
      await load(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Live order failed. Do not assume an order was placed unless the provider confirms it.');
    } finally {
      setBusy('');
    }
  }

  if (authState === 'loading' || authState === 'authenticated') {
    return <main style={page}><section style={panel}><div style={eyebrow}>OWNER LIVE REAL ESTATE</div><h1 style={hero}>Checking owner access…</h1></section></main>;
  }

  if (authState === 'signed-out') {
    return <main style={page}><section style={panel}><div style={eyebrow}>OWNER ONLY</div><h1 style={hero}>Sign in first.</h1><p style={copy}>Open the Voxel Vault owner/admin flow with the approved Google account, then return to this page.</p><Link href="/admin/digital-reits" style={button}>OPEN OWNER ONBOARDING</Link></section></main>;
  }

  return (
    <main style={page}>
      <div style={shell}>
        <nav style={nav}>
          <Link href="/" style={brand}>V · Voxel Vault</Link>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            <Link href="/admin/digital-reits" style={navLink}>Sandbox / onboarding</Link>
            <Link href="/real-estate/reits" style={navLink}>Spatial REIT Vault</Link>
          </div>
        </nav>

        <section style={{padding:'54px 0 24px'}}>
          <div style={eyebrow}>OWNER-ONLY · LIVE REAL-ESTATE SECURITIES</div>
          <h1 style={hero}>Real money.<br/><span style={{color:'#b8ff55'}}>Fail closed.</span></h1>
          <p style={{...copy,maxWidth:760,fontSize:18}}>This console is the first live-money path for Voxel Vault: provider-backed REIT and real-estate securities through the configured Dinari live account. It does not claim that a dShare is the deed to an individual property.</p>
        </section>

        {error ? <div style={{...panel,borderColor:'#7b4742',color:'#ffc5bd'}}>{error}</div> : null}
        {notice ? <div style={{...panel,borderColor:'#496337',color:'#d8f9ae'}}>{notice}</div> : null}

        <section style={grid}>
          <div style={panel}><div style={label}>ENVIRONMENT</div><strong style={metric}>{String(live.environment || 'unknown').toUpperCase()}</strong><p style={small}>Must be LIVE to trade real money.</p></div>
          <div style={panel}><div style={label}>EXECUTION</div><strong style={metric}>{live.executable ? 'READY' : 'LOCKED'}</strong><p style={small}>{live.executable ? 'Provider + code gates passed' : 'No real-money order can execute'}</p></div>
          <div style={panel}><div style={label}>PROVIDER CASH</div><strong style={metric}>{usd(totalCash)}</strong><p style={small}>Provider-reported balances; not a promise of buying power.</p></div>
          <div style={panel}><div style={label}>PER-ORDER CAP</div><strong style={metric}>{usd(maxOrder)}</strong><p style={small}>Hard V1 maximum.</p></div>
        </section>

        {!live.executable ? (
          <section style={{...panel,marginTop:18,borderColor:'#645336'}}>
            <div style={eyebrow}>LIVE ACTIVATION BLOCKERS</div>
            <h2 style={sectionTitle}>Nothing spends money until every line is real.</h2>
            <ul style={{...copy,paddingLeft:20}}>
              {(live.readinessBlockers || []).map((item) => <li key={item} style={{marginBottom:7}}>{item}</li>)}
              {(live.providerAccount?.blockers || []).map((item) => <li key={`provider-${item}`} style={{marginBottom:7}}>{item}</li>)}
              {live.providerAccountError ? <li>{live.providerAccountError}</li> : null}
            </ul>
          </section>
        ) : (
          <section style={{...panel,marginTop:18,borderColor:'#4b6338'}}>
            <div style={eyebrow}>PROVIDER VERIFIED</div>
            <h2 style={sectionTitle}>Live account is eligible for this managed-order path.</h2>
            <div style={grid}>
              <div style={mini}><span style={label}>KYC</span><b>{live.providerAccount?.kycStatus || '—'}</b></div>
              <div style={mini}><span style={label}>US ACCOUNT</span><b>{live.providerAccount?.accountActive ? 'ACTIVE' : '—'}</b></div>
              <div style={mini}><span style={label}>MANAGED WALLET</span><b>{live.providerAccount?.managedWallet ? 'YES' : 'NO'}</b></div>
              <div style={mini}><span style={label}>AML FLAG</span><b>{live.providerAccount?.amlFlagged ? 'FLAGGED' : 'CLEAR'}</b></div>
            </div>
          </section>
        )}

        <section style={{marginTop:30}}>
          <div style={{display:'flex',justifyContent:'space-between',gap:16,alignItems:'end',flexWrap:'wrap'}}>
            <div>
              <div style={eyebrow}>PROVIDER-CONFIRMED REAL ESTATE UNIVERSE</div>
              <h2 style={sectionTitle}>Choose the exposure, then review NBBO.</h2>
            </div>
            <label style={{display:'grid',gap:6,minWidth:170}}>
              <span style={label}>INVESTMENT AMOUNT</span>
              <input
                type="number"
                min="1"
                max={maxOrder}
                step="1"
                value={amount}
                onChange={(event) => { setAmount(event.target.value); setConfirmation(null); setSelectedAsset(null); }}
                style={input}
                aria-label="Live investment amount in US dollars"
              />
            </label>
          </div>

          <div style={{...grid,marginTop:14}}>
            {(state?.catalog || []).map((asset) => {
              const holding = portfolioBySymbol.get(asset.symbol);
              return (
                <article key={asset.id} style={panel}>
                  <div style={label}>{asset.rawType || 'TOKENIZED SECURITY'}</div>
                  <h3 style={{fontSize:32,margin:'7px 0 2px'}}>{asset.symbol}</h3>
                  <p style={{...copy,minHeight:44}}>{asset.name}</p>
                  <div style={mini}><span style={label}>PROVIDER POSITION</span><b>{holding ? Number(holding.amount || 0).toFixed(6) : '0.000000'}</b></div>
                  <button
                    type="button"
                    onClick={() => requestQuote(asset)}
                    disabled={!live.executable || Boolean(busy)}
                    style={{...button,width:'100%',marginTop:12,opacity:(!live.executable || busy) ? .45 : 1,cursor:(!live.executable || busy) ? 'not-allowed':'pointer'}}
                  >
                    {busy === 'quote' && selectedAsset?.id === asset.id ? 'GETTING NBBO…' : `REVIEW ${usd(amount || 0)} LIVE BUY`}
                  </button>
                </article>
              );
            })}
          </div>
        </section>

        {confirmation ? (
          <section style={{...panel,marginTop:28,borderColor:'#70814a'}}>
            <div style={eyebrow}>MANDATORY PRE-TRADE CONFIRMATION · AUTO-REFRESHES</div>
            <div style={{display:'flex',justifyContent:'space-between',gap:16,flexWrap:'wrap',alignItems:'start'}}>
              <div>
                <h2 style={{...sectionTitle,marginBottom:4}}>{confirmation.quote.symbol} · {usd(confirmation.paymentAmount)}</h2>
                <p style={{...small,marginTop:0}}>Quote token expires {new Date(confirmation.expiresAt).toLocaleTimeString()} and is refreshed while this review is open.</p>
              </div>
              <span style={pill}>REAL MONEY</span>
            </div>

            <div style={{...grid,marginTop:15}}>
              <div style={mini}><span style={label}>BID</span><b>{usd(confirmation.quote.bid)}</b><small>{confirmation.quote.bidSize} shares · {confirmation.quote.bidExchange}</small></div>
              <div style={mini}><span style={label}>OFFER</span><b>{usd(confirmation.quote.offer)}</b><small>{confirmation.quote.offerSize} shares · {confirmation.quote.offerExchange}</small></div>
              <div style={mini}><span style={label}>QUOTE TIME</span><b>{new Date(confirmation.quote.timestamp).toLocaleTimeString()}</b><small>Provider SIP/NBBO feed</small></div>
              <div style={mini}><span style={label}>DISCLOSURES</span><b>{confirmation.disclosureVersion || 'approved version'}</b><small>Must remain approved</small></div>
            </div>

            <div style={{...panel,marginTop:14,background:'#0a0e0a'}}>
              <p style={{...copy,marginTop:0}}>A market order can fill at a different price than the displayed offer. This security provides exposure to a real-estate company/fund; it is not a recorded deed or guaranteed increase in value.</p>
              {confirmation.disclosurePageUrl ? (
                <a href={confirmation.disclosurePageUrl} target="_blank" rel="noreferrer" style={{...button,display:'inline-block',textDecoration:'none',background:'#1b2419'}}>OPEN APPROVED DISCLOSURES ↗</a>
              ) : null}
              <label style={{display:'flex',gap:10,alignItems:'start',marginTop:15,color:'#dce7d7',fontSize:13,lineHeight:1.5}}>
                <input type="checkbox" checked={disclosuresAccepted} onChange={(event) => setDisclosuresAccepted(event.target.checked)} style={{width:20,height:20,marginTop:1}} />
                <span>I reviewed the approved disclosures and this current pre-trade quote, and I want to submit this real-money market order.</span>
              </label>
            </div>

            <button
              type="button"
              onClick={placeLiveBuy}
              disabled={!disclosuresAccepted || Boolean(busy)}
              style={{...button,width:'100%',marginTop:14,background:'#b8ff55',color:'#081008',opacity:(!disclosuresAccepted || busy) ? .45 : 1,cursor:(!disclosuresAccepted || busy) ? 'not-allowed':'pointer'}}
            >
              {busy === 'buy' ? 'SUBMITTING LIVE ORDER…' : `PLACE LIVE ${usd(confirmation.paymentAmount)} MARKET BUY`}
            </button>
          </section>
        ) : null}

        <section style={{...panel,marginTop:28}}>
          <div style={eyebrow}>BOUNDARY</div>
          <p style={{...copy,marginBottom:0}}>This is live investing in provider-backed real-estate securities when the external production gates are genuinely active. Voxel Vault still does not issue fractional interests in an individual house from this screen, pool customer money, auto-reinvest dividends, or bypass the registered provider.</p>
        </section>
      </div>
    </main>
  );
}

const page={minHeight:'100vh',background:'#070a08',color:'#f4f7f0',fontFamily:'Inter,ui-sans-serif,system-ui,-apple-system,sans-serif'};
const shell={maxWidth:1180,margin:'0 auto',padding:'18px clamp(16px,4vw,38px) 60px'};
const nav={display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap'};
const brand={color:'#f4f7f0',textDecoration:'none',fontWeight:950,letterSpacing:'-.04em',fontSize:20};
const navLink={color:'#bcc7b8',textDecoration:'none',fontSize:12,fontWeight:800,border:'1px solid #2c352b',borderRadius:999,padding:'8px 11px'};
const hero={fontSize:'clamp(3.3rem,9vw,7rem)',lineHeight:.84,letterSpacing:'-.075em',margin:'13px 0 22px'};
const sectionTitle={fontSize:'clamp(1.8rem,4.5vw,3.2rem)',lineHeight:.98,letterSpacing:'-.055em',margin:'8px 0 12px'};
const eyebrow={fontSize:11,fontWeight:950,letterSpacing:'.15em',color:'#b8ff55'};
const label={fontSize:10,fontWeight:900,letterSpacing:'.12em',color:'#8e9a89'};
const copy={color:'#aeb9aa',lineHeight:1.6,fontSize:14};
const small={color:'#82907e',lineHeight:1.5,fontSize:11};
const grid={display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))',gap:12};
const panel={border:'1px solid #283126',background:'#0d120d',borderRadius:22,padding:20,minWidth:0};
const mini={border:'1px solid #252e24',borderRadius:14,padding:12,display:'grid',gap:4,minWidth:0,overflowWrap:'anywhere'};
const metric={display:'block',fontSize:28,letterSpacing:'-.04em',marginTop:7};
const button={border:0,borderRadius:13,padding:'13px 15px',fontWeight:950,fontSize:12,letterSpacing:'.03em',background:'#20291e',color:'#f4f7f0'};
const input={border:'1px solid #394235',borderRadius:12,padding:'11px 12px',background:'#0d120d',color:'#f4f7f0',fontSize:16,width:'100%',boxSizing:'border-box'};
const pill={border:'1px solid #5e713e',borderRadius:999,padding:'8px 11px',fontSize:11,fontWeight:950,letterSpacing:'.09em',color:'#d9ffad',whiteSpace:'nowrap'};
