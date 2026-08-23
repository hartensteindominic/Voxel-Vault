'use client';

import { useEffect, useMemo, useState } from 'react';
import Product3DTwin from './Product3DTwin';

const POLL_MS = 7000;

function key(kind,id){return `voxel:${kind}:${id}`}

export default function Auto3DPreview({ item, hero = false }) {
  const [modelUrl,setModelUrl]=useState('');
  const [status,setStatus]=useState('idle');
  const [progress,setProgress]=useState(0);
  const [error,setError]=useState('');
  const runtimeItem=useMemo(()=>modelUrl?{...item,modelUri:modelUrl,digitalTwin:{...(item?.digitalTwin||{}),modelUrl,exactModelVerified:false}}:item,[item,modelUrl]);

  useEffect(()=>{
    if(!hero||!item?.id||item?.modelUri||item?.digitalTwin?.modelUrl)return;
    let alive=true;let timer;
    const modelKey=key('model',item.id);const taskKey=key('meshy-task',item.id);
    try{const cached=window.localStorage.getItem(modelKey);if(cached){setModelUrl(cached);setStatus('ready');return;}}catch{}

    async function poll(taskId){
      if(!alive)return;
      setStatus('generating');
      try{
        const response=await fetch(`/api/image-to-3d?taskId=${encodeURIComponent(taskId)}`,{cache:'no-store'});
        const data=await response.json();
        if(!response.ok)throw new Error(data?.error||'Unable to read 3D generation status.');
        if(!alive)return;
        setProgress(Number(data?.progress||0));
        if(data?.modelUrl){
          setModelUrl(data.modelUrl);setStatus('ready');setError('');
          try{window.localStorage.setItem(modelKey,data.modelUrl);window.localStorage.removeItem(taskKey);}catch{}
          return;
        }
        if(String(data?.status||'').toUpperCase()==='FAILED'||data?.error){throw new Error(data?.error||'3D generation failed.');}
        timer=window.setTimeout(()=>poll(taskId),POLL_MS);
      }catch(e){if(alive){setStatus('error');setError(e?.message||'3D generation failed.');}}
    }

    async function start(){
      try{
        let existing='';try{existing=window.localStorage.getItem(taskKey)||'';}catch{}
        if(existing){poll(existing);return;}
        setStatus('starting');
        const response=await fetch('/api/image-to-3d',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({item})});
        const data=await response.json();
        if(!response.ok||!data?.taskId)throw new Error(data?.error||'Unable to start 3D generation.');
        try{window.localStorage.setItem(taskKey,data.taskId);}catch{}
        poll(data.taskId);
      }catch(e){if(alive){setStatus('error');setError(e?.message||'Unable to start 3D generation.');}}
    }
    start();
    return()=>{alive=false;if(timer)window.clearTimeout(timer)};
  },[hero,item?.id,item?.modelUri,item?.digitalTwin?.modelUrl,item]);

  if(modelUrl)return <div><Product3DTwin item={runtimeItem} hero={hero}/><div className="vv3-liveReview"><b>AI 3D PREVIEW · UNDER REVIEW</b><span>Generated from the CJ product image. Checkout remains locked until product-specific accuracy is approved.</span></div></div>;
  return <div className="vv3-generationState"><div className="vv3-generationOrb">3D</div><strong>{status==='error'?'3D preview unavailable':'Building interactive 3D preview'}</strong><small>{status==='error'?error:`Meshy is generating this object from the verified CJ product image${progress?` · ${progress}%`:''}. You can keep browsing while it finishes.`}</small>{status!=='error'&&<div className="vv3-progress"><i style={{width:`${Math.max(6,Math.min(100,progress||8))}%`}}/></div>}</div>;
}
