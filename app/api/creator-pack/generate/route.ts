import { NextResponse } from 'next/server';
import { stripe } from '../../../../lib/stripe-server';

export const runtime = 'nodejs';
export const maxDuration = 300;

const MESHY_TEXT_TO_IMAGE='https://api.meshy.ai/openapi/v1/text-to-image';
const MESHY_IMAGE_TO_IMAGE='https://api.meshy.ai/openapi/v1/image-to-image';
const wait=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));

const styleDirections: Record<string,string> = {
  polished: 'premium high-detail voxel art, crisp block geometry, realistic materials, clean readable silhouette',
  chunky: 'chunky low-poly voxel art, bold block shapes, readable silhouette, playful game-asset proportions',
  cute: 'cute friendly voxel art, rounded blocky proportions, charming expression, bright cohesive palette',
  dark: 'dark-fantasy voxel art, dramatic materials, moody jewel-tone palette, crisp readable silhouette',
};

async function imageUrlToDataUri(url:string){
  const response=await fetch(url,{cache:'no-store'});
  if(!response.ok) throw new Error(`Could not download generated image (${response.status}).`);
  const data=Buffer.from(await response.arrayBuffer());
  const type=response.headers.get('content-type')||'image/png';
  return `data:${type};base64,${data.toString('base64')}`;
}

async function generateWithMeshy(apiKey:string,prompt:string,reference:string){
  const endpoint=reference?MESHY_IMAGE_TO_IMAGE:MESHY_TEXT_TO_IMAGE;
  const payload=reference
    ? {ai_model:'nano-banana',prompt,reference_image_urls:[reference],aspect_ratio:'1:1',remove_background:false}
    : {ai_model:'nano-banana',prompt,aspect_ratio:'1:1',remove_background:false};

  const create=await fetch(endpoint,{
    method:'POST',
    headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},
    body:JSON.stringify(payload),
    cache:'no-store',
  });
  const created=await create.json().catch(()=>({}));
  if(!create.ok){
    const detail=String(created?.message||created?.error||`Meshy returned ${create.status}`);
    throw new Error(detail);
  }
  const taskId=String(created?.result||'');
  if(!taskId) throw new Error('Meshy did not return an image task ID.');

  for(let attempt=0;attempt<100;attempt++){
    const statusResponse=await fetch(`${endpoint}/${encodeURIComponent(taskId)}`,{
      headers:{Authorization:`Bearer ${apiKey}`},cache:'no-store'
    });
    const task=await statusResponse.json().catch(()=>({}));
    if(!statusResponse.ok) throw new Error(String(task?.message||task?.error||`Could not read Meshy image task (${statusResponse.status}).`));
    const status=String(task?.status||'').toUpperCase();
    if(status==='SUCCEEDED'){
      const url=Array.isArray(task?.image_urls)?String(task.image_urls[0]||''):'';
      if(!url) throw new Error('Meshy completed without returning an image URL.');
      return imageUrlToDataUri(url);
    }
    if(['FAILED','EXPIRED','CANCELED','CANCELLED'].includes(status)){
      throw new Error(String(task?.task_error?.message||task?.message||'Meshy could not generate this voxel image.'));
    }
    await wait(2000);
  }
  throw new Error('Meshy image generation took too long. Please retry.');
}

async function generateWithOpenAI(prompt:string){
  const key=process.env.OPENAI_API_KEY;
  if(!key) throw new Error('OpenAI fallback is not configured.');
  const response=await fetch('https://api.openai.com/v1/images/generations',{
    method:'POST',
    headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
    body:JSON.stringify({model:'gpt-image-2',prompt,n:1,size:'1024x1024',quality:'medium'}),
  });
  const result=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(String(result?.error?.message||`OpenAI returned ${response.status}`));
  const item=result?.data?.[0];
  if(item?.b64_json) return `data:image/png;base64,${item.b64_json}`;
  if(item?.url) return imageUrlToDataUri(String(item.url));
  throw new Error('OpenAI returned an empty image.');
}

export async function POST(request:Request){
  try{
    const body=await request.json();
    const sessionId=typeof body?.sessionId==='string'?body.sessionId:'';
    const idea=typeof body?.idea==='string'?body.idea.trim().slice(0,600):'';
    const style=typeof body?.style==='string'?body.style:'polished';
    const reference=typeof body?.reference==='string'?body.reference:'';
    if(!sessionId||idea.length<3) return NextResponse.json({error:'A purchase and a description are required.'},{status:400});
    if(reference && (!reference.startsWith('data:image/')||reference.length>2_500_000)) return NextResponse.json({error:'The reference image is too large. Please choose a smaller image.'},{status:400});

    const session=await stripe.checkout.sessions.retrieve(sessionId);
    if(session.payment_status!=='paid'||session.metadata?.product!=='voxelpop-3d-asset') return NextResponse.json({error:'A completed VoxelPop 3D Asset purchase is required.'},{status:403});
    if(Number(session.metadata?.generations||0)>=1) return NextResponse.json({error:'This purchase has already generated its voxel. Return to this purchase on the same device to continue building or downloading its 3D mesh.'},{status:409});

    const finish=styleDirections[style]||styleDirections.polished;
    const prompt=`Create ONE complete 3D voxel game asset of: ${idea}. Visual direction: ${finish}. Front three-quarter view, whole subject visible, centered with generous padding. Strong readable voxel/block geometry and depth. Isolated subject only on a plain white background. No scene, floor, platform, border, text, letters, numbers, logo or watermark. This image will be used for image-to-3D reconstruction, so keep all major forms distinct and visible.`;

    let image='';
    let lastError='';
    const meshyKey=process.env.MESHY_API_KEY;
    if(meshyKey){
      try{image=await generateWithMeshy(meshyKey,prompt,reference);}
      catch(error){lastError=error instanceof Error?error.message:String(error);console.error('Meshy image generation failed',lastError.slice(0,1000));}
    }
    if(!image){
      try{image=await generateWithOpenAI(prompt);}
      catch(error){lastError=error instanceof Error?error.message:String(error);console.error('OpenAI image fallback failed',lastError.slice(0,1000));}
    }
    if(!image){
      console.error('All VoxelPop image generation paths failed',lastError.slice(0,1200));
      return NextResponse.json({error:'Voxel generation could not finish. Your purchase is still valid and has not been used. Please retry.'},{status:502});
    }

    await stripe.checkout.sessions.update(sessionId,{metadata:{...(session.metadata||{}),generations:'1'}});
    return NextResponse.json({images:[image],names:['your-voxel'],theme:idea,generationsLeft:0});
  }catch(error){
    console.error('custom 3D voxel generation failed',error);
    return NextResponse.json({error:'Unable to generate your voxel right now. Your purchase is still valid; please retry.'},{status:500});
  }
}
