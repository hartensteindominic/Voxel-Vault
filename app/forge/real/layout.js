'use client';

import {useEffect,useState} from 'react';
import {loadAlternateHostVoxels} from '../../../lib/voxelpop-cross-host';
import {getSupabaseBrowserAsync} from '../../../lib/supabase-browser';
import {mergeVoxelRecords,readLocalVoxelRecords,syncLocalVoxelsToAccount} from '../../../lib/voxelpop-account';

function writeRecords(records){
  for(const record of records){
    try{localStorage.setItem(`voxelpop:${record.sessionId}`,JSON.stringify(record.payload))}catch{}
  }
}

function focusedSessionId(){
  try{return String(new URLSearchParams(window.location.search).get('focus_session')||'').trim()}catch{return ''}
}

export default function RealForgeLayout({children}){
  const [ready,setReady]=useState(false);
  const [signedIn,setSignedIn]=useState(null);
  const [accountBusy,setAccountBusy]=useState(false);
  const [accountMessage,setAccountMessage]=useState('');

  useEffect(()=>{
    let active=true;
    async function sync(){
      let current=readLocalVoxelRecords();
      const focusSession=focusedSessionId();

      // Critical cross-browser handoff: when MetaMask opens its own browser,
      // Safari/ChatGPT localStorage does not come with it. The focus_session URL
      // identifies the already-paid creation, so restore that one from Stripe +
      // Meshy before loading the rest of My Voxels. This is read-only.
      if(focusSession){
        try{
          const response=await fetch(`/api/forge/session-asset?${new URLSearchParams({sessionId:focusSession})}`,{cache:'no-store'});
          const recovered=await response.json().catch(()=>({}));
          if(response.ok&&recovered?.record?.sessionId){
            current=mergeVoxelRecords(current,[recovered.record]);
            writeRecords(current);
            if(active)setAccountMessage(recovered.ready
              ?'Recovered the exact paid 3D voxel you sent to Forge.'
              :'Recovered the paid voxel, but its 3D mesh is not finished yet.');
          }else if(active){
            setAccountMessage(String(recovered.error||'Could not restore the focused paid voxel.'));
          }
        }catch(error){
          if(active)setAccountMessage(error instanceof Error?error.message:'Could not restore the focused paid voxel.');
        }
      }

      try{
        const alternate=await loadAlternateHostVoxels();
        if(alternate.length)current=mergeVoxelRecords(current,alternate);
      }catch{}

      try{
        const supabase=await getSupabaseBrowserAsync();
        const {data}=await supabase.auth.getSession();
        const session=data.session;
        if(active)setSignedIn(Boolean(session?.user));
        if(session?.user&&session.access_token){
          const response=await fetch('/api/forge/account-assets',{cache:'no-store',headers:{Authorization:`Bearer ${session.access_token}`}});
          const recovered=await response.json().catch(()=>({}));
          if(response.ok&&Array.isArray(recovered.records)){
            current=mergeVoxelRecords(current,recovered.records);
            writeRecords(current);
            try{await syncLocalVoxelsToAccount(supabase,session.user)}catch{}
            if(active&&recovered.records.length&&!focusSession)setAccountMessage(`Recovered ${recovered.records.length} paid VoxelPop creation${recovered.records.length===1?'':'s'} from your account.`);
          }else if(active&&response.status!==401&&!focusSession){
            setAccountMessage(String(recovered.error||''));
          }
        }
      }catch{
        if(active)setSignedIn(false);
      }

      writeRecords(current);
      if(active)setReady(true);
    }
    sync();
    return()=>{active=false};
  },[]);

  async function recoverWithGoogle(){
    setAccountBusy(true);setAccountMessage('Opening Google sign-in…');
    try{
      const supabase=await getSupabaseBrowserAsync();
      const redirectTo=new URL(window.location.href);
      redirectTo.hash='';
      const {error}=await supabase.auth.signInWithOAuth({provider:'google',options:{redirectTo:redirectTo.toString()}});
      if(error)throw error;
    }catch(error){
      setAccountMessage(error instanceof Error?error.message:'Could not start Google recovery.');
      setAccountBusy(false);
    }
  }

  if(!ready){
    return <main style={{minHeight:'100vh',background:'#070809',color:'#f7f7f3',display:'grid',placeItems:'center',fontFamily:'Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',padding:24}}>
      <div style={{textAlign:'center',maxWidth:460}}>
        <div style={{color:'#c8ff54',fontSize:11,fontWeight:900,letterSpacing:'.14em'}}>MY VOXELS</div>
        <h1 style={{fontSize:34,margin:'12px 0 8px'}}>Recovering your full library…</h1>
        <p style={{color:'#8d8f98',fontSize:13,lineHeight:1.6,margin:0}}>Checking the focused paid voxel, browser storage, the other VoxelVault hostname, and your Google-backed library.</p>
      </div>
    </main>;
  }

  return <>
    {signedIn===false&&<div style={{position:'relative',zIndex:30,background:'#111318',borderBottom:'1px solid rgba(255,255,255,.10)',color:'#f7f7f3',padding:'12px 18px',display:'flex',alignItems:'center',justifyContent:'center',gap:14,flexWrap:'wrap',fontFamily:'Inter,ui-sans-serif,system-ui,sans-serif'}}>
      <span style={{fontSize:13,lineHeight:1.45}}><b style={{color:'#c8ff54'}}>Missing another paid 3D voxel?</b> Recover older creations with the Google account used for VoxelPop.</span>
      <button type="button" onClick={recoverWithGoogle} disabled={accountBusy} style={{border:0,borderRadius:999,padding:'9px 14px',background:'#c8ff54',color:'#0a0b0d',fontWeight:900,cursor:accountBusy?'wait':'pointer'}}>{accountBusy?'OPENING…':'RECOVER WITH GOOGLE'}</button>
    </div>}
    {accountMessage&&<div style={{position:'relative',zIndex:29,background:'#0d0f12',color:'#aeb4bd',textAlign:'center',padding:'8px 16px',font:'700 12px/1.4 Inter,ui-sans-serif,system-ui,sans-serif',borderBottom:'1px solid rgba(255,255,255,.06)'}}>{accountMessage}</div>}
    {children}
  </>;
}
