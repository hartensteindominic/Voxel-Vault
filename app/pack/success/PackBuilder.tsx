'use client';

import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import GeneratedMeshViewer from './GeneratedMeshViewer';
import styles from './success.module.css';

type Brief={idea:string;style:string;reference:string;referenceName?:string};
type SourceAsset={name:string;dataUrl:string};
type MeshStatus='idle'|'starting'|'building'|'ready'|'error';
type MeshResult={status:MeshStatus;progress:number;taskId:string;modelUrl:string;error:string};
type CachedPack={assets:SourceAsset[];generationsLeft:number;taskIds:string[]};

const defaultBrief:Brief={idea:'Cozy medieval fantasy adventurer with warm lantern light, mossy armor and emerald accents',style:'polished',reference:''};
const emptyMesh=():MeshResult=>({status:'idle',progress:0,taskId:'',modelUrl:'',error:''});
const emptyMeshes=()=>[emptyMesh(),emptyMesh(),emptyMesh()];

async function compressReference(file:File){
  const bitmap=await createImageBitmap(file);
  const max=640;
  const scale=Math.min(1,max/Math.max(bitmap.width,bitmap.height));
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(bitmap.width*scale));
  canvas.height=Math.max(1,Math.round(bitmap.height*scale));
  const ctx=canvas.getContext('2d');
  if(!ctx) throw new Error('Image preview is not supported in this browser.');
  ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
  bitmap.close?.();
  return canvas.toDataURL('image/jpeg',.78);
}

function crc32(data:Uint8Array){
  let crc=0xffffffff;
  for(const byte of data){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
  return (crc^0xffffffff)>>>0;
}

function dosStamp(){
  const d=new Date();
  const time=(d.getHours()<<11)|(d.getMinutes()<<5)|(d.getSeconds()>>1);
  const date=((Math.max(1980,d.getFullYear())-1980)<<9)|((d.getMonth()+1)<<5)|d.getDate();
  return {time,date};
}

function zipBytes(files:{name:string;data:Uint8Array}[]){
  const encoder=new TextEncoder();
  const locals:Uint8Array[]=[];const centrals:Uint8Array[]=[];let offset=0;const {time,date}=dosStamp();
  for(const file of files){
    const name=encoder.encode(file.name);const crc=crc32(file.data);
    const local=new Uint8Array(30+name.length+file.data.length);const lv=new DataView(local.buffer);
    lv.setUint32(0,0x04034b50,true);lv.setUint16(4,20,true);lv.setUint16(6,0x0800,true);lv.setUint16(8,0,true);lv.setUint16(10,time,true);lv.setUint16(12,date,true);lv.setUint32(14,crc,true);lv.setUint32(18,file.data.length,true);lv.setUint32(22,file.data.length,true);lv.setUint16(26,name.length,true);lv.setUint16(28,0,true);local.set(name,30);local.set(file.data,30+name.length);locals.push(local);
    const central=new Uint8Array(46+name.length);const cv=new DataView(central.buffer);
    cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint16(8,0x0800,true);cv.setUint16(10,0,true);cv.setUint16(12,time,true);cv.setUint16(14,date,true);cv.setUint32(16,crc,true);cv.setUint32(20,file.data.length,true);cv.setUint32(24,file.data.length,true);cv.setUint16(28,name.length,true);cv.setUint16(30,0,true);cv.setUint16(32,0,true);cv.setUint16(34,0,true);cv.setUint16(36,0,true);cv.setUint32(38,0,true);cv.setUint32(42,offset,true);central.set(name,46);centrals.push(central);offset+=local.length;
  }
  const centralSize=centrals.reduce((sum,x)=>sum+x.length,0);const end=new Uint8Array(22);const ev=new DataView(end.buffer);
  ev.setUint32(0,0x06054b50,true);ev.setUint16(4,0,true);ev.setUint16(6,0,true);ev.setUint16(8,files.length,true);ev.setUint16(10,files.length,true);ev.setUint32(12,centralSize,true);ev.setUint32(16,offset,true);ev.setUint16(20,0,true);
  return new Blob([...locals,...centrals,end] as BlobPart[],{type:'application/zip'});
}

function saveBlob(blob:Blob,name:string){
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
}

function bytes(buffer:ArrayBuffer){return new Uint8Array(buffer);}
function wait(ms:number){return new Promise(resolve=>setTimeout(resolve,ms));}

function packCache(){
  return new Promise<IDBDatabase>((resolve,reject)=>{
    const request=indexedDB.open('voxelpop-packs',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('packs');
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
  });
}

async function readCachedPack(sessionId:string){
  if(!sessionId||typeof indexedDB==='undefined') return null;
  const db=await packCache();
  return new Promise<CachedPack|null>((resolve,reject)=>{
    const request=db.transaction('packs','readonly').objectStore('packs').get(sessionId);
    request.onsuccess=()=>{db.close();resolve(request.result||null);};
    request.onerror=()=>{db.close();reject(request.error);};
  });
}

async function writeCachedPack(sessionId:string,value:CachedPack){
  if(!sessionId||typeof indexedDB==='undefined') return;
  const db=await packCache();
  await new Promise<void>((resolve,reject)=>{
    const request=db.transaction('packs','readwrite').objectStore('packs').put(value,sessionId);
    request.onsuccess=()=>resolve();request.onerror=()=>reject(request.error);
  });
  db.close();
}

async function removeCachedPack(sessionId:string){
  if(!sessionId||typeof indexedDB==='undefined') return;
  const db=await packCache();
  await new Promise<void>((resolve,reject)=>{
    const request=db.transaction('packs','readwrite').objectStore('packs').delete(sessionId);
    request.onsuccess=()=>resolve();request.onerror=()=>reject(request.error);
  });
  db.close();
}

export default function PackBuilder({sessionId}:{sessionId:string}){
  const mounted=useRef(true);
  const [brief,setBrief]=useState<Brief>(defaultBrief);
  const [status,setStatus]=useState<'ready'|'generating'|'done'|'error'>('ready');
  const [message,setMessage]=useState('');
  const [assets,setAssets]=useState<SourceAsset[]>([]);
  const [meshes,setMeshes]=useState<MeshResult[]>(emptyMeshes);
  const [generationsLeft,setGenerationsLeft]=useState(1);
  const [packaging,setPackaging]=useState(false);

  useEffect(()=>{
    mounted.current=true;
    try{const stored=sessionStorage.getItem('voxelPackBrief');if(stored)setBrief({...defaultBrief,...JSON.parse(stored)});}catch{}
    readCachedPack(sessionId).then(cached=>{
      if(!mounted.current||!cached||cached.assets.length!==3) return;
      setAssets(cached.assets);setGenerationsLeft(cached.generationsLeft);setStatus('done');
      const restored=cached.taskIds.map(taskId=>taskId?{...emptyMesh(),status:'building' as MeshStatus,progress:1,taskId}:emptyMesh());
      setMeshes([restored[0]||emptyMesh(),restored[1]||emptyMesh(),restored[2]||emptyMesh()]);
      setMessage('Your saved VoxelPop pack was restored. Continuing any 3D builds…');
      cached.taskIds.forEach((taskId,index)=>{if(taskId)pollMesh(index,taskId).catch(err=>updateMesh(index,{status:'error',error:err instanceof Error?err.message:'Could not restore this 3D mesh.'}));});
    }).catch(()=>{});
    return()=>{mounted.current=false;};
  },[]);

  function updateMesh(index:number,patch:Partial<MeshResult>){
    if(!mounted.current) return;
    setMeshes(current=>current.map((mesh,i)=>i===index?{...mesh,...patch}:mesh));
  }

  async function chooseReference(event:ChangeEvent<HTMLInputElement>){
    const file=event.target.files?.[0];if(!file)return;
    try{setMessage('');setBrief(v=>({...v,referenceName:file.name,reference:''}));const data=await compressReference(file);setBrief(v=>({...v,reference:data,referenceName:file.name}));}
    catch(err){setMessage(err instanceof Error?err.message:'Could not read that image.');}
  }

  async function generate(){
    if(!sessionId){setStatus('error');setMessage('Checkout session missing. Return to the product page and use the purchase link again.');return;}
    if(brief.idea.trim().length<8){setStatus('error');setMessage('Add a short description of the person, character or object you want.');return;}
    setStatus('generating');setMessage('Creating three clean, matching source images for high-quality 3D reconstruction…');
    try{
      const response=await fetch('/api/creator-pack/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId,idea:brief.idea.trim(),style:brief.style,reference:brief.reference})});
      const data=await response.json();
      if(!response.ok||!Array.isArray(data.images)||data.images.length!==3) throw new Error(data.error||'Generation failed.');
      const generated=data.images.map((image:string,index:number)=>({name:data.names?.[index]||`voxel-${index+1}`,dataUrl:image}));
      setAssets(generated);setMeshes(emptyMeshes());setGenerationsLeft(data.generationsLeft||0);setStatus('done');setMessage('Your three source images are ready. Choose Build 3D Mesh on each one to make it movable.');
      void writeCachedPack(sessionId,{assets:generated,generationsLeft:data.generationsLeft||0,taskIds:['','','']}).catch(()=>{});
    }catch(err){setStatus('error');setMessage(err instanceof Error?err.message:'Generation failed.');}
  }

  async function pollMesh(index:number,taskId:string){
    for(let attempt=0;attempt<180;attempt++){
      if(!mounted.current) return;
      const query=new URLSearchParams({sessionId,taskId});
      const response=await fetch(`/api/creator-pack/mesh?${query}`,{cache:'no-store'});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||'Could not read the mesh status.');
      const providerStatus=String(data.status||'').toUpperCase();
      if(providerStatus==='SUCCEEDED'&&data.modelUrl){
        updateMesh(index,{status:'ready',progress:100,modelUrl:data.modelUrl,error:''});
        return;
      }
      if(['FAILED','EXPIRED','CANCELED','CANCELLED'].includes(providerStatus)) throw new Error(data.error||'The 3D provider could not complete this mesh.');
      updateMesh(index,{status:'building',progress:Math.max(1,Math.min(99,Number(data.progress||0))),error:''});
      await wait(4000);
    }
    throw new Error('The mesh is still taking longer than expected. Tap Check 3D Status to continue.');
  }

  async function buildMesh(index:number){
    const asset=assets[index];
    if(!asset) return;
    updateMesh(index,{status:'starting',progress:1,error:''});
    try{
      const response=await fetch('/api/creator-pack/mesh',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId,index,image:asset.dataUrl,name:asset.name,idea:brief.idea,forceRestart:meshes[index]?.status==='error'})});
      const data=await response.json();
      if(!response.ok||!data.taskId) throw new Error(data.error||'Could not start the 3D mesh.');
      updateMesh(index,{status:'building',progress:2,taskId:data.taskId,error:''});
      try{const cached=await readCachedPack(sessionId);if(cached){cached.taskIds[index]=data.taskId;await writeCachedPack(sessionId,cached);}}catch{}
      await pollMesh(index,data.taskId);
    }catch(err){updateMesh(index,{status:'error',error:err instanceof Error?err.message:'3D mesh generation failed.'});}
  }

  async function downloadZip(){
    if(assets.length!==3)return;
    setPackaging(true);setMessage('Packaging your images and completed GLB files…');
    try{
      const encoder=new TextEncoder();const files:{name:string;data:Uint8Array}[]=[];
      for(const asset of assets){const response=await fetch(asset.dataUrl);files.push({name:`images/${asset.name}.jpg`,data:bytes(await response.arrayBuffer())});}
      const missing:string[]=[];
      for(let index=0;index<meshes.length;index++){
        const mesh=meshes[index];
        if(mesh.status!=='ready'||!mesh.modelUrl){missing.push(assets[index].name);continue;}
        try{const response=await fetch(mesh.modelUrl);if(!response.ok)throw new Error();files.push({name:`models/${assets[index].name}.glb`,data:bytes(await response.arrayBuffer())});}
        catch{missing.push(assets[index].name);}
      }
      files.push({name:'manifest.json',data:encoder.encode(JSON.stringify({product:'VoxelPop 3D Pack',theme:brief.idea,style:brief.style,assets:assets.map((asset,index)=>({name:asset.name,meshReady:meshes[index].status==='ready'}))},null,2))});
      files.push({name:'README.txt',data:encoder.encode(`VOXELPOP 3D PACK\n\nThree generated source images and completed GLB models. Drag the models in the VoxelPop viewer to inspect them. GLB files work with Blender, Unity, Unreal, Roblox workflows and other compatible 3D tools.\n${missing.length?`\nThese GLB files could not be added to this ZIP: ${missing.join(', ')}. Use their individual Download GLB buttons while the purchase page is open.\n`:''}`)});
      files.push({name:'LICENSE.txt',data:encoder.encode('VOXELPOP GENERATED ASSET LICENSE\n\nYou may edit and use these generated outputs in personal and commercial finished projects, including games, videos, social content, marketing and client work, subject to applicable law and the AI provider terms.\n\nThis license does not grant rights to third-party trademarks, copyrighted characters, likenesses or material you do not own. You are responsible for having permission to use any uploaded reference.\n\nDo not resell or redistribute this source pack as a competing standalone asset pack. No financial results are promised.\n')});
      files.push({name:'FACEBOOK-AD-COPY.txt',data:encoder.encode(`FACEBOOK AD COPY STARTERS\n\n1. Type one idea. Get three matching 3D voxel models you can rotate, move and download. $3.99 each.\n\n2. Turn a person, pet, product or character into a downloadable VoxelPop 3D pack. Three custom GLB models for $11.97.\n\n3. Stop settling for flat AI pictures. Generate the image, build the mesh and move your creation in real 3D.\n\nTheme used for this pack: ${brief.idea}\n`)});
      saveBlob(zipBytes(files),'voxelpop-3d-pack.zip');
      setMessage(missing.length?'ZIP downloaded. Use the individual GLB buttons for any model the browser could not package.':'Complete 3D pack downloaded.');
    }catch(err){setMessage(err instanceof Error?err.message:'Could not package the ZIP.');}
    finally{setPackaging(false);}
  }

  function resetGeneration(){void removeCachedPack(sessionId);setAssets([]);setMeshes(emptyMeshes());setStatus('ready');setMessage('Adjust the direction, then generate one alternate set.');}

  const readyCount=meshes.filter(mesh=>mesh.status==='ready').length;

  return <main className={styles.page}>
    <nav className={styles.nav}><a href="/"><span>VV</span><b>Voxel Vault</b></a><em>PAYMENT COMPLETE</em></nav>
    <section className={styles.shell}>
      <div className={styles.header}><p>YOUR VOXELPOP PACK</p><h1>{status==='done'?'Make them move.':'Now make it yours.'}</h1><span>{status==='done'?'Build each generated image into a real 3D mesh, drag to inspect it, then download the complete pack.':'Confirm the direction below. The generator will create three matching, 3D-ready voxel images from it.'}</span></div>
      {status!=='done'&&<div className={styles.builder}>
        <label><b>Describe the person, character, product, pet or object</b><textarea maxLength={600} value={brief.idea} onChange={e=>setBrief(v=>({...v,idea:e.target.value}))}/></label>
        <div className={styles.styles}><b>Finish</b><div>{[['polished','Polished'],['chunky','Chunky'],['cute','Cute'],['dark','Dark fantasy']].map(([value,label])=><button type="button" key={value} className={brief.style===value?styles.active:''} onClick={()=>setBrief(v=>({...v,style:value}))}>{label}</button>)}</div></div>
        <label className={styles.upload}><input type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseReference}/>{brief.reference?<img src={brief.reference} alt="Reference preview"/>:<span>＋</span>}<div><b>{brief.referenceName||'Optional reference image'}</b><small>{brief.reference?'Tap to replace it':'Add a photo, sketch, product, pet or character you have permission to use'}</small></div></label>
        <button className={styles.generate} disabled={status==='generating'} onClick={generate}>{status==='generating'?'Generating three 3D-ready images…':'Generate my 3 voxels'}</button><small className={styles.note}>Better source images make better meshes. Generation may take a few minutes; keep this tab open.</small>
      </div>}
      {message&&<div className={`${styles.message} ${status==='error'?styles.messageError:''}`}>{status==='generating'&&<i/>}{message}</div>}
      {status==='done'&&<>
        <div className={styles.resultTop}><div className={styles.sourceSummary}><p>GENERATED FROM YOUR PROMPT</p><h2>3 images.<br/>3 real meshes.</h2><span>Build each mesh separately so you can inspect the result before downloading it.</span><div><b>{readyCount}/3</b><small>3D models ready</small></div></div><div className={styles.downloadCard}><p>COMPLETE DOWNLOAD</p><h2>Your VoxelPop<br/>3D pack.</h2><ul><li>3 high-quality source images</li><li>Every completed GLB model</li><li>Movable browser previews</li><li>Manifest + commercial-use license</li><li>Bonus Facebook ad copy</li></ul><button onClick={downloadZip} disabled={packaging}>{packaging?'Packaging your pack…':`Download pack · ${readyCount}/3 GLBs ready`}</button>{generationsLeft>0&&<button className={styles.retry} onClick={resetGeneration}>Try one alternate image set</button>}</div></div>
        <div className={styles.assetHeader}><div><p>GENERATE → MESH → MOVE</p><h2>Your three voxels</h2></div><span>Each mesh can take several minutes. You can start all three and leave this tab open.</span></div>
        <div className={styles.meshGrid}>{assets.map((asset,index)=>{
          const mesh=meshes[index];
          const downloadQuery=mesh.taskId?new URLSearchParams({sessionId,taskId:mesh.taskId,download:'1'}).toString():'';
          return <article className={styles.meshCard} key={asset.name}>
            <div className={styles.meshCardTop}><b>{String(index+1).padStart(2,'0')}</b><span>{asset.name.replaceAll('-',' ')}</span></div>
            {mesh.status==='ready'&&mesh.modelUrl?<GeneratedMeshViewer url={mesh.modelUrl} label={asset.name}/>:<div className={styles.sourceImage}><img src={asset.dataUrl} alt={`Generated ${asset.name.replaceAll('-',' ')}`}/>{['starting','building'].includes(mesh.status)&&<div className={styles.meshProgress}><i style={{width:`${Math.max(4,mesh.progress)}%`}}/><b>{mesh.status==='starting'?'Starting 3D build':`Building mesh · ${mesh.progress}%`}</b></div>}</div>}
            <div className={styles.meshActions}>
              {mesh.status==='idle'&&<button onClick={()=>buildMesh(index)}>Build 3D Mesh</button>}
              {['starting','building'].includes(mesh.status)&&<button disabled>Building 3D Mesh…</button>}
              {mesh.status==='error'&&<><p>{mesh.error}</p><button onClick={()=>buildMesh(index)}>{mesh.taskId?'Retry / Check 3D Mesh':'Retry 3D Mesh'}</button></>}
              {mesh.status==='ready'&&<><a href={`/api/creator-pack/mesh?${downloadQuery}`}>Download GLB</a><a className={styles.secondaryDownload} href={asset.dataUrl} download={`${asset.name}.jpg`}>Download image</a></>}
            </div>
          </article>;
        })}</div>
      </>}
      <footer><a href="/">← Back to Voxel Vault</a><span>AI-generated output can vary. Inspect every asset before production use.</span></footer>
    </section>
  </main>;
}
