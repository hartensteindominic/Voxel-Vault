'use client';

import {useEffect,useState} from 'react';
import {loadAlternateHostVoxels} from '../../../lib/voxelpop-cross-host';
import {getSupabaseBrowserAsync} from '../../../lib/supabase-browser';
import {mergeVoxelRecords,readLocalVoxelRecords,syncLocalVoxelsToAccount} from '../../../lib/voxelpop-account';
import ForgePassport from './ForgePassport';

function writeRecords(records){
  for(const record of records){
    try{localStorage.setItem(`voxelpop:${record.sessionId}`,JSON.stringify(record.payload))}catch{}
  }
}

function focusedSessionId(){
  try{return String(new URLSearchParams(window.location.search).get('focus_session')||'').trim()}catch{return ''}
}

function meshReady(payload){
  const mesh=payload?.mesh||{};
  const status=String(mesh.status||'').toLowerCase();
  return ['ready','succeeded','completed'].includes(status)||Boolean(String(mesh.modelUrl||'').trim())||Number(mesh.progress||0)>=100;
}

function usefulAsset(asset){
  const image=String(asset?.dataUrl||'');
  return Boolean(image&&!image.endsWith('/voxelpop/voxelpop-logo.png'));
}

function mergePaidRecovery(current,recovered){
  const map=new Map(current.map(record=>[record.sessionId,record]));
  for(const server of recovered||[]){
    if(!server?.sessionId||!server?.payload)continue;
    const existing=map.get(server.sessionId);
    if(!existing){map.set(server.sessionId,server);continue}

    const serverReady=meshReady(server.payload);
    const existingReady=meshReady(existing.payload);
    const asset=usefulAsset(existing.payload?.asset)?existing.payload.asset:server.payload.asset;
    const mesh=serverReady||!existingReady?server.payload.mesh:existing.payload.mesh;
    const mint=server.payload?.mint?.tokenId?server.payload.mint:existing.payload?.mint;
    const updatedAt=new Date().toISOString();
    map.set(server.sessionId,{
      sessionId:server.sessionId,
      updatedAt,
      payload:{
        ...existing.payload,
        ...server.payload,
        asset,
        mesh,
        ...(mint?{mint}:{}),
        idea:existing.payload?.idea||server.payload?.idea||'',
        updatedAt,
      },
    });
  }
  return Array.from(map.values());
}

export default function RealForgeLayout({children}){
  const [ready,setReady]=useState(false);
  const [signedIn,setSignedIn]=useState(null);
  const [accountBusy,setAccountBusy]=useState(false);
  const [accountMessage,setAccountMessage]=useState('');
  const [lastRecovery,setLastRecovery]=useState(null);

  async function recoverAccountAssets({quiet=false}={}){
    const supabase=await getSupabaseBrowserAsync();
    const {data}=await supabase.auth.getSession();
    const session=data.session;
    setSignedIn(Boolean(session?.user));
    if(!session?.user||!session.access_token)return {records:[],signedIn:false};

    if(!quiet){setAccountBusy(true);setAccountMessage('Scanning your paid VoxelPop 3D history…')}
    try{
      const response=await fetch('/api/forge/account-assets',{cache:'no-store',headers:{Authorization:`Bearer ${session.access_token}`}});
      const recovered=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(recovered.error||'Could not recover paid VoxelPop assets.');
      const records=Array.isArray(recovered.records)?recovered.records:[];
      const current=mergePaidRecovery(readLocalVoxelRecords(),records);
      writeRecords(current);
      try{await syncLocalVoxelsToAccount(supabase,session.user)}catch{}
      setLastRecovery(recovered);
      const nonMinted=Number(recovered.nonMintedReady||0);
      const minted=Number(recovered.minted||0);
      const total=Number(recovered.recovered||records.length||0);
      const stopped=recovered?.diagnostics?.stoppedByTimeBudget===true;
      setAccountMessage(`Recovered ${total} paid creation${total===1?'':'s'} · ${nonMinted} finished non-minted 3D · ${minted} minted${stopped?' · history scan reached its time limit; tap Refresh again to retry':''}.`);
      return {records:current,signedIn:true,recovered};
    }catch(error){
      setAccountMessage(error instanceof Error?error.message:'Could not recover paid VoxelPop assets.');
      return {records:[],signedIn:true,error};
    }finally{
      if(!quiet)setAccountBusy(false);
    }
  }

  useEffect(()=>{
    let active=true;
    async function sync(){
      let current=readLocalVoxelRecords();
      const focusSession=focusedSessionId();

      if(focusSession){
        try{
          const response=await fetch(`/api/forge/session-asset?${new URLSearchParams({sessionId:focusSession})}`,{cache:'no-store'});
          const recovered=await response.json().catch(()=>({}));
          if(response.ok&&recovered?.record?.sessionId){
            current=mergePaidRecovery(current,[recovered.record]);
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
      writeRecords(current);

      try{
        const result=await recoverAccountAssets({quiet:true});
        if(active&&result?.records?.length){
          current=mergePaidRecovery(current,result.records);
          writeRecords(current);
          if(!focusSession){
            const recovered=result.recovered||{};
            const total=Number(recovered.recovered||result.records.length||0);
            const nonMinted=Number(recovered.nonMintedReady||0);
            const minted=Number(recovered.minted||0);
            setAccountMessage(`Recovered ${total} paid creation${total===1?'':'s'} · ${nonMinted} finished non-minted 3D · ${minted} minted.`);
          }
        }
      }catch{
        if(active)setSignedIn(false);
      }

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

  async function refreshPaid(){
    await recoverAccountAssets({quiet:false});
  }

  if(!ready){
    return <main style={{minHeight:'100vh',background:'#070809',color:'#f7f7f3',display:'grid',placeItems:'center',fontFamily:'Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',padding:24}}>
      <div style={{textAlign:'center',maxWidth:460}}>
        <div style={{color:'#c8ff54',fontSize:11,fontWeight:900,letterSpacing:'.14em'}}>MY VOXELS</div>
        <h1 style={{fontSize:34,margin:'12px 0 8px'}}>Recovering your full library…</h1>
        <p style={{color:'#8d8f98',fontSize:13,lineHeight:1.6,margin:0}}>Checking the focused paid voxel, browser storage, the other VoxelVault hostname, and your complete Google-matched paid 3D history.</p>
      </div>
    </main>;
  }

  return <>
    <div style={{position:'relative',zIndex:30,background:'#111318',borderBottom:'1px solid rgba(255,255,255,.10)',color:'#f7f7f3',padding:'12px 18px',display:'flex',alignItems:'center',justifyContent:'center',gap:14,flexWrap:'wrap',fontFamily:'Inter,ui-sans-serif,system-ui,sans-serif'}}>
      {signedIn===false?<>
        <span style={{fontSize:13,lineHeight:1.45}}><b style={{color:'#c8ff54'}}>Missing a paid 3D voxel?</b> Recover older creations with the Google account used for VoxelPop.</span>
        <button type="button" onClick={recoverWithGoogle} disabled={accountBusy} style={{border:0,borderRadius:999,padding:'9px 14px',background:'#c8ff54',color:'#0a0b0d',fontWeight:900,cursor:accountBusy?'wait':'pointer'}}>{accountBusy?'OPENING…':'RECOVER WITH GOOGLE'}</button>
      </>:<>
        <span style={{fontSize:13,lineHeight:1.45}}><b style={{color:'#c8ff54'}}>Google connected.</b> Re-scan Stripe + Meshy for finished non-minted 3D voxels at any time.</span>
        <button type="button" onClick={refreshPaid} disabled={accountBusy} style={{border:0,borderRadius:999,padding:'9px 14px',background:'#c8ff54',color:'#0a0b0d',fontWeight:900,cursor:accountBusy?'wait':'pointer'}}>{accountBusy?'SCANNING…':'REFRESH PAID 3D VOXELS'}</button>
      </>}
    </div>
    {accountMessage&&<div style={{position:'relative',zIndex:29,background:'#0d0f12',color:'#aeb4bd',textAlign:'center',padding:'8px 16px',font:'700 12px/1.4 Inter,ui-sans-serif,system-ui,sans-serif',borderBottom:'1px solid rgba(255,255,255,.06)'}}>{accountMessage}</div>}
    {lastRecovery?.diagnostics&&<div style={{position:'relative',zIndex:28,background:'#0b0c0f',color:'#747b86',textAlign:'center',padding:'6px 14px',font:'600 11px/1.4 Inter,ui-sans-serif,system-ui,sans-serif',borderBottom:'1px solid rgba(255,255,255,.04)'}}>History scan: {lastRecovery.diagnostics.checkoutSessionsScanned||0} checkout sessions · {lastRecovery.diagnostics.paidVoxelSessionsScanned||0} paid 3D candidates · {lastRecovery.diagnostics.identityCandidatesChecked||0} identity checks.</div>}
    {children}
    <ForgePassport />
  </>;
}
