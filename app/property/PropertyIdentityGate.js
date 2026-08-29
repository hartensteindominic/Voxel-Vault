'use client';

import { useEffect, useState } from 'react';
import { getSupabaseBrowserAsync } from '../../lib/supabase-browser';

export default function PropertyIdentityGate({ children }) {
  const [authReady, setAuthReady] = useState(false);
  const [token, setToken] = useState('');
  const [selected, setSelected] = useState(false);
  const [address, setAddress] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    let subscription = null;
    getSupabaseBrowserAsync().then(async (client) => {
      const { data } = await client.auth.getSession();
      if (!active) return;
      const accessToken = data.session?.access_token || '';
      setToken(accessToken);
      setAuthReady(true);
      if (accessToken) {
        fetch('/api/property-identity', { headers: { Authorization: `Bearer ${accessToken}` } })
          .then((response) => response.json())
          .then((result) => {
            if (!active || !result?.selected) return;
            setAddress(result.address || '');
            setSelected(true);
          }).catch(() => {});
      }
      const auth = client.auth.onAuthStateChange((_event, next) => {
        if (!active) return;
        setToken(next?.access_token || '');
        setAuthReady(true);
      });
      subscription = auth.data.subscription;
    }).catch(() => setAuthReady(true));
    return () => { active = false; subscription?.unsubscribe?.(); };
  }, []);

  async function verify(event) {
    event.preventDefault();
    if (!token || !address.trim() || busy) return;
    setBusy(true);
    setMessage('Checking property…');
    try {
      const response = await fetch('/api/property-identity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ address }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result?.available) throw new Error(result?.error || 'This property could not be verified.');
      setAddress(result.address || address);
      setSelected(true);
      setMessage('');
    } catch (error) {
      setMessage(String(error?.message || error || 'Property verification failed.'));
    } finally {
      setBusy(false);
    }
  }

  async function changeProperty() {
    if (token) await fetch('/api/property-identity', { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
    setSelected(false);
    setMessage('');
  }

  if (!authReady || !token) return children;

  return <>
    <section className="identityDock" aria-label="One-of-one property identity">
      {selected ? <div className="lockedRow">
        <div className="lockIcon">✓</div>
        <div className="lockCopy">
          <b>Property locked</b>
          <span>{address}</span>
        </div>
        <button type="button" onClick={changeProperty}>Change</button>
      </div> : <form className="lockForm" onSubmit={verify}>
        <div className="lockIntro">
          <span className="spark">◇</span>
          <div><b>Make it one-of-one</b><small>Add the property address before checkout.</small></div>
        </div>
        <div className="fieldRow">
          <input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Property address" autoComplete="street-address"/>
          <button type="submit" disabled={!address.trim() || busy}>{busy ? 'Checking…' : 'Lock'}</button>
        </div>
        {message ? <p role="status">{message}</p> : null}
      </form>}
    </section>
    {children}
    <style jsx>{`
      .identityDock{width:min(680px,calc(100% - 24px));margin:10px auto 0;font-family:Inter,ui-rounded,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;position:relative;z-index:8}
      .lockForm,.lockedRow{border:1px solid rgba(113,56,245,.14);border-radius:18px;background:rgba(255,255,255,.88);box-shadow:0 8px 26px rgba(70,45,95,.07);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px)}
      .lockForm{padding:10px}
      .lockIntro{display:flex;align-items:center;gap:9px;padding:1px 2px 9px;text-align:left}
      .spark{width:31px;height:31px;flex:0 0 31px;border-radius:10px;display:grid;place-items:center;background:linear-gradient(145deg,#7b45ff,#bf6cff);color:white;font-size:17px;font-weight:1000;box-shadow:0 5px 12px rgba(113,56,245,.18)}
      .lockIntro div{min-width:0;display:grid;gap:1px}
      .lockIntro b{font-size:11px;color:#2d2035;letter-spacing:-.01em}
      .lockIntro small{font-size:9px;color:#8b8290;line-height:1.35}
      .fieldRow{display:grid;grid-template-columns:minmax(0,1fr) 82px;gap:7px}
      input{width:100%;min-width:0;height:48px;border:1px solid #e3dce7;border-radius:13px;background:#fff;padding:0 13px;color:#2d2530;font:750 13px inherit;outline:none;box-sizing:border-box}
      input:focus{border-color:#9b80e8;box-shadow:0 0 0 4px rgba(113,56,245,.08)}
      .fieldRow button{height:48px;border:0;border-radius:13px;background:linear-gradient(180deg,#7c48ff,#6c35ef);color:#fff;font:900 12px inherit;box-shadow:0 5px 0 #5521d4;cursor:pointer}
      .fieldRow button:disabled{opacity:.45;box-shadow:none;cursor:default}
      .lockForm p{margin:8px 2px 1px;color:#a14e43;font-size:9px;font-weight:750;line-height:1.35;text-align:left}
      .lockedRow{display:flex;align-items:center;gap:9px;padding:8px 9px}
      .lockIcon{width:34px;height:34px;flex:0 0 34px;border-radius:11px;display:grid;place-items:center;background:#c9ff54;color:#3f5b15;font-size:15px;font-weight:1000}
      .lockCopy{min-width:0;flex:1;display:grid;gap:1px;text-align:left}
      .lockCopy b{font-size:10px;color:#3e5220;text-transform:uppercase;letter-spacing:.055em}
      .lockCopy span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#746b79;font-size:9.5px}
      .lockedRow button{border:0;background:transparent;color:#6c45ba;font:850 10px inherit;text-decoration:underline;text-underline-offset:3px;padding:8px;cursor:pointer}
      @media(max-width:520px){.identityDock{width:calc(100% - 16px);margin-top:6px}.lockForm{padding:9px}.lockIntro{padding-bottom:7px}.fieldRow{grid-template-columns:minmax(0,1fr) 72px}.fieldRow button,input{height:46px}.lockIntro small{font-size:8.5px}}
    `}</style>
  </>;
}
