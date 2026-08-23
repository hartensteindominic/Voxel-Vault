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
        const data=await response.json().catch(()=>null);
        if(!alive)return;

        if(data?.modelUrl){useReadyModel(data.modelUrl);return;}
        if(data?.storageReady===false){
          setStatus('preparing');
          setError('');
          timer=window.setTimeout(check,12000);
          return;
        }
        if(data?.taskId){
          setStatus(data?.error && /restart|stale|failed/i.test(data.error) ? 'rebuilding' : 'building');
          setProgress(Math.max(0,Math.min(99,Number(data.progress||0))));
          setError(data?.error||'');
        } else {
          setStatus('queued');
          setError('');
        }
        timer=window.setTimeout(check,4000);
      }catch(e){
        if(!alive)return;
        setStatus('waiting');setError('');
        timer=window.setTimeout(check,8000);
      }
    }

    check();
    return()=>{alive=false;if(timer)window.clearTimeout(timer)};
  },[hero,item?.id,item?.modelUri,item?.digitalTwin?.modelUrl]);

  if(modelUrl)return <div><Product3DTwin item={runtimeItem} hero={hero}/><div className="vv3-liveReview"><b>INTERACTIVE PREVIEW READY · MATCH REVIEW</b><span>This preview is saved for fast repeat visits. It remains preview-only until Voxel Vault confirms it closely matches the physical item.</span></div></div>;

  const finishing=progress>=95;
  const message=status==='preparing'?'Preparing this collectible':status==='queued'?'Prebuilding this collectible':status==='rebuilding'?'Improving this preview automatically':status==='building'?(finishing?'Finishing the collectible…':`Prebuilding collectible${progress?` · ${progress}%`:''}`):status==='waiting'?'Collectible is still preparing':'Checking for a prebuilt collectible…';
  const detail=status==='preparing'?'Voxel Vault is preparing the saved preview in the background. You do not need to do anything.':status==='queued'?'This product is in the server build queue. No generation happens on your phone.':status==='rebuilding'?'The previous build stalled or failed, so Voxel Vault automatically started a fresh reconstruction from the product reference images.':status==='building'?(finishing?'The provider is packaging the finished model. The server keeps checking and saves it when ready.':'Voxel Vault is building this once so future visitors can load the finished object instead of waiting for generation.'):error||'Finished assets are loaded automatically and cached on your device for fast repeat visits.';

  return <div className="vv3-generationState"><div className="vv3-generationOrb">◆</div><strong>{message}</strong><small>{detail}</small>{(status==='building'||status==='rebuilding')&&<div className="vv3-progress"><i style={{width:`${Math.max(6,Math.min(99,progress||8))}%`}}/></div>}</div>;
}
