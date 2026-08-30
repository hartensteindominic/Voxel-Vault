'use client';

import { useEffect, useMemo, useState } from 'react';

const panelStyle = {
  position: 'fixed',
  left: '18px',
  bottom: '18px',
  zIndex: 80,
  width: 'min(390px, calc(100vw - 36px))',
  padding: '16px',
  borderRadius: '18px',
  border: '1px solid rgba(113, 86, 255, 0.22)',
  background: 'rgba(255, 255, 255, 0.97)',
  boxShadow: '0 18px 50px rgba(44, 34, 96, 0.18)',
  color: '#26213d',
  fontFamily: 'inherit',
};

const buttonStyle = {
  width: '100%',
  marginTop: '10px',
  padding: '11px 14px',
  border: 0,
  borderRadius: '12px',
  background: '#6f55f5',
  color: '#fff',
  fontWeight: 800,
  cursor: 'pointer',
};

function authHeaders(accessToken, json = false) {
  const headers = { Authorization: `Bearer ${accessToken}` };
  if (json) headers['Content-Type'] = 'application/json';
  return headers;
}

export default function GalacticSandboxSetup({ accessToken = '' }) {
  const [authorized, setAuthorized] = useState(null);
  const [status, setStatus] = useState(null);
  const [programs, setPrograms] = useState([]);
  const [programId, setProgramId] = useState('');
  const [entityId, setEntityId] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const accountCount = Number(status?.counts?.accounts || 0);
  const connected = Boolean(status?.connected);
  const needsAccount = connected && accountCount === 0;
  const returnedFromOnboarding = Boolean(entityId);

  useEffect(() => {
    if (!accessToken) return;
    let active = true;

    const query = new URLSearchParams(window.location.search);
    const returnedEntity = String(query.get('entity_id') || '').trim();
    if (/^(sandbox_)?entity_[a-zA-Z0-9_-]+$/.test(returnedEntity)) setEntityId(returnedEntity);

    Promise.all([
      fetch('/api/admin/bank/increase/status', {
        cache: 'no-store',
        headers: authHeaders(accessToken),
      }),
      fetch('/api/admin/bank/increase/onboarding', {
        cache: 'no-store',
        headers: authHeaders(accessToken),
      }),
    ]).then(async ([statusResponse, onboardingResponse]) => {
      if (!active) return;
      if (statusResponse.status === 403 || onboardingResponse.status === 403) {
        setAuthorized(false);
        return;
      }
      const [statusPayload, onboardingPayload] = await Promise.all([
        statusResponse.json().catch(() => ({})),
        onboardingResponse.json().catch(() => ({})),
      ]);
      if (!active) return;
      setAuthorized(Boolean(statusPayload?.authorized && onboardingPayload?.authorized));
      setStatus(statusPayload);
      const nextPrograms = Array.isArray(onboardingPayload?.programs) ? onboardingPayload.programs : [];
      setPrograms(nextPrograms);
      if (nextPrograms.length === 1) setProgramId(nextPrograms[0].id);
    }).catch(() => {
      if (active) setAuthorized(false);
    });

    return () => { active = false; };
  }, [accessToken]);

  const heading = useMemo(() => {
    if (returnedFromOnboarding) return 'Finish Increase sandbox setup';
    if (!connected) return 'Increase sandbox setup';
    return 'Create your sandbox account';
  }, [connected, returnedFromOnboarding]);

  async function post(action, extra = {}) {
    const response = await fetch('/api/admin/bank/increase/onboarding', {
      method: 'POST',
      cache: 'no-store',
      headers: authHeaders(accessToken, true),
      body: JSON.stringify({ action, programId, ...extra }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.error || 'Increase sandbox setup failed.');
    return payload;
  }

  async function startOnboarding() {
    if (programs.length > 1 && !programId) {
      setMessage('Choose the Increase sandbox Program for this test Entity.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const payload = await post('create_session');
      const sessionUrl = String(payload?.session?.sessionUrl || '');
      if (!/^https:\/\/[a-z0-9.-]*increase\.com\//i.test(sessionUrl)) throw new Error('Increase did not return a safe hosted onboarding URL.');
      window.location.assign(sessionUrl);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not start Increase sandbox onboarding.');
      setBusy(false);
    }
  }

  async function completeSetup() {
    if (!entityId) return;
    setBusy(true);
    setMessage('');
    try {
      await post('complete_setup', { entityId });
      const cleanUrl = new URL('/bank', window.location.origin);
      window.location.replace(cleanUrl.toString());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not complete Increase sandbox setup.');
      setBusy(false);
    }
  }

  if (!accessToken || authorized !== true) return null;
  if (!returnedFromOnboarding && connected && accountCount > 0) return null;

  return (
    <aside style={panelStyle} aria-label="Owner Increase sandbox setup">
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        <span aria-hidden="true" style={{ fontSize: '24px' }}>🪐</span>
        <div>
          <strong style={{ display: 'block', fontSize: '15px' }}>{heading}</strong>
          <small style={{ display: 'block', marginTop: '2px', color: '#6a6482' }}>Owner-only · pretend money · production remains locked</small>
        </div>
      </div>

      {!connected && (
        <p style={{ margin: '12px 0 0', fontSize: '13px', lineHeight: 1.45, color: '#5f5875' }}>
          Add the server-only Increase sandbox key and enable switch in Vercel, then redeploy. Never put the key in client code or chat.
        </p>
      )}

      {needsAccount && !returnedFromOnboarding && (
        <>
          <p style={{ margin: '12px 0 0', fontSize: '13px', lineHeight: 1.45, color: '#5f5875' }}>
            Identity details are entered on Increase&apos;s hosted sandbox form, not inside Galactic Trust.
          </p>
          {programs.length > 1 && (
            <select
              value={programId}
              onChange={(event) => setProgramId(event.target.value)}
              aria-label="Increase sandbox Program"
              style={{ width: '100%', marginTop: '10px', padding: '10px', borderRadius: '10px', border: '1px solid #ded9f5', background: '#fff' }}
            >
              <option value="">Choose a sandbox Program</option>
              {programs.map((program) => <option key={program.id} value={program.id}>{program.name}</option>)}
            </select>
          )}
          <button type="button" onClick={startOnboarding} disabled={busy} style={{ ...buttonStyle, opacity: busy ? 0.65 : 1 }}>
            {busy ? 'Opening Increase…' : 'Start hosted sandbox onboarding'}
          </button>
        </>
      )}

      {returnedFromOnboarding && (
        <>
          <p style={{ margin: '12px 0 0', fontSize: '13px', lineHeight: 1.45, color: '#5f5875' }}>
            Increase returned a test Entity. Completing setup will simulate a successful sandbox validation, then create or reuse a sandbox Account and Account Number. This is not real KYC approval.
          </p>
          {programs.length > 1 && (
            <select
              value={programId}
              onChange={(event) => setProgramId(event.target.value)}
              aria-label="Increase sandbox Program"
              style={{ width: '100%', marginTop: '10px', padding: '10px', borderRadius: '10px', border: '1px solid #ded9f5', background: '#fff' }}
            >
              <option value="">Choose a sandbox Program</option>
              {programs.map((program) => <option key={program.id} value={program.id}>{program.name}</option>)}
            </select>
          )}
          <button type="button" onClick={completeSetup} disabled={busy || (programs.length > 1 && !programId)} style={{ ...buttonStyle, opacity: busy ? 0.65 : 1 }}>
            {busy ? 'Creating sandbox account…' : 'Complete sandbox setup'}
          </button>
        </>
      )}

      {message && <p role="status" style={{ margin: '10px 0 0', fontSize: '12px', lineHeight: 1.4, color: '#9d2d55' }}>{message}</p>}
    </aside>
  );
}
