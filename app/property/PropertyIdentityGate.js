'use client';

import { useEffect, useState } from 'react';
import { getSupabaseBrowserAsync } from '../../lib/supabase-browser';

export default function PropertyIdentityGate({ children }) {
  const [authReady, setAuthReady] = useState(false);
  const [token, setToken] = useState('');
  const [selected, setSelected] = useState(false);
  const [address, setAddress] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Enter the property address. This is how Voxel Vault prevents duplicate purchases and mints.');

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
    setMessage('Checking the World building identity and one-of-one availability…');
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
      setMessage('Property verified. Only one Voxel Vault purchase and one NFT mint can exist for it.');
    } catch (error) {
      setMessage(String(error?.message || error || 'Property verification failed.'));
    } finally {
      setBusy(false);
    }
  }

  async function changeProperty() {
    if (token) await fetch('/api/property-identity', { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
    setSelected(false);
    setMessage('Enter the property address. This is how Voxel Vault prevents duplicate purchases and mints.');
  }

  if (!authReady || !token) return children;
  if (selected) return <>
    <div style={{maxWidth:680,margin:'10px auto 0',padding:'10px 12px',border:'1px solid #dce9c4',borderRadius:14,background:'#f8ffe9',fontFamily:'Inter,ui-rounded,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',textAlign:'center'}}>
      <b style={{display:'block',fontSize:10,letterSpacing:'.07em',color:'#52672b'}}>✓ ONE-OF-ONE PROPERTY LOCK</b>
      <span style={{display:'block',marginTop:4,fontSize:11,color:'#667057'}}>{address}</span>
      <button type="button" onClick={changeProperty} style={{marginTop:6,border:0,background:'transparent',color:'#6b4ab0',fontWeight:800,textDecoration:'underline',cursor:'pointer'}}>Change property</button>
    </div>
    {children}
  </>;

  return <main style={{minHeight:'100vh',padding:'32px 12px 100px',background:'#fffaf2',color:'#251912',fontFamily:'Inter,ui-rounded,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif'}}>
    <section style={{width:'min(620px,100%)',margin:'0 auto',textAlign:'center'}}>
      <div style={{width:'max-content',margin:'0 auto 18px',padding:'7px 11px',border:'1px solid #e5dde8',borderRadius:999,background:'#fff',color:'#7138f5',fontSize:9,fontWeight:1000,letterSpacing:'.12em'}}>VOXELPOP · ONE OF ONE</div>
      <h1 style={{margin:'0 0 10px',fontSize:'clamp(38px,8vw,56px)',lineHeight:.95,letterSpacing:'-.055em'}}>One property.<br/>One voxel.</h1>
      <p style={{maxWidth:500,margin:'0 auto 20px',color:'#786e67',fontSize:13,lineHeight:1.55}}>Verify the property before choosing its photo. Once purchased, that mapped property cannot be purchased or minted again by another account.</p>
      <form onSubmit={verify} style={{display:'grid',gap:10,padding:14,border:'1px solid #e1dce3',borderRadius:20,background:'#fff'}}>
        <input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Property address" autoComplete="street-address" style={{width:'100%',minHeight:56,border:'1.5px solid #ded8df',borderRadius:14,padding:'0 15px',font:'750 16px inherit',outline:'none',boxSizing:'border-box'}}/>
        <button type="submit" disabled={!address.trim() || busy} style={{minHeight:56,border:0,borderRadius:15,background:'#7138f5',color:'#fff',font:'900 16px inherit',boxShadow:'0 7px 0 #5120d0',opacity:!address.trim()||busy?.55:1}}>{busy ? 'Checking property…' : 'Verify property & continue'}</button>
      </form>
      <p role="status" style={{minHeight:20,margin:'12px auto',color:'#756d78',fontSize:10.5,fontWeight:700,lineHeight:1.45}}>{message}</p>
      <p style={{maxWidth:540,margin:'8px auto',color:'#918993',fontSize:9,lineHeight:1.5}}>The lock applies to the digital Voxel Vault collectible. It does not create or transfer deed, title, occupancy, rent, investment, or other rights in the physical property.</p>
    </section>
  </main>;
}
