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
    if(!item?.id)return;
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

  if(modelUrl)return <div><Product3DTwin item={runtimeItem} hero={hero}/></div>;

  const finishing=progress>=95;
  const message=status==='preparing'?'Waking this 3D NFT':status==='queued'?'Waking this 3D NFT':status==='rebuilding'?'Refreshing this 3D NFT':status==='building'?(finishing?'Almost ready…':`Coming to life${progress?` · ${progress}%`:''}`):'Waking this 3D NFT';
  const detail='The object turns as soon as it is ready. You can browse while it loads.';

  return <div className="vv3-generationState"><div className="vv3-generationOrb">◆</div><strong>{message}</strong><small>{detail}</small>{(status==='building'||status==='rebuilding')&&<div className="vv3-progress"><i style={{width:`${Math.max(6,Math.min(99,progress||8))}%`}}/></div>}</div>;
}
