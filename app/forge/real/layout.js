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

export default function RealForgeLayout({children}){
  const [ready,setReady]=useState(false);
  const [signedIn,setSignedIn]=useState(null);
  const [accountBusy,setAccountBusy]=useState(false);
  const [accountMessage,setAccountMessage]=useState('');

  useEffect(()=>{
    let active=true;
    async function sync(){
      let current=readLocalVoxelRecords();
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
            if(active&&recovered.records.length)setAccountMessage(`Recovered ${recovered.records.length} paid VoxelPop creation${recovered.records.length===1?'':'s'} from your account.`);
          }else if(active&&response.status!==401){
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
      const redirectTo=new URL('/forge/real',window.location.origin).toString();
      const {error}=await supabase.auth.signInWithOAuth({provider:'google',options:{redirectTo}});
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
        <p style={{color:'#8d8f98',fontSize:13,lineHeight:1.6,margin:0}}>Checking browser storage, your other VoxelVault hostname, and—when Google is connected—your paid VoxelPop server records.</p>
      </div>
    </main>;
  }

  return <>
    {signedIn===false&&<div style={{position:'relative',zIndex:30,background:'#111318',borderBottom:'1px solid rgba(255,255,255,.10)',color:'#f7f7f3',padding:'12px 18px',display:'flex',alignItems:'center',justifyContent:'center',gap:14,flexWrap:'wrap',fontFamily:'Inter,ui-sans-serif,system-ui,sans-serif'}}>
      <span style={{fontSize:13,lineHeight:1.45}}><b style={{color:'#c8ff54'}}>Missing a paid 3D voxel?</b> Recover creations saved in a different browser with the Google account used for VoxelPop.</span>
      <button type="button" onClick={recoverWithGoogle} disabled={accountBusy} style={{border:0,borderRadius:999,padding:'9px 14px',background:'#c8ff54',color:'#0a0b0d',fontWeight:900,cursor:accountBusy?'wait':'pointer'}}>{accountBusy?'OPENING…':'RECOVER WITH GOOGLE'}</button>
    </div>}
    {accountMessage&&<div style={{position:'relative',zIndex:29,background:'#0d0f12',color:'#aeb4bd',textAlign:'center',padding:'8px 16px',font: '700 12px/1.4 Inter,ui-sans-serif,system-ui,sans-serif',borderBottom:'1px solid rgba(255,255,255,.06)'}}>{accountMessage}</div>}
    {children}
  </>;
}
