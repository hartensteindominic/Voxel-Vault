'use client';

import { useEffect, useMemo, useState } from 'react';

const panelStyle = {
  width: 'min(440px, calc(100vw - 36px))',
  padding: '18px',
  borderRadius: '20px',
  border: '1px solid rgba(113, 86, 255, 0.22)',
  background: 'rgba(255, 255, 255, 0.98)',
  boxShadow: '0 22px 70px rgba(44, 34, 96, 0.22)',
  color: '#26213d',
  fontFamily: 'inherit',
};

const floatingPanelStyle = {
  position: 'fixed',
  left: '18px',
  bottom: '18px',
  zIndex: 80,
};

const blockingLayerStyle = {
  position: 'fixed',
  inset: 0,
  zIndex: 120,
  display: 'grid',
  placeItems: 'center',
  padding: '18px',
  background: 'rgba(21, 16, 45, 0.66)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
};

const buttonStyle = {
  width: '100%',
  marginTop: '12px',
  padding: '12px 14px',
  border: 0,
  borderRadius: '12px',
  background: '#6f55f5',
  color: '#fff',
  fontWeight: 800,
  cursor: 'pointer',
};

const stepStyle = {
  display: 'grid',
  gridTemplateColumns: '30px 1fr',
  gap: '10px',
  alignItems: 'start',
  padding: '9px 0',
};

const healthLinkStyle = {
  display: 'block',
  marginTop: '12px',
  padding: '10px 12px',
  borderRadius: '12px',
  border: '1px solid #ded8fb',
  background: '#faf9ff',
  color: '#5e46d8',
  textAlign: 'center',
  textDecoration: 'none',
  fontSize: '12px',
  fontWeight: 800,
};

function authHeaders(accessToken, json = false) {
  const headers = { Authorization: `Bearer ${accessToken}` };
  if (json) headers['Content-Type'] = 'application/json';
  return headers;
}

function safeHostedSessionUrl(value) {
  const url = new URL(String(value || ''));
  if (url.protocol !== 'https:' || !(url.hostname === 'increase.com' || url.hostname.endsWith('.increase.com'))) {
    throw new Error('Increase did not return a safe hosted onboarding URL.');
  }
  return url.toString();
}

function SetupStep({ number, title, detail, state = 'pending' }) {
  const marker = state === 'complete' ? '✓' : number;
  const background = state === 'complete' ? '#eafaf2' : state === 'active' ? '#f1edff' : '#f5f3f9';
  const color = state === 'complete' ? '#177245' : state === 'active' ? '#5e46d8' : '#817a96';
  return (
    <div style={stepStyle}>
      <span style={{ width: '30px', height: '30px', borderRadius: '999px', display: 'grid', placeItems: 'center', background, color, fontWeight: 900 }}>{marker}</span>
      <span><b style={{ display: 'block', fontSize: '13px' }}>{title}</b><small style={{ display: 'block', marginTop: '2px', color: '#6a6482', lineHeight: 1.4 }}>{detail}</small></span>
    </div>
  );
}

export default function GalacticSandboxSetup({ accessToken = '' }) {
  const [authorized, setAuthorized] = useState(null);
  const [status, setStatus] = useState(null);
  const [binding, setBinding] = useState(null);
  const [bindingSetupRequired, setBindingSetupRequired] = useState(false);
  const [bindingError, setBindingError] = useState('');
  const [programs, setPrograms] = useState([]);
  const [programId, setProgramId] = useState('');
  const [entityId, setEntityId] = useState('');
  const [onboardingRequestOk, setOnboardingRequestOk] = useState(true);
  const [providerMessage, setProviderMessage] = useState('');
  const [providerNextStep, setProviderNextStep] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const accountCount = Number(status?.counts?.accounts || 0);
  const connected = Boolean(status?.connected);
  const bindingReady = Boolean(binding?.provider === 'increase' && binding?.environment === 'sandbox' && binding?.status === 'verified');
  const needsAccount = connected && accountCount === 0;
  const needsBindingStorage = connected && bindingSetupRequired;
  const needsBinding = connected && accountCount > 0 && !bindingReady && !needsBindingStorage;
  const returnedFromOnboarding = Boolean(entityId);
  const blockingSetup = returnedFromOnboarding || needsAccount || needsBinding || needsBindingStorage;
  const programsCapabilityReady = status?.capabilities?.programs?.available !== false;
  const entitiesCapabilityReady = status?.capabilities?.entities?.available !== false;
  const onboardingReady = Boolean(connected && onboardingRequestOk && programsCapabilityReady && entitiesCapabilityReady && programs.length > 0);
  const onboardingNeeded = returnedFromOnboarding || needsAccount || needsBinding;
  const onboardingBlocked = Boolean(onboardingNeeded && connected && !needsBindingStorage && !onboardingReady);
  const actionableNextStep = providerNextStep || (
    !programsCapabilityReady || !entitiesCapabilityReady
      ? 'Use an Increase sandbox API key with Programs and Entities access before owner onboarding.'
      : programs.length === 0
        ? 'Make at least one Increase sandbox Program available to the configured sandbox key.'
        : 'Verify the Increase sandbox key and owner-onboarding permissions, then refresh this page.'
  );

  useEffect(() => {
    if (!accessToken) return;
    let active = true;

    const query = new URLSearchParams(window.location.search);
    const returnedEntity = String(query.get('entity_id') || '').trim();
    const returnedProgram = String(query.get('increase_program_id') || '').trim();
    if (/^(sandbox_)?entity_[a-zA-Z0-9_-]+$/.test(returnedEntity)) setEntityId(returnedEntity);
    if (/^(sandbox_)?program_[a-zA-Z0-9_-]+$/.test(returnedProgram)) setProgramId(returnedProgram);

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
      setBinding(onboardingPayload?.binding || null);
      setBindingSetupRequired(Boolean(onboardingPayload?.bindingSetupRequired));
      setBindingError(String(onboardingPayload?.bindingError || ''));
      setOnboardingRequestOk(onboardingResponse.ok);
      setProviderMessage(String(onboardingPayload?.error || statusPayload?.error || ''));
      setProviderNextStep(String(onboardingPayload?.nextStep || statusPayload?.nextStep || ''));
      const nextPrograms = Array.isArray(onboardingPayload?.programs) ? onboardingPayload.programs : [];
      setPrograms(nextPrograms);
      if (nextPrograms.length === 1) setProgramId(nextPrograms[0].id);
    }).catch(() => {
      if (active) {
        setAuthorized(false);
        setOnboardingRequestOk(false);
      }
    });

    return () => { active = false; };
  }, [accessToken]);

  const heading = useMemo(() => {
    if (!connected) return 'Increase sandbox setup';
    if (needsBindingStorage) return 'Provider binding storage required';
    if (onboardingBlocked) return 'Increase sandbox permissions required';
    if (returnedFromOnboarding) return 'Finish Increase sandbox setup';
    if (needsBinding) return 'Sandbox account ownership setup required';
    return 'Sandbox connected — account setup required';
  }, [connected, needsBinding, needsBindingStorage, onboardingBlocked, returnedFromOnboarding]);

  async function post(action, extra = {}) {
    const response = await fetch('/api/admin/bank/increase/onboarding', {
      method: 'POST',
      cache: 'no-store',
      headers: authHeaders(accessToken, true),
      body: JSON.stringify({ action, programId, ...extra }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.nextStep || payload?.error || 'Increase sandbox setup failed.');
    return payload;
  }

  async function startOnboarding() {
    if (!onboardingReady) {
      setMessage(actionableNextStep);
      return;
    }
    if (programs.length > 1 && !programId) {
      setMessage('Choose the Increase sandbox Program for this test Entity.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const payload = await post('create_session');
      window.location.assign(safeHostedSessionUrl(payload?.session?.sessionUrl));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not start Increase sandbox onboarding.');
      setBusy(false);
    }
  }

  async function completeSetup() {
    if (!entityId) return;
    if (!onboardingReady) {
      setMessage(actionableNextStep);
      return;
    }
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
  if (!returnedFromOnboarding && connected && accountCount > 0 && bindingReady) return null;

  const canStartOwnerOnboarding = connected && onboardingReady && !returnedFromOnboarding && !needsBindingStorage && (needsAccount || needsBinding);
  const stepTwoTitle = onboardingBlocked
    ? 'Onboarding access required'
    : needsBinding
      ? 'Owner binding required'
      : needsBindingStorage
        ? 'Binding storage required'
        : 'Account setup required';
  const stepTwoDetail = onboardingBlocked
    ? actionableNextStep
    : returnedFromOnboarding
      ? 'A test Entity was returned. Complete the sandbox-only validation, Account bootstrap, and server-side owner binding.'
      : needsBinding
        ? 'Existing sandbox Accounts are not treated as yours. Complete owner-scoped hosted onboarding so Galactic Trust can bind exactly one provider Account to your signed-in user.'
        : needsBindingStorage
          ? (bindingError || 'Trusted provider binding storage must be installed before any provider Account can be treated as user-owned.')
          : 'Use Increase-hosted onboarding to create the test Entity before an Account is created.';

  const panel = (
    <aside style={{ ...panelStyle, ...(blockingSetup ? {} : floatingPanelStyle) }} aria-label="Owner Increase sandbox setup" aria-modal={blockingSetup ? 'true' : undefined} role={blockingSetup ? 'dialog' : undefined}>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        <span aria-hidden="true" style={{ fontSize: '26px' }}>🪐</span>
        <div>
          <strong style={{ display: 'block', fontSize: '16px' }}>{heading}</strong>
          <small style={{ display: 'block', marginTop: '2px', color: '#6a6482' }}>Owner-only · pretend money · production remains locked</small>
        </div>
      </div>

      {blockingSetup && (
        <div style={{ marginTop: '14px', padding: '12px 14px', borderRadius: '14px', background: '#fbfaff', border: '1px solid #ece8ff' }}>
          <SetupStep number="1" title="Increase sandbox connected" detail="The provider connection is active. No real money can move." state="complete" />
          <SetupStep number="2" title={stepTwoTitle} detail={stepTwoDetail} state="active" />
          <SetupStep number="3" title="Owner-scoped sandbox dashboard ready" detail="Provider balances and transfer controls stay blocked until a sandbox Account is bound server-side to your signed-in user." state="pending" />
        </div>
      )}

      {!connected && (
        <div style={{ marginTop: '12px', padding: '12px', borderRadius: '14px', background: '#fff8ee', border: '1px solid #f1dcc2' }}>
          <strong style={{ display: 'block', fontSize: '12px', color: '#80551e' }}>Increase sandbox connection needs attention.</strong>
          {providerMessage && <small style={{ display: 'block', marginTop: '5px', color: '#785f42', lineHeight: 1.45 }}>{providerMessage}</small>}
          <small style={{ display: 'block', marginTop: '5px', color: '#785f42', lineHeight: 1.45 }}>{providerNextStep || 'Add the server-only Increase sandbox key and enable switch in Vercel, then redeploy. Never put the key in client code or chat.'}</small>
        </div>
      )}

      {onboardingBlocked && (
        <div style={{ marginTop: '12px', padding: '12px', borderRadius: '14px', background: '#fff8ee', border: '1px solid #f1dcc2' }}>
          <strong style={{ display: 'block', fontSize: '12px', color: '#80551e' }}>Increase sandbox onboarding is blocked.</strong>
          {providerMessage && <small style={{ display: 'block', marginTop: '5px', color: '#785f42', lineHeight: 1.45 }}>{providerMessage}</small>}
          <small style={{ display: 'block', marginTop: '5px', color: '#785f42', lineHeight: 1.45 }}><b>Next step:</b> {actionableNextStep}</small>
        </div>
      )}

      {canStartOwnerOnboarding && (
        <>
          <p style={{ margin: '12px 0 0', fontSize: '13px', lineHeight: 1.45, color: '#5f5875' }}>
            Identity details are entered on Increase&apos;s hosted sandbox form, not inside Galactic Trust. Existing unbound provider Accounts are deliberately ignored so one user can never inherit another sandbox Account by accident.
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
          <button type="button" onClick={startOnboarding} disabled={busy || !onboardingReady} style={{ ...buttonStyle, opacity: busy || !onboardingReady ? 0.65 : 1 }}>
            {busy ? 'Opening Increase…' : needsBinding ? 'Start owner-scoped sandbox onboarding' : 'Start hosted sandbox onboarding'}
          </button>
        </>
      )}

      {returnedFromOnboarding && (
        <>
          <p style={{ margin: '12px 0 0', fontSize: '13px', lineHeight: 1.45, color: '#5f5875' }}>
            Increase returned a test Entity. Completing setup will simulate a successful sandbox validation, create or reuse a sandbox Account and Account Number, then bind that Account server-side to your signed-in user. This is not real KYC approval.
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
          <button type="button" onClick={completeSetup} disabled={busy || !onboardingReady || needsBindingStorage || (programs.length > 1 && !programId)} style={{ ...buttonStyle, opacity: busy || !onboardingReady || needsBindingStorage ? 0.65 : 1 }}>
            {busy ? 'Creating and binding sandbox account…' : onboardingBlocked ? 'Resolve onboarding access first' : 'Complete sandbox setup'}
          </button>
        </>
      )}

      {needsBindingStorage && bindingError && <p role="status" style={{ margin: '10px 0 0', fontSize: '12px', lineHeight: 1.4, color: '#9d2d55' }}>{bindingError}</p>}
      {message && <p role="status" style={{ margin: '10px 0 0', fontSize: '12px', lineHeight: 1.4, color: '#9d2d55' }}>{message}</p>}
      <a href="/bank/integrations" style={healthLinkStyle}>Open Integration Health →</a>
    </aside>
  );

  if (!blockingSetup) return panel;
  return <div style={blockingLayerStyle} aria-label="Increase sandbox setup required">{panel}</div>;
}
