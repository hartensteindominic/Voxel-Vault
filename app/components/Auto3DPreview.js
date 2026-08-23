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
  const [mode,setMode]=useState('');
  const runtimeItem=useMemo(()=>modelUrl?{...item,modelUri:modelUrl,digitalTwin:{...(item?.digitalTwin||{}),modelUrl,exactModelVerified:false}}:item,[item,modelUrl]);

  useEffect(()=>{
    setModelUrl('');setProgress(0);setError('');setStatus('idle');setMode('');
    if(!hero||!item?.id||item?.modelUri||item?.digitalTwin?.modelUrl)return;
    let alive=true;let timer;let attempt=0;

    const useReadyModel=(url)=>{warmModelAsset(url);writeModel(item.id,{url,provider:'meshy'});setModelUrl(url);setStatus('ready');setError('');setProgress(100)};
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
        if(!response.ok)throw new Error(data?.error||'Unable to read object build status.');
        if(!alive)return;
        if(data?.generationMode)setMode(data.generationMode);
        const nextProgress=Math.max(0,Math.min(100,Number(data?.progress||0)));
        setProgress(nextProgress);
        writeTask(item.id,{taskId,progress:nextProgress,status:data?.status||'PENDING'});
        if(data?.modelUrl){clearTask(item.id);useReadyModel(data.modelUrl);return;}
        const providerStatus=String(data?.status||'').toUpperCase();
        if(providerStatus==='FAILED'||providerStatus==='CANCELED'||data?.error){clearTask(item.id);throw new Error(data?.error||'Object build failed.');}
        attempt+=1;
        const delay=nextProgress>=95?1200:pollDelay(attempt);
        timer=window.setTimeout(()=>poll(taskId),delay);
      }catch(e){
        if(!alive)return;
        if(attempt<4){attempt+=1;timer=window.setTimeout(()=>poll(taskId),Math.min(5000,pollDelay(attempt)));return;}
        setStatus('error');setError(e?.message||'Object build failed.');
      }
    }

    async function start(){
      try{
        setStatus('checking');
        const savedResponse=await fetch(`/api/catalog-3d?itemId=${encodeURIComponent(item.id)}`,{cache:'no-store'}).catch(()=>null);
        const saved=savedResponse?.ok?await savedResponse.json():null;
        if(saved?.modelUrl){useReadyModel(saved.modelUrl);return;}
        if(saved?.taskId){setProgress(Number(saved.progress||0));writeTask(item.id,{taskId:saved.taskId,progress:Number(saved.progress||0),status:saved.status||'PENDING'});poll(saved.taskId);return;}
        const existing=readTask(item.id);
        if(existing?.taskId){setProgress(Number(existing.progress||0));poll(existing.taskId);return;}
        setStatus('starting');
        const response=await fetch('/api/image-to-3d',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({item})});
        const data=await response.json();
        if(data?.generationMode)setMode(data.generationMode);
        if(data?.modelUrl){useReadyModel(data.modelUrl);return;}
        if(!response.ok||!data?.taskId)throw new Error(data?.error||'Unable to start object build.');
        writeTask(item.id,{taskId:data.taskId,progress:Number(data.progress||0),status:'PENDING'});
        poll(data.taskId);
      }catch(e){if(alive){clearTask(item.id);setStatus('error');setError(e?.message||'Unable to start object build.');}}
    }

    start();
    return()=>{alive=false;unsubscribe();if(timer)window.clearTimeout(timer)};
  },[hero,item?.id,item?.modelUri,item?.digitalTwin?.modelUrl,retryNonce]);

  if(modelUrl)return <div><Product3DTwin item={runtimeItem} hero={hero}/><div className="vv3-liveReview"><b>INTERACTIVE PREVIEW READY · MATCH REVIEW</b><span>{mode==='multi-view'?'Built from multiple product angles for stronger shape fidelity. ':'Built from the best available product reference. '}It remains preview-only until Voxel Vault confirms it closely matches the physical item.</span></div></div>;

  const finishing=progress>=95;
  const message=status==='checking'?'Checking for a finished preview…':status==='starting'?'Starting interactive preview…':status==='generating'?(finishing?'Finishing the interactive preview…':`Building interactive preview${progress?` · ${progress}%`:''}`):'Preparing interactive preview…';
  return <div className="vv3-generationState"><div className="vv3-generationOrb">◆</div><strong>{status==='error'?'Preview needs another try':message}</strong><small>{status==='error'?error:(finishing?'The final model file is being packaged. Voxel Vault checks more frequently at this stage and reuses it automatically when ready.':mode==='multi-view'?'Multiple product angles are being used to improve shape and proportion accuracy.':'The build can continue in the background and the finished model is reused on future visits.')}</small>{status!=='error'&&<div className="vv3-progress"><i style={{width:`${Math.max(6,Math.min(100,progress||8))}%`}}/></div>}{status==='error'&&<button type="button" className="vv3-retry" onClick={()=>setRetryNonce(value=>value+1)}>Retry preview</button>}</div>;
}
