'use client';

import { useEffect, useMemo, useState } from 'react';
import Product3DTwin from './Product3DTwin';
import { readModel, writeModel } from './threeDSync';

function warmModelAsset(url) {
  if (!url || typeof window === 'undefined') return;
  try { fetch(url, { cache: 'force-cache', mode: 'cors' }).catch(() => {}); } catch {}
}

export default function Auto3DPreview({ item, hero = false }) {
  const [modelUrl,setModelUrl]=useState('');
  const [status,setStatus]=useState('checking');
  const [progress,setProgress]=useState(0);
  const [error,setError]=useState('');
  const runtimeItem=useMemo(()=>modelUrl?{...item,modelUri:modelUrl,digitalTwin:{...(item?.digitalTwin||{}),modelUrl,exactModelVerified:false}}:item,[item,modelUrl]);

  useEffect(()=>{
    setModelUrl('');setProgress(0);setError('');setStatus('checking');
    if(!hero||!item?.id||item?.modelUri||item?.digitalTwin?.modelUrl)return;
    let alive=true;let timer;

    const useReadyModel=(url)=>{warmModelAsset(url);writeModel(item.id,{url,provider:'server-prebuilt'});setModelUrl(url);setStatus('ready');setProgress(100);setError('')};
    const cached=readModel(item.id);
    if(cached?.url){useReadyModel(cached.url);return;}

    async function check(){
      if(!alive)return;
      try{
        const response=await fetch(`/api/catalog-3d?itemId=${encodeURIComponent(item.id)}`,{cache:'no-store'});
        const data=response.ok?await response.json():null;
        if(!alive)return;
        if(data?.modelUrl){useReadyModel(data.modelUrl);return;}
        if(data?.taskId){setStatus('building');setProgress(Math.max(0,Math.min(99,Number(data.progress||0))));}
        else setStatus('queued');
        timer=window.setTimeout(check,5000);
      }catch(e){
        if(!alive)return;
        setStatus('waiting');setError(e?.message||'Preview status temporarily unavailable.');
        timer=window.setTimeout(check,8000);
      }
    }

    check();
    return()=>{alive=false;if(timer)window.clearTimeout(timer)};
  },[hero,item?.id,item?.modelUri,item?.digitalTwin?.modelUrl]);

  if(modelUrl)return <div><Product3DTwin item={runtimeItem} hero={hero}/><div className="vv3-liveReview"><b>INTERACTIVE PREVIEW READY · MATCH REVIEW</b><span>This prebuilt model is reused across visits and devices. It remains preview-only until Voxel Vault confirms it closely matches the physical item.</span></div></div>;

  const finishing=progress>=95;
  const message=status==='queued'?'Preview is queued in the background':status==='building'?(finishing?'Finishing your interactive preview…':`Preparing interactive preview${progress?` · ${progress}%`:''}`):status==='waiting'?'Preview is still preparing':'Checking for a prebuilt preview…';
  return <div className="vv3-generationState"><div className="vv3-generationOrb">◆</div><strong>{message}</strong><small>{error||'Generation runs on Voxel Vault servers, not on your phone. You can leave the site and come back later; finished assets are saved and load instantly when available.'}</small>{status==='building'&&<div className="vv3-progress"><i style={{width:`${Math.max(6,Math.min(99,progress||8))}%`}}/></div>}</div>;
}
