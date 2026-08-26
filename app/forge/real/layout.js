'use client';

import {useEffect,useState} from 'react';
import {loadAlternateHostVoxels} from '../../../lib/voxelpop-cross-host';
import {mergeVoxelRecords,readLocalVoxelRecords} from '../../../lib/voxelpop-account';

export default function RealForgeLayout({children}){
  const [ready,setReady]=useState(false);

  useEffect(()=>{
    let active=true;
    async function sync(){
      try{
        const alternate=await loadAlternateHostVoxels();
        if(alternate.length){
          const current=readLocalVoxelRecords();
          const merged=mergeVoxelRecords(current,alternate);
          for(const record of merged){
            try{localStorage.setItem(`voxelpop:${record.sessionId}`,JSON.stringify(record.payload))}catch{}
          }
        }
      }catch{}
      if(active)setReady(true);
    }
    sync();
    return()=>{active=false};
  },[]);

  if(!ready){
    return <main style={{minHeight:'100vh',background:'#070809',color:'#f7f7f3',display:'grid',placeItems:'center',fontFamily:'Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',padding:24}}>
      <div style={{textAlign:'center',maxWidth:420}}>
        <div style={{color:'#c8ff54',fontSize:11,fontWeight:900,letterSpacing:'.14em'}}>MY VOXELS</div>
        <h1 style={{fontSize:34,margin:'12px 0 8px'}}>Loading your full library…</h1>
        <p style={{color:'#8d8f98',fontSize:13,lineHeight:1.6,margin:0}}>Checking both voxelvault.io hostnames so older browser-saved 3D voxels do not disappear.</p>
      </div>
    </main>;
  }

  return children;
}
