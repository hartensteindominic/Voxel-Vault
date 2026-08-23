'use client';

import { useEffect, useMemo, useState } from 'react';
import Product3DTwin from './Product3DTwin';
import { clearTask, pollDelay, readModel, readTask, subscribe, writeModel, writeTask } from './threeDSync';

function warmModelAsset(url) {
  if (!url || typeof window === 'undefined') return;
  try { fetch(url, { cache: 'force-cache', mode: 'cors' }).catch(() => {}); } catch {}
}

export default function Auto3DPreview({ item, hero = false }) {
  const [modelUrl,setModelUrl]=useState('');
  const [status,setStatus]=useState('idle');
  const [progress,setProgress]=useState(0);
  const [error,setError]=useState('');
  const [retryNonce,setRetryNonce]=useState(0);
  const runtimeItem=useMemo(()=>modelUrl?{...item,modelUri:modelUrl,digitalTwin:{...(item?.digitalTwin||{}),modelUrl,exactModelVerified:false}}:item,[item,modelUrl]);

  useEffect(()=>{
    setModelUrl('');setProgress(0);setError('');setStatus('idle');
    if(!hero||!item?.id||item?.modelUri||item?.digitalTwin?.modelUrl)return;
    let alive=true;let timer;let attempt=0;

    const useReadyModel=(url)=>{warmModelAsset(url);setModelUrl(url);setStatus('ready');setError('');setProgress(100)};
    const cached=readModel(item.id);
    if(cached?.url){useReadyModel(cached.url);return;}

    const unsubscribe=subscribe(item.id,(message)=>{
      if(!alive)return;
      if(message.type==='model-ready'&&message.url)useReadyModel(message.url);
      if(message.type==='task-update'){setStatus('generating');if(Number.isFinite(message.progress))setProgress(message.progress);}
    });

    async function poll(taskId){
      if(!alive)return;
      setStatus('generating');
      try{
        const response=await fetch(`/api/image-to-3d?taskId=${encodeURIComponent(taskId)}`,{cache:'no-store'});
        const data=await response.json();
        if(!response.ok)throw new Error(data?.error||'Unable to read 3D generation status.');
        if(!alive)return;
        const nextProgress=Math.max(0,Math.min(100,Number(data?.progress||0)));
        setProgress(nextProgress);
        writeTask(item.id,{taskId,progress:nextProgress,status:data?.status||'PENDING'});
        if(data?.modelUrl){
          warmModelAsset(data.modelUrl);
          writeModel(item.id,{url:data.modelUrl,thumbnailUrl:data?.thumbnailUrl||'',sourceImageUrl:data?.sourceImageUrl||'',provider:'meshy'});
          clearTask(item.id);
          useReadyModel(data.modelUrl);
          return;
        }
        const providerStatus=String(data?.status||'').toUpperCase();
        if(providerStatus==='FAILED'||providerStatus==='CANCELED'||data?.error){clearTask(item.id);throw new Error(data?.error||'3D generation failed.');}
        attempt+=1;
        timer=window.setTimeout(()=>poll(taskId),pollDelay(attempt));
      }catch(e){
        if(!alive)return;
        if(attempt<3){attempt+=1;timer=window.setTimeout(()=>poll(taskId),pollDelay(attempt));return;}
        setStatus('error');setError(e?.message||'3D generation failed.');
      }
    }

    async function start(){
      try{
        const existing=readTask(item.id);
        if(existing?.taskId){setProgress(Number(existing.progress||0));poll(existing.taskId);return;}
        setStatus('starting');
        const response=await fetch('/api/image-to-3d',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({item})});
        const data=await response.json();
        if(!response.ok||!data?.taskId)throw new Error(data?.error||'Unable to start 3D generation.');
        writeTask(item.id,{taskId:data.taskId,progress:0,status:'PENDING'});
        poll(data.taskId);
      }catch(e){if(alive){clearTask(item.id);setStatus('error');setError(e?.message||'Unable to start 3D generation.');}}
    }

    start();
    return()=>{alive=false;unsubscribe();if(timer)window.clearTimeout(timer)};
  },[hero,item?.id,item?.modelUri,item?.digitalTwin?.modelUrl,retryNonce]);

  if(modelUrl)return <div><Product3DTwin item={runtimeItem} hero={hero}/><div className="vv3-liveReview"><b>3D PREVIEW READY · ACCURACY REVIEW</b><span>Generated from the synced CJ product image. The preview is cached for faster reopening; checkout remains off until Voxel Vault approves product accuracy.</span></div></div>;

  const message=status==='starting'?'Starting 3D build…':status==='generating'?`Building 3D preview${progress?` · ${progress}%`:''}`:'Preparing 3D preview…';
  return <div className="vv3-generationState"><div className="vv3-generationOrb">3D</div><strong>{status==='error'?'3D preview needs another try':message}</strong><small>{status==='error'?error:'CJ media is synced. Voxel Vault reuses active jobs and cached models so repeat views load much faster.'}</small>{status!=='error'&&<div className="vv3-progress"><i style={{width:`${Math.max(6,Math.min(100,progress||8))}%`}}/></div>}{status==='error'&&<button type="button" className="vv3-retry" onClick={()=>setRetryNonce(value=>value+1)}>Retry 3D build</button>}</div>;
}
