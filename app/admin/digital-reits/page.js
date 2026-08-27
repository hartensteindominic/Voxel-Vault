'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getSupabaseBrowserAsync } from '../../../lib/supabase-browser';

const ENTITY_STORAGE_KEY = 'voxelvault.dinari.sandbox.entityId';
const KYC_POLL_MS = 15000;
const AUTH_TIMEOUT_MS = 10000;
const API_TIMEOUT_MS = 12000;

function short(value) {
  const text = String(value || '');
  return text.length > 18 ? `${text.slice(0, 8)}…${text.slice(-6)}` : text || '—';
}

async function readJson(response) {
  return response.json().catch(() => ({}));
}

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
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('Voxel Vault timed out waiting for the owner API. Retry once; if it repeats, the server or Dinari request is still pending.');
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export default function DinariAdminOnboardingPage() {
  const [token, setToken] = useState('');
  const [authState, setAuthState] = useState('loading');
  const [state, setState] = useState(null);
  const [entityName, setEntityName] = useState('Voxel Vault Sandbox Owner');
  const [referenceId, setReferenceId] = useState('voxel-vault-owner-sandbox');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const step2Ref = useRef(null);
  const step3Ref = useRef(null);
  const step4Ref = useRef(null);
  const finalRef = useRef(null);

  const selectedEntityId = state?.entity?.id || state?.configuredEntityId || '';
  const kycStatus = String(state?.kyc?.status || 'NOT_STARTED').trim().toUpperCase();
  const kycPending = kycStatus === 'PENDING' || kycStatus === 'NEEDS_REVIEW';
  const usAccount = useMemo(
    () => (state?.accounts || []).find((account) => account.isActive && account.jurisdiction === 'US') || null,
    [state?.accounts]
  );

  const load = useCallback(async (accessToken, explicitEntityId = '') => {
    if (!accessToken) return;
    setBusy('refresh');
    setError('');
    try {
      const stored = explicitEntityId || (typeof window !== 'undefined' ? localStorage.getItem(ENTITY_STORAGE_KEY) || '' : '');
      const query = stored ? `?entityId=${encodeURIComponent(stored)}` : '';
      const response = await fetchWithTimeout(`/api/admin/digital-reits/onboarding${query}`, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error || 'Dinari onboarding could not be loaded.');
      setState(data);
      if (data.entity?.id) localStorage.setItem(ENTITY_STORAGE_KEY, data.entity.id);
      setAuthState('authorized');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Dinari onboarding could not be loaded.');
    } finally {
      setBusy('');
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
          'Voxel Vault account setup took too long to load. Retry the owner page.'
        );
        const { data } = await withTimeout(
          client.auth.getSession(),
          AUTH_TIMEOUT_MS,
          'Your Google session check timed out. This can happen when the mobile browser auth lock stalls; retry the owner page.'
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
            setState(null);
          }
        });
        subscription = result?.data?.subscription;
      } catch (err) {
        if (!cancelled) {
          setAuthState('auth-error');
          setError(err instanceof Error ? err.message : 'Google account state could not be loaded.');
        }
      }
    })();
    return () => {
      cancelled = true;
      subscription?.unsubscribe?.();
    };
  }, [load]);

  useEffect(() => {
    if (!token || !selectedEntityId || !kycPending) return undefined;
    let cancelled = false;

    async function pollKyc() {
      try {
        const response = await fetchWithTimeout(`/api/admin/digital-reits/onboarding?entityId=${encodeURIComponent(selectedEntityId)}`, {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await readJson(response);
        if (!response.ok) throw new Error(data.error || 'Dinari KYC status could not be refreshed.');
        if (!cancelled) {
          setState(data);
          if (data.entity?.id) localStorage.setItem(ENTITY_STORAGE_KEY, data.entity.id);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Dinari KYC status could not be refreshed.');
      }
    }

    const timer = window.setInterval(pollKyc, KYC_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [token, selectedEntityId, kycPending]);

  async function action(actionName, payload = {}) {
    if (!token || busy) return null;
    setBusy(actionName);
    setError('');
    setNotice('');
    try {
      const response = await fetchWithTimeout('/api/admin/digital-reits/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: actionName, ...payload }),
      });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error || 'Dinari onboarding action failed.');
      if (data.snapshot) setState(data.snapshot);
      if (data.entity?.id) {
        localStorage.setItem(ENTITY_STORAGE_KEY, data.entity.id);
        setNotice(`Sandbox Entity created: ${data.entity.id}. Next: open Dinari KYC once.`);
        setTimeout(() => step3Ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 120);
      }
      if (data.account?.id) {
        setNotice(`${data.created ? 'Created' : 'Reused'} US sandbox Account: ${data.account.id}.`);
        setTimeout(() => finalRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 120);
      }
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Dinari onboarding action failed.');
      return null;
    } finally {
      setBusy('');
    }
  }

  async function createEntity() {
    const accepted = window.confirm('Create this INDIVIDUAL Entity in the Dinari SANDBOX? This does not create a live brokerage account or spend real money.');
    if (!accepted) return;
    await action('create-entity', { name: entityName, referenceId });
  }

  async function startKyc() {
    if (!selectedEntityId) return;
    if (kycPending) {
      setNotice('KYC is already submitted to Dinari. Do not start another KYC session while the current check is PENDING. This page is checking automatically.');
      return;
    }
    const popup = window.open('', '_blank');
    const result = await action('create-managed-kyc', { entityId: selectedEntityId, jurisdiction: 'US' });
    if (result?.kyc?.embedUrl) {
      if (popup) popup.location.href = result.kyc.embedUrl;
      else window.location.href = result.kyc.embedUrl;
      setNotice(`Dinari hosted KYC opened. URL expires ${result.kyc.expirationDt || 'later'}. Complete it once, then return here; status will refresh automatically.`);
    } else if (popup) {
      popup.close();
    }
  }

  async function createAccount() {
    if (!selectedEntityId) return;
    const accepted = window.confirm('Create or reuse a US Account for this PASSed Dinari SANDBOX Entity? Test environment only.');
    if (!accepted) return;
    await action('create-account', { entityId: selectedEntityId, jurisdiction: 'US' });
  }

  function copy(value) {
    navigator.clipboard?.writeText(String(value || '')).then(() => setNotice('Copied.'));
  }

  function scrollTo(ref) {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  if (authState === 'loading') {
    return <main style={page}><div style={center}>Checking owner session…</div></main>;
  }

  if (authState === 'auth-error') {
    return <main style={page}><div style={shell}>
      <nav style={nav}><Link href="/" style={brand}>V · Voxel Vault</Link><span style={pill}>OWNER ONLY</span></nav>
      <section style={heroCard}>
        <div style={eyebrow}>OWNER SESSION RECOVERY</div>
        <h1 style={h1}>Session check<br/>stalled.</h1>
        <p style={copyText}>{error || 'The owner session could not be loaded.'}</p>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          <button style={primaryButton} onClick={() => window.location.reload()}>Retry owner session</button>
          <Link href="/studio#my-voxels" style={secondaryLink}>Open Studio sign-in</Link>
        </div>
      </section>
    </div></main>;
  }

  if (authState === 'signed-out') {
    return <main style={page}><div style={shell}>
      <nav style={nav}><Link href="/" style={brand}>V · Voxel Vault</Link><span style={pill}>OWNER ONLY</span></nav>
      <section style={heroCard}>
        <div style={eyebrow}>DINARI SANDBOX ONBOARDING</div>
        <h1 style={h1}>Google sign-in<br/>required.</h1>
        <p style={copyText}>This page uses your existing Voxel Vault Google session and a server-side owner allowlist. API secrets never enter the browser.</p>
        <Link href="/studio#my-voxels" style={primary}>Open Studio and sign in →</Link>
        {error ? <div style={errorBox}>{error}</div> : null}
      </section>
    </div></main>;
  }

  const providerErrors = Array.isArray(state?.errors) ? state.errors.map((item) => String(item || '')).filter(Boolean) : [];
  const credentialProbeFailed = providerErrors.some((item) => /^credentials:/i.test(item));
  const credentialsOkay = Boolean(state?.credentialsConfigured && !credentialProbeFailed);
  const kycPass = kycStatus === 'PASS' && state?.entity?.isKycComplete;
  const kycCanStart = Boolean(selectedEntityId && !kycPass && !kycPending);
  const nextStep = !credentialsOkay
    ? null
    : !selectedEntityId
      ? { label: 'Credentials verified — continue to Step 2', detail: 'Create your Dinari sandbox customer Entity. This is still test-only and does not move real money.', ref: step2Ref }
      : kycPending
        ? { label: `KYC submitted — ${kycStatus}`, detail: 'Do not redo KYC. Dinari is still reporting the submitted check as pending. Voxel Vault will re-check it automatically every 15 seconds.', ref: step3Ref }
        : !kycPass
          ? { label: 'Entity ready — continue to Step 3', detail: 'Open Dinari’s hosted KYC once, complete verification there, then return here. The page will monitor the result.', ref: step3Ref }
          : !usAccount
            ? { label: 'KYC passed — continue to Step 4', detail: 'Create or reuse your US sandbox Account so the Digital REIT Vault has a provider account to read.', ref: step4Ref }
            : { label: 'Sandbox account ready — finish setup', detail: 'Copy the non-secret Entity and Account IDs into Vercel, then verify read-only portfolio data before enabling mock funding.', ref: finalRef };

  return <main style={page}><div style={shell}>
    <nav style={nav}>
      <Link href="/" style={brand}>V · Voxel Vault</Link>
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
        <Link href="/real-estate/reits" style={navLink}>Digital REIT Vault</Link>
        <span style={pill}>OWNER · PRIVATE</span>
      </div>
    </nav>

    <header style={{padding:'48px 0 24px'}}>
      <div style={eyebrow}>DINARI · SANDBOX ACTIVATION</div>
      <h1 style={h1}>Secret created.<br/><span style={{color:'#b8ff55'}}>Now connect the rails.</span></h1>
      <p style={copyText}>This wizard verifies your server-side credentials, creates the sandbox customer Entity, opens Dinari's hosted US KYC, then creates/reuses the US sandbox Account. Voxel Vault never asks you to paste the API secret, SSN, tax ID or identity documents into this page.</p>
    </header>

    {error ? <div style={errorBox}>{error}</div> : null}
    {notice ? <div style={noticeBox}>{notice}</div> : null}
    {providerErrors.length ? <div style={errorBox}>{providerErrors.join(' · ')}</div> : null}
    {nextStep ? <section style={nextActionBox}>
      <div>
        <div style={nextActionEyebrow}>NEXT ACTION</div>
        <div style={nextActionTitle}>{nextStep.label}</div>
        <p style={{...copyText,margin:'6px 0 0'}}>{nextStep.detail}</p>
      </div>
      <button style={continueButton} onClick={() => scrollTo(nextStep.ref)}>Continue →</button>
    </section> : null}

    <section style={grid}>
      <article style={card}>
        <span style={step}>1</span><div style={eyebrow}>SERVER CREDENTIALS</div>
        <h2 style={h2}>{credentialsOkay ? 'Credentials accepted.' : 'Put the secret in Vercel.'}</h2>
        <p style={copyText}>{credentialsOkay
          ? state?.organization?.connected
            ? `Connected to Dinari ${String(state?.environment || '').toUpperCase()} as organization ${short(state?.organization?.id)}.`
            : `Dinari ${String(state?.environment || '').toUpperCase()} credentials are configured and no authentication error was returned. Organization metadata is not required to create a sandbox Entity.`
          : 'Add the Key ID and Secret Key to the Vercel environment serving this page. Do not use NEXT_PUBLIC_ names.'}</p>
        {!credentialsOkay ? <pre style={code}>{`DINARI_ENVIRONMENT=sandbox\nDINARI_API_KEY_ID=<your key id>\nDINARI_API_SECRET_KEY=<your secret>`}</pre> : null}
        <button style={secondary} disabled={Boolean(busy)} onClick={() => load(token)}>{busy === 'refresh' ? 'Checking…' : 'Check credentials'}</button>
      </article>

      <article ref={step2Ref} style={{...card,opacity:credentialsOkay?1:.45}}>
        <span style={step}>2</span><div style={eyebrow}>CUSTOMER ENTITY</div>
        <h2 style={h2}>{state?.entity?.id ? 'Sandbox Entity ready.' : 'Create your sandbox Entity.'}</h2>
        {state?.entity?.id ? <>
          <p style={copyText}>Entity <b style={{color:'#fff'}}>{short(state.entity.id)}</b> · KYC complete: {String(state.entity.isKycComplete)}</p>
          <button style={secondary} onClick={() => copy(state.entity.id)}>Copy Entity ID</button>
        </> : <>
          <label style={label}>Entity name<input style={input} value={entityName} onChange={(event) => setEntityName(event.target.value)} disabled={!credentialsOkay || Boolean(busy)}/></label>
          <label style={label}>Reference ID<input style={input} value={referenceId} onChange={(event) => setReferenceId(event.target.value)} disabled={!credentialsOkay || Boolean(busy)}/></label>
          <button style={primaryButton} disabled={!credentialsOkay || Boolean(busy)} onClick={createEntity}>{busy === 'create-entity' ? 'Creating…' : 'Create sandbox Entity'}</button>
        </>}
      </article>

      <article ref={step3Ref} style={{...card,opacity:selectedEntityId?1:.45}}>
        <span style={step}>3</span><div style={eyebrow}>DINARI HOSTED KYC</div>
        <h2 style={h2}>{kycPass ? 'KYC passed.' : kycPending ? `KYC submitted — ${kycStatus}.` : `KYC: ${kycStatus}`}</h2>
        <p style={copyText}>{kycPending
          ? 'You already completed the hosted identity flow. Do not submit another KYC session. Dinari is still processing or reviewing the latest check, and Voxel Vault is polling for the result automatically.'
          : 'Dinari hosts the sensitive identity flow. Voxel Vault receives only the status needed to continue.'}</p>
        {kycPending ? <div style={pendingBox}>
          <b>Waiting on Dinari.</b> Auto-checking every 15 seconds. Latest check: {short(state?.kyc?.id)}{state?.kyc?.checkedDt ? ` · ${state.kyc.checkedDt}` : ''}.
        </div> : null}
        {kycCanStart ? <button style={primaryButton} disabled={Boolean(busy)} onClick={startKyc}>{busy === 'create-managed-kyc' ? 'Creating URL…' : kycStatus === 'NOT_STARTED' ? 'Open secure Dinari KYC' : 'Retry secure Dinari KYC'}</button> : null}
        <button style={{...secondary,marginLeft:kycCanStart?8:0}} disabled={!selectedEntityId || Boolean(busy)} onClick={() => load(token, selectedEntityId)}>{kycPending ? 'Check now' : 'Refresh KYC status'}</button>
      </article>

      <article ref={step4Ref} style={{...card,opacity:kycPass?1:.45}}>
        <span style={step}>4</span><div style={eyebrow}>US SANDBOX ACCOUNT</div>
        <h2 style={h2}>{usAccount ? 'Account ready.' : 'Create the trading Account.'}</h2>
        <p style={copyText}>{usAccount ? `Active US account ${short(usAccount.id)} is ready to connect to the Digital REIT Vault.` : kycPending ? 'Dinari still reports KYC as pending. Account creation remains safely blocked until Dinari returns PASS.' : 'This stays blocked until Dinari reports KYC PASS.'}</p>
        {usAccount ? <button style={secondary} onClick={() => copy(usAccount.id)}>Copy Account ID</button> : <button style={primaryButton} disabled={!kycPass || Boolean(busy)} onClick={createAccount}>{busy === 'create-account' ? 'Creating…' : 'Create US sandbox Account'}</button>}
      </article>
    </section>

    <section ref={finalRef} style={{...card,marginTop:16,borderColor:usAccount?'#526b3c':'#283126'}}>
      <div style={eyebrow}>FINAL VERCEL VALUES</div>
      <h2 style={h2}>Connect the created IDs, then run the $5 test.</h2>
      <pre style={code}>{`DINARI_ENTITY_ID=${selectedEntityId || '<waiting for entity>'}\nDINARI_ACCOUNT_ID=${usAccount?.id || '<waiting for account>'}\nDINARI_SANDBOX_FAUCET_ENABLED=false\nDINARI_SANDBOX_ORDER_EXECUTION_ENABLED=false`}</pre>
      <p style={copyText}>First verify `/api/digital-reits` reads correctly with both action flags false. Then enable only the faucet, add mock funds, enable sandbox ordering, and place the $5 test order. Production trading remains code-locked.</p>
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}><Link href="/real-estate/reits" style={primary}>Open Digital REIT Vault →</Link><button style={secondary} onClick={() => {localStorage.removeItem(ENTITY_STORAGE_KEY); setState(state ? {...state, entity:null, kyc:null, accounts:[]} : state);}}>Forget local Entity selection</button></div>
    </section>

    <footer style={{padding:'26px 0',color:'#71806d',fontSize:12}}>Owner-only setup · Dinari sandbox writes only · no live accounts, real-money orders or identity-document storage enabled here.</footer>
  </div></main>;
}

const page={minHeight:'100vh',background:'#070a08',color:'#f5f8f1',fontFamily:'Inter,ui-sans-serif,system-ui,-apple-system,sans-serif'};
const shell={maxWidth:1160,margin:'0 auto',padding:'20px clamp(16px,4vw,34px) 50px'};
const nav={display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap'};
const brand={color:'#f5f8f1',textDecoration:'none',fontWeight:950,letterSpacing:'-.035em',fontSize:20};
const navLink={color:'#b9c3b3',textDecoration:'none',fontSize:12,fontWeight:800,padding:'8px 10px'};
const pill={border:'1px solid #354030',borderRadius:999,padding:'8px 11px',fontSize:10,fontWeight:900,letterSpacing:'.09em',color:'#b8ff55'};
const heroCard={maxWidth:760,margin:'90px auto',padding:30,border:'1px solid #283126',borderRadius:28,background:'#0d120d'};
const h1={fontSize:'clamp(3.4rem,9vw,7.3rem)',lineHeight:.86,letterSpacing:'-.075em',margin:'14px 0 22px'};
const h2={fontSize:26,lineHeight:1.05,letterSpacing:'-.04em',margin:'8px 0 12px'};
const eyebrow={fontSize:10,fontWeight:900,letterSpacing:'.14em',color:'#8d9a87'};
const copyText={fontSize:13,lineHeight:1.65,color:'#aab4a4',maxWidth:780};
const grid={display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:12};
const card={position:'relative',border:'1px solid #283126',background:'#0d120d',borderRadius:24,padding:22};
const step={position:'absolute',top:16,right:16,width:28,height:28,borderRadius:999,display:'grid',placeItems:'center',background:'#151d13',color:'#b8ff55',fontSize:11,fontWeight:950};
const label={display:'grid',gap:6,fontSize:11,fontWeight:800,color:'#8d9a87',marginTop:10};
const input={width:'100%',boxSizing:'border-box',border:'1px solid #354030',borderRadius:12,background:'#080c08',color:'#f5f8f1',padding:'11px 12px',outline:'none'};
const primary={display:'inline-block',background:'#b8ff55',color:'#0b1109',textDecoration:'none',borderRadius:13,padding:'11px 14px',fontWeight:950,fontSize:12};
const primaryButton={border:0,background:'#b8ff55',color:'#0b1109',borderRadius:13,padding:'11px 14px',fontWeight:950,fontSize:12,marginTop:14,cursor:'pointer'};
const secondary={border:'1px solid #354030',background:'#0b100b',color:'#d5ddd0',borderRadius:13,padding:'10px 12px',fontWeight:850,fontSize:11,cursor:'pointer',marginTop:10};
const secondaryLink={display:'inline-block',border:'1px solid #354030',background:'#0b100b',color:'#d5ddd0',textDecoration:'none',borderRadius:13,padding:'10px 12px',fontWeight:850,fontSize:11,marginTop:14};
const code={whiteSpace:'pre-wrap',overflowWrap:'anywhere',background:'#080c08',border:'1px solid #222b21',borderRadius:14,padding:14,color:'#cbd7c4',fontSize:11,lineHeight:1.65};
const errorBox={border:'1px solid #6a403a',background:'#170d0c',color:'#f3bdb2',borderRadius:14,padding:13,marginBottom:14,fontSize:12};
const noticeBox={border:'1px solid #526b3c',background:'#0f170c',color:'#d8f3b8',borderRadius:14,padding:13,marginBottom:14,fontSize:12};
const pendingBox={border:'1px solid #5f6237',background:'#17170c',color:'#e8e7b0',borderRadius:14,padding:12,marginTop:12,fontSize:12,lineHeight:1.55};
const nextActionBox={display:'flex',alignItems:'center',justifyContent:'space-between',gap:16,flexWrap:'wrap',border:'1px solid #526b3c',background:'#10170d',borderRadius:20,padding:'18px 20px',marginBottom:16};
const nextActionEyebrow={fontSize:10,fontWeight:950,letterSpacing:'.14em',color:'#b8ff55'};
const nextActionTitle={fontSize:'clamp(20px,4vw,30px)',lineHeight:1.05,letterSpacing:'-.04em',fontWeight:950,marginTop:5};
const continueButton={border:0,background:'#b8ff55',color:'#0b1109',borderRadius:14,padding:'12px 16px',fontWeight:950,fontSize:12,cursor:'pointer'};
const center={minHeight:'100vh',display:'grid',placeItems:'center',color:'#9ba897'};