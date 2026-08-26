'use client';

import {useEffect,useState} from 'react';
import {readLocalVoxelRecords} from '../../../lib/voxelpop-account';

const ALLOWED_PARENTS=new Set(['https://voxelvault.io','https://www.voxelvault.io']);

export default function VoxelLibraryBridgePage(){
  const [sent,setSent]=useState(false);

  useEffect(()=>{
    const query=new URLSearchParams(window.location.search);
    const parentOrigin=String(query.get('parent_origin')||'');
    const nonce=String(query.get('nonce')||'');
    if(!ALLOWED_PARENTS.has(parentOrigin)||!nonce)return;
    try{
      const records=readLocalVoxelRecords();
      window.parent.postMessage({type:'VOXELPOP_LIBRARY_BRIDGE',nonce,records},parentOrigin);
      setSent(true);
    }catch{}
  },[]);

  return <main style={{minHeight:'100vh',background:'#070809',color:'#8d8f98',display:'grid',placeItems:'center',fontFamily:'Inter,system-ui,sans-serif',fontSize:12}}>
    {sent?'Voxel library shared with VoxelVault.':'Voxel library bridge ready.'}
  </main>;
}
