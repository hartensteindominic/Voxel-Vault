'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getSupabaseBrowserAsync } from '../../../lib/supabase-browser';

const AUTH_TIMEOUT_MS = 10000;
const API_TIMEOUT_MS = 12000;
const POLL_MS = 10000;

function withTimeout(promise, timeoutMs, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function fetchWithTimeout(input, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal, cache: 'no-store' });
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('Voxel Vault timed out waiting for Alpaca sandbox. Retry once.');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function short(value) {
  const text = String(value || '');
  return text.length > 18 ? `${text.slice(0, 8)}…${text.slice(-6)}` : text || '—';
}

function statusTone(ok, pending = false) {
  if (ok) return { border: '#526b3c', color: '#d8f3b8', background: '#0f170c' };
  if (pending) return { border: '#5f6237', color: '#e8e7b0', background: '#17170c' };
  return { border: '#5a3936', color: '#efbbb3', background: '#160d0c' };
}

export default function AlpacaReadinessPage() {
  const [token, setToken] = useState('');
  const [authState, setAuthState] = useState('loading');
  const [snapshot, setSnapshot] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (accessToken) => {
    if (!accessToken) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetchWithTimeout('/api/admin/alpaca/readiness', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Alpaca readiness could not be loaded.');
      setSnapshot(payload);
      setAuthState('authorized');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Alpaca readiness could not be loaded.');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let subscription;
    (async () => {
      try {
        const client = await withTimeout(
          getSupabaseBrowserAsync(),
          AUTH_TIMEOUT_MS,
          'Voxel Vault owner session took too long to load.'
        );
        const { data } = await withTimeout(
          client.auth.getSession(),
          AUTH_TIMEOUT_MS,
          'Your owner session check timed out.'
        );
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
            setSnapshot(null);
          }
        });
        subscription = result?.data?.subscription;
      } catch (err) {
        if (!cancelled) {
          setAuthState('auth-error');
          setError(err instanceof Error ? err.message : 'Owner session could not be loaded.');
        }
      }
    })();
    return () => {
      cancelled = true;
      subscription?.unsubscribe?.();
    };
  }, [load]);

  const allReadReady = Boolean(snapshot?.readiness?.providerReadReady);
  const transferPending = Boolean(snapshot?.readiness?.latestTransferStatus && snapshot.readiness.latestTransferStatus !== 'COMPLETE');

  useEffect(() => {
    if (!token || !snapshot || allReadReady && snapshot?.readiness?.incomingTransferComplete) return undefined;
    const timer = window.setInterval(() => load(token), POLL_MS);
    return () => window.clearInterval(timer);
  }, [token, snapshot, allReadReady, load]);

  const latestTransfer = useMemo(() => (snapshot?.transfers || [])[0] || null, [snapshot?.transfers]);
  const approvedAch = useMemo(() => (snapshot?.achRelationships || []).find((item) => item.status === 'APPROVED') || null, [snapshot?.achRelationships]);

  if (authState === 'loading') return <main style={page}><div style={center}>Checking owner session…</div></main>;

  if (authState === 'signed-out') {
    return <main style={page}><div style={shell}><section style={heroCard}>
      <div style={eyebrow}>ALPACA SANDBOX · OWNER ONLY</div>
      <h1 style={h1}>Sign in first.</h1>
      <p style={copy}>Use your existing Voxel Vault owner Google session. Broker credentials and bank details never enter this page.</p>
      <Link href="/studio#my-voxels" style={primaryLink}>Open Studio sign-in →</Link>
    </section></div></main>;
  }

  if (authState === 'auth-error') {
    return <main style={page}><div style={shell}><section style={heroCard}>
      <div style={eyebrow}>OWNER SESSION RECOVERY</div>
      <h1 style={h1}>Session stalled.</h1>
      <p style={copy}>{error}</p>
      <button style={primaryButton} onClick={() => window.location.reload()}>Retry owner session</button>
    </section></div></main>;
  }

  const account = snapshot?.account;
  const readiness = snapshot?.readiness || {};
  const credentialsOkay = Boolean(snapshot?.credentialsConfigured);
  const accountConfigured = Boolean(snapshot?.accountConfigured);

  const nextAction = !credentialsOkay
    ? 'Add Alpaca SANDBOX Broker credentials to the server environment.'
    : !accountConfigured
      ? 'Add the non-secret Alpaca sandbox Account ID to the server environment.'
      : !readiness.accountActive
        ? `Wait for Alpaca account status ACTIVE. Current: ${account?.status || 'unknown'}.`
        : !readiness.approvedAchRelationship
          ? 'Wait for the ACH relationship to become APPROVED.'
          : !readiness.incomingTransferComplete
            ? `Wait for the incoming sandbox transfer to become COMPLETE. Current: ${readiness.latestTransferStatus || 'unknown'}.`
            : 'Provider read path is ready. Keep trading disabled until the separate sandbox-order implementation is reviewed.';

  return <main style={page}><div style={shell}>
    <nav style={nav}>
      <Link href="/" style={brand}>V · Voxel Vault</Link>
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
        <Link href="/real-estate/reits" style={navLink}>Spatial REIT Vault</Link>
        <Link href="/admin/digital-reits" style={navLink}>Dinari status</Link>
        <span style={pill}>OWNER · PRIVATE</span>
      </div>
    </nav>

    <header style={{padding:'46px 0 22px'}}>
      <div style={eyebrow}>SECOND PROVIDER RAIL · ALPACA SANDBOX</div>
      <h1 style={h1}>Know exactly<br/><span style={{color:'#b8ff55'}}>when it is ready.</span></h1>
      <p style={copy}>This page is read-only. It checks Alpaca account status, ACH relationship state and sandbox transfer state. It cannot place trades, create bank relationships, move real money or expose Broker API secrets.</p>
    </header>

    {error ? <div style={errorBox}>{error}</div> : null}
    <section style={nextBox}>
      <div><div style={nextEyebrow}>NEXT ACTION</div><div style={nextTitle}>{nextAction}</div></div>
      <button style={secondaryButton} disabled={busy || !token} onClick={() => load(token)}>{busy ? 'Checking…' : 'Check now'}</button>
    </section>

    <section style={grid}>
      <StatusCard title="SERVER CREDENTIALS" value={credentialsOkay ? 'READY' : 'MISSING'} ok={credentialsOkay} detail={credentialsOkay ? `Auth mode: ${snapshot?.authenticationMode || 'configured'}` : 'Use server-only sandbox credentials. Never NEXT_PUBLIC_.'}/>
      <StatusCard title="ACCOUNT" value={account?.status || (accountConfigured ? 'CHECKING' : 'NOT CONFIGURED')} ok={readiness.accountActive} pending={Boolean(accountConfigured && !readiness.accountActive)} detail={account ? `Account ${short(account.id)} · blocked: ${String(Boolean(account.accountBlocked || account.tradingBlocked))}` : 'Waiting for configured Account ID.'}/>
      <StatusCard title="ACH RELATIONSHIP" value={approvedAch ? 'APPROVED' : (snapshot?.achRelationships?.[0]?.status || 'WAITING')} ok={Boolean(approvedAch)} pending={Boolean(snapshot?.achRelationships?.length && !approvedAch)} detail={approvedAch ? `Relationship ${short(approvedAch.id)}` : 'No approved ACH relationship reported yet.'}/>
      <StatusCard title="INCOMING TRANSFER" value={readiness.incomingTransferComplete ? 'COMPLETE' : (readiness.latestTransferStatus || 'WAITING')} ok={readiness.incomingTransferComplete} pending={transferPending} detail={latestTransfer ? `${latestTransfer.direction || ''} ${latestTransfer.currency || 'USD'} ${Number(latestTransfer.amount || 0).toFixed(2)} · ${short(latestTransfer.id)}` : 'No transfer returned by the provider yet.'}/>
    </section>

    <section style={{...card,marginTop:14,borderColor:allReadReady?'#526b3c':'#283126'}}>
      <div style={eyebrow}>READINESS GATE</div>
      <h2 style={h2}>{allReadReady ? 'Alpaca provider reads are ready.' : 'Provider reads are still gated.'}</h2>
      <p style={copy}>Sandbox order execution remains <b style={{color:'#fff'}}>code-locked</b> even after the account is ready. This first milestone proves identity/account/funding state before any order endpoint is added.</p>
      <pre style={code}>{`ALPACA_BROKER_ENVIRONMENT=sandbox\nALPACA_BROKER_CLIENT_ID=<server only>\nALPACA_BROKER_CLIENT_SECRET=<server only>\nALPACA_BROKER_ACCOUNT_ID=<non-secret account id>`}</pre>
    </section>

    {snapshot?.errors?.length ? <section style={{...card,marginTop:14,borderColor:'#66403d'}}><div style={eyebrow}>PROVIDER WARNINGS</div>{snapshot.errors.map((item) => <p key={item} style={{...copy,color:'#f0c5bd'}}>{item}</p>)}</section> : null}

    <footer style={{padding:'26px 0',color:'#71806d',fontSize:12}}>Alpaca sandbox readiness only · read-only · no live money · no trading implementation enabled.</footer>
  </div></main>;
}

function StatusCard({ title, value, ok, pending, detail }) {
  const tone = statusTone(ok, pending);
  return <article style={{...card,borderColor:tone.border,background:tone.background}}>
    <div style={eyebrow}>{title}</div>
    <div style={{fontSize:27,fontWeight:950,letterSpacing:'-.045em',marginTop:7,color:tone.color}}>{value}</div>
    <p style={{...copy,margin:'8px 0 0'}}>{detail}</p>
  </article>;
}

const page={minHeight:'100vh',background:'#070a08',color:'#f5f8f1',fontFamily:'Inter,ui-sans-serif,system-ui,-apple-system,sans-serif'};
const shell={maxWidth:1100,margin:'0 auto',padding:'20px clamp(16px,4vw,34px) 50px'};
const nav={display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap'};
const brand={color:'#f5f8f1',textDecoration:'none',fontWeight:950,letterSpacing:'-.035em',fontSize:20};
const navLink={color:'#b9c3b3',textDecoration:'none',fontSize:12,fontWeight:800,padding:'8px 10px'};
const pill={border:'1px solid #354030',borderRadius:999,padding:'8px 11px',fontSize:10,fontWeight:900,letterSpacing:'.09em',color:'#b8ff55'};
const heroCard={maxWidth:760,margin:'90px auto',padding:30,border:'1px solid #283126',borderRadius:28,background:'#0d120d'};
const h1={fontSize:'clamp(3.2rem,8vw,6.8rem)',lineHeight:.88,letterSpacing:'-.07em',margin:'14px 0 22px'};
const h2={fontSize:28,lineHeight:1.05,letterSpacing:'-.04em',margin:'8px 0 12px'};
const eyebrow={fontSize:10,fontWeight:900,letterSpacing:'.14em',color:'#8d9a87'};
const copy={fontSize:13,lineHeight:1.65,color:'#aab4a4',maxWidth:780};
const grid={display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(230px,1fr))',gap:12};
const card={border:'1px solid #283126',background:'#0d120d',borderRadius:22,padding:20};
const nextBox={display:'flex',alignItems:'center',justifyContent:'space-between',gap:16,flexWrap:'wrap',border:'1px solid #526b3c',background:'#10170d',borderRadius:20,padding:'18px 20px',marginBottom:16};
const nextEyebrow={fontSize:10,fontWeight:950,letterSpacing:'.14em',color:'#b8ff55'};
const nextTitle={fontSize:'clamp(18px,3vw,25px)',lineHeight:1.12,letterSpacing:'-.035em',fontWeight:950,marginTop:5,maxWidth:760};
const primaryButton={border:0,background:'#b8ff55',color:'#0b1109',borderRadius:13,padding:'11px 14px',fontWeight:950,fontSize:12,cursor:'pointer'};
const primaryLink={display:'inline-block',background:'#b8ff55',color:'#0b1109',textDecoration:'none',borderRadius:13,padding:'11px 14px',fontWeight:950,fontSize:12};
const secondaryButton={border:'1px solid #354030',background:'#0b100b',color:'#d5ddd0',borderRadius:13,padding:'10px 12px',fontWeight:850,fontSize:11,cursor:'pointer'};
const code={whiteSpace:'pre-wrap',overflowWrap:'anywhere',background:'#080c08',border:'1px solid #222b21',borderRadius:14,padding:14,color:'#cbd7c4',fontSize:11,lineHeight:1.65};
const errorBox={border:'1px solid #6a403a',background:'#170d0c',color:'#f3bdb2',borderRadius:14,padding:13,marginBottom:14,fontSize:12};
const center={minHeight:'100vh',display:'grid',placeItems:'center',color:'#9ba897'};
