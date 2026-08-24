'use client';

import { useEffect, useState } from 'react';
import type { ChangeEvent } from 'react';
import styles from './success.module.css';

type AssetFile={name:string;blob:Blob;url:string};
type Brief={idea:string;style:string;reference:string;referenceName?:string};

const defaultBrief:Brief={idea:'Cozy medieval fantasy adventure with warm lantern light, mossy stone and emerald accents',style:'polished',reference:''};

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

function canvasBlob(canvas:HTMLCanvasElement){
  return new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Could not export an asset.')),'image/png'));
}

async function splitSheet(dataUrl:string,names:string[]){
  const source=await fetch(dataUrl).then(r=>r.blob());
  const bitmap=await createImageBitmap(source);
  const files:AssetFile[]=[];
  for(let row=0;row<5;row++){
    for(let col=0;col<5;col++){
      const index=row*5+col;
      const sx=Math.round(col*bitmap.width/5);
      const sy=Math.round(row*bitmap.height/5);
      const ex=Math.round((col+1)*bitmap.width/5);
      const ey=Math.round((row+1)*bitmap.height/5);
      const canvas=document.createElement('canvas');
      canvas.width=256; canvas.height=256;
      const ctx=canvas.getContext('2d');
      if(!ctx) throw new Error('Your browser cannot separate the sprite sheet.');
      ctx.clearRect(0,0,256,256);
      ctx.drawImage(bitmap,sx,sy,ex-sx,ey-sy,0,0,256,256);
      const blob=await canvasBlob(canvas);
      const name=`${String(index+1).padStart(2,'0')}-${names[index]||`asset-${index+1}`}.png`;
      files.push({name,blob,url:URL.createObjectURL(blob)});
    }
  }
  bitmap.close?.();
  return files;
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

export default function PackBuilder({sessionId}:{sessionId:string}){
  const [brief,setBrief]=useState<Brief>(defaultBrief);
  const [status,setStatus]=useState<'ready'|'generating'|'done'|'error'>('ready');
  const [message,setMessage]=useState('');
  const [sheet,setSheet]=useState('');
  const [assets,setAssets]=useState<AssetFile[]>([]);
  const [names,setNames]=useState<string[]>([]);
  const [generationsLeft,setGenerationsLeft]=useState(1);

  useEffect(()=>{try{const stored=sessionStorage.getItem('voxelPackBrief');if(stored)setBrief({...defaultBrief,...JSON.parse(stored)});}catch{}},[]);

  async function chooseReference(event:ChangeEvent<HTMLInputElement>){
    const file=event.target.files?.[0];if(!file)return;
    try{setMessage('');setBrief(v=>({...v,referenceName:file.name,reference:''}));const data=await compressReference(file);setBrief(v=>({...v,reference:data,referenceName:file.name}));}
    catch(err){setMessage(err instanceof Error?err.message:'Could not read that image.');}
  }

  async function generate(){
    if(!sessionId){setStatus('error');setMessage('Checkout session missing. Return to the product page and use the purchase link again.');return;}
    if(brief.idea.trim().length<8){setStatus('error');setMessage('Add a short description of the pack you want.');return;}
    setStatus('generating');setMessage('Designing one consistent world, then building the 25-piece sheet…');
    try{
      const response=await fetch('/api/creator-pack/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId,idea:brief.idea.trim(),style:brief.style,reference:brief.reference})});
      const data=await response.json();if(!response.ok||!data.image)throw new Error(data.error||'Generation failed.');
      assets.forEach(a=>URL.revokeObjectURL(a.url));const separated=await splitSheet(data.image,data.names||[]);
      setSheet(data.image);setNames(data.names||[]);setAssets(separated);setGenerationsLeft(data.generationsLeft||0);setStatus('done');setMessage('Your pack is ready — 25 PNGs have been separated from the master sheet.');
    }catch(err){setStatus('error');setMessage(err instanceof Error?err.message:'Generation failed.');}
  }

  async function downloadZip(){
    if(!sheet||assets.length!==25)return;setMessage('Packaging your ZIP…');
    const encoder=new TextEncoder();const files:{name:string;data:Uint8Array}[]=[];
    for(const asset of assets){const buffer=await asset.blob.arrayBuffer();files.push({name:`assets/${asset.name}`,data:bytes(buffer)});}
    const sheetResponse=await fetch(sheet);const sheetBuffer=await sheetResponse.arrayBuffer();files.push({name:'master-sheet.png',data:bytes(sheetBuffer)});
    files.push({name:'manifest.json',data:encoder.encode(JSON.stringify({product:'Voxel Vault Custom AI Pack',theme:brief.idea,style:brief.style,assets:names},null,2))});
    files.push({name:'README.txt',data:encoder.encode('VOXEL VAULT CUSTOM AI PACK\n\n25 transparent PNG assets + master sheet. Assets are generated as a coordinated collection and separated from a 5x5 master sheet. Because generative output can vary, inspect each file before production use.\n')});
    files.push({name:'LICENSE.txt',data:encoder.encode('CUSTOM AI ASSET PACK LICENSE\n\nYou may edit and use these generated outputs in personal and commercial finished projects, including games, videos, social content, marketing and client work, subject to applicable law and the AI provider terms.\n\nThis license does not grant rights to third-party trademarks, copyrighted characters, likenesses or other material you do not own. You are responsible for having permission to use any reference material you upload.\n\nDo not resell or redistribute this source pack as a competing standalone asset pack. No financial results are promised.\n')});
    files.push({name:'FACEBOOK-AD-COPY.txt',data:encoder.encode(`FACEBOOK AD COPY STARTERS\n\n1. Turn one idea into a whole visual world. Create a custom 25-piece voxel asset pack from words or a reference image. One pack, one ZIP, $15.\n\n2. Stop hunting for assets that almost match. Build 25 coordinated voxel-style PNGs around your own theme for $15.\n\n3. Game idea? Mascot? Product? Pet? Describe it and get a matching 25-asset voxel pack ready for your next project.\n\nTheme used for this pack: ${brief.idea}\n`)});
    saveBlob(zipBytes(files),'voxel-vault-custom-25-asset-pack.zip');setMessage('ZIP downloaded. Keep it somewhere safe.');
  }

  return <main className={styles.page}>
    <nav className={styles.nav}><a href="/"><span>VV</span><b>Voxel Vault</b></a><em>PAYMENT COMPLETE</em></nav>
    <section className={styles.shell}>
      <div className={styles.header}><p>YOUR CUSTOM PACK</p><h1>{status==='done'?'Your tiny world is ready.':'Now make it yours.'}</h1><span>{status==='done'?'Preview the separated assets below, then download the complete ZIP.':'Confirm the direction below. The generator will create one coordinated 25-piece pack from it.'}</span></div>
      {status!=='done'&&<div className={styles.builder}>
        <label><b>Describe your world or subject</b><textarea maxLength={600} value={brief.idea} onChange={e=>setBrief(v=>({...v,idea:e.target.value}))}/></label>
        <div className={styles.styles}><b>Finish</b><div>{[['polished','Polished'],['chunky','Chunky'],['cute','Cute'],['dark','Dark fantasy']].map(([value,label])=><button type="button" key={value} className={brief.style===value?styles.active:''} onClick={()=>setBrief(v=>({...v,style:value}))}>{label}</button>)}</div></div>
        <label className={styles.upload}><input type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseReference}/>{brief.reference?<img src={brief.reference} alt="Reference preview"/>:<span>＋</span>}<div><b>{brief.referenceName||'Optional reference image'}</b><small>{brief.reference?'Tap to replace it':'Add a photo, sketch, product, pet or character you have permission to use'}</small></div></label>
        <button className={styles.generate} disabled={status==='generating'} onClick={generate}>{status==='generating'?'Generating your 25 assets…':'Generate my pack'}</button><small className={styles.note}>Generation can take around a minute. Keep this tab open.</small>
      </div>}
      {message&&<div className={`${styles.message} ${status==='error'?styles.messageError:''}`}>{status==='generating'&&<i/>}{message}</div>}
      {status==='done'&&<>
        <div className={styles.resultTop}><div className={styles.master}><span>MASTER SHEET</span><img src={sheet} alt="Generated 25-asset master sheet"/></div><div className={styles.downloadCard}><p>COMPLETE DOWNLOAD</p><h2>25 PNGs.<br/>One ZIP.</h2><ul><li>25 separated transparent PNG files</li><li>Original master sheet</li><li>Manifest + README</li><li>Commercial-use license</li><li>Bonus Facebook ad copy</li></ul><button onClick={downloadZip}>Download complete ZIP</button>{generationsLeft>0&&<button className={styles.retry} onClick={()=>setStatus('ready')}>Try one alternate generation</button>}</div></div>
        <div className={styles.assetHeader}><div><p>SEPARATED FILES</p><h2>All 25 assets</h2></div><span>Tap any asset to save it individually.</span></div>
        <div className={styles.grid}>{assets.map((asset,index)=><a href={asset.url} download={asset.name} key={asset.name}><b>{String(index+1).padStart(2,'0')}</b><img src={asset.url} alt={names[index]?.replaceAll('-',' ')||`Asset ${index+1}`}/><small>{names[index]?.replaceAll('-',' ')}</small></a>)}</div>
      </>}
      <footer><a href="/">← Back to Voxel Vault</a><span>AI-generated output can vary. Inspect assets before production use.</span></footer>
    </section>
  </main>;
}
