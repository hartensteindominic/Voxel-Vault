import { NextResponse } from 'next/server';
import { getVoxelPopEntitlement, updateVoxelPopEntitlementMetadata } from '../../../../lib/voxelpop-entitlement';
import { attributionFromMetadata, recordVoxelPopEvent } from '../../../../lib/voxelpop-analytics';

export const runtime = 'nodejs';
export const maxDuration = 300;

const MESHY_TEXT_TO_IMAGE='https://api.meshy.ai/openapi/v1/text-to-image';
const MESHY_IMAGE_TO_IMAGE='https://api.meshy.ai/openapi/v1/image-to-image';
const MAX_GENERATIONS=3;
const wait=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));

const styleDirections: Record<string,string> = {
  polished: 'premium high-detail voxel art, crisp block geometry, realistic materials, clean readable silhouette',
  chunky: 'chunky low-poly voxel art, bold block shapes, readable silhouette, playful game-asset proportions',
  cute: 'cute friendly voxel art, rounded blocky proportions, charming expression, bright cohesive palette',
  dark: 'dark-fantasy voxel art, dramatic materials, moody jewel-tone palette, crisp readable silhouette',
};

async function imageUrlToDataUri(url:string){const response=await fetch(url,{cache:'no-store'});if(!response.ok)throw new Error(`Could not download generated image (${response.status}).`);const data=Buffer.from(await response.arrayBuffer());const type=response.headers.get('content-type')||'image/png';return `data:${type};base64,${data.toString('base64')}`;}

async function generateWithMeshy(apiKey:string,prompt:string,reference:string){
  const endpoint=reference?MESHY_IMAGE_TO_IMAGE:MESHY_TEXT_TO_IMAGE;
  const payload=reference?{ai_model:'nano-banana',prompt,reference_image_urls:[reference],aspect_ratio:'1:1',remove_background:false}:{ai_model:'nano-banana',prompt,aspect_ratio:'1:1',remove_background:false};
  const create=await fetch(endpoint,{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify(payload),cache:'no-store'});const created=await create.json().catch(()=>({}));if(!create.ok)throw new Error(String(created?.message||created?.error||`Meshy returned ${create.status}`));const taskId=String(created?.result||'');if(!taskId)throw new Error('Meshy did not return an image task ID.');
  for(let attempt=0;attempt<100;attempt++){const statusResponse=await fetch(`${endpoint}/${encodeURIComponent(taskId)}`,{headers:{Authorization:`Bearer ${apiKey}`},cache:'no-store'});const task=await statusResponse.json().catch(()=>({}));if(!statusResponse.ok)throw new Error(String(task?.message||task?.error||`Could not read Meshy image task (${statusResponse.status}).`));const status=String(task?.status||'').toUpperCase();if(status==='SUCCEEDED'){const url=Array.isArray(task?.image_urls)?String(task.image_urls[0]||''):'';if(!url)throw new Error('Meshy completed without returning an image URL.');return imageUrlToDataUri(url);}if(['FAILED','EXPIRED','CANCELED','CANCELLED'].includes(status))throw new Error(String(task?.task_error?.message||task?.message||'Meshy could not generate this voxel image.'));await wait(2000)}throw new Error('Meshy image generation took too long. Please retry.');
}

async function generateWithOpenAI(prompt:string){const key=process.env.OPENAI_API_KEY;if(!key)throw new Error('OpenAI fallback is not configured.');const response=await fetch('https://api.openai.com/v1/images/generations',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model:'gpt-image-2',prompt,n:1,size:'1024x1024',quality:'medium'})});const result=await response.json().catch(()=>({}));if(!response.ok)throw new Error(String(result?.error?.message||`OpenAI returned ${response.status}`));const item=result?.data?.[0];if(item?.b64_json)return `data:image/png;base64,${item.b64_json}`;if(item?.url)return imageUrlToDataUri(String(item.url));throw new Error('OpenAI returned an empty image.');}

export async function POST(request:Request){
 try{
  const body=await request.json();const sessionId=typeof body?.sessionId==='string'?body.sessionId:'';const idea=typeof body?.idea==='string'?body.idea.trim().slice(0,600):'';const style=typeof body?.style==='string'?body.style:'polished';const reference=typeof body?.reference==='string'?body.reference:'';const improve=body?.improve===true;
  if(!sessionId||idea.length<3)return NextResponse.json({error:'A purchase and a description are required.'},{status:400});
  if(reference&&(!reference.startsWith('data:image/')||reference.length>4_000_000))return NextResponse.json({error:'The reference image is too large. Please choose a smaller image.'},{status:400});
  const entitlement=await getVoxelPopEntitlement(sessionId);if(!entitlement)return NextResponse.json({error:'A completed VoxelPop 3D Asset purchase is required.'},{status:403});
  const attribution=attributionFromMetadata(entitlement.metadata);const flowId=entitlement.metadata?.flow_id||null;
  await recordVoxelPopEvent({eventName:'purchase_completed',eventKey:`purchase_completed:${entitlement.paymentMethod}:${entitlement.id}`,flowId,stripeSessionId:entitlement.paymentMethod==='stripe'?entitlement.id:null,attribution,details:{amount_cents:entitlement.amountCents,currency:entitlement.currency,payment_method:entitlement.paymentMethod}});
  const used=Math.max(0,Number(entitlement.metadata?.generations||0));if(used>=MAX_GENERATIONS)return NextResponse.json({error:'You have used all 3 voxel versions included with this purchase.'},{status:409});
  const generationNumber=used+1;
  await recordVoxelPopEvent({eventName:'image_generation_started',eventKey:`image_generation_started:${sessionId}:${generationNumber}`,flowId,stripeSessionId:entitlement.paymentMethod==='stripe'?entitlement.id:null,attribution,details:{generation:generationNumber,improve,style,payment_method:entitlement.paymentMethod}});
  const finish=styleDirections[style]||styleDirections.polished;
  const improvement=improve&&reference?' Improve the supplied voxel into a stronger version while preserving the same subject, identity, colors and core design. Fix awkward geometry, make the silhouette cleaner, make block shapes more intentional and separated, improve symmetry where appropriate, and make it especially suitable for accurate image-to-3D reconstruction. Do not merely copy the image; refine it.':'';
  const prompt=`Create ONE complete 3D voxel game asset of: ${idea}. Visual direction: ${finish}.${improvement} Front three-quarter view, whole subject visible, centered with generous padding. Strong readable voxel/block geometry and depth. Isolated subject only on a plain white background. No scene, floor, platform, border, text, letters, numbers, logo or watermark. Keep all major forms distinct and visible for image-to-3D reconstruction.`;
  let image='',lastError='';const meshyKey=process.env.MESHY_API_KEY;if(meshyKey){try{image=await generateWithMeshy(meshyKey,prompt,reference)}catch(error){lastError=error instanceof Error?error.message:String(error);console.error('Meshy image generation failed',lastError.slice(0,1000))}}if(!image){try{image=await generateWithOpenAI(prompt)}catch(error){lastError=error instanceof Error?error.message:String(error);console.error('OpenAI image fallback failed',lastError.slice(0,1000))}}
  if(!image){await recordVoxelPopEvent({eventName:'image_generation_failed',eventKey:`image_generation_failed:${sessionId}:${generationNumber}`,flowId,stripeSessionId:entitlement.paymentMethod==='stripe'?entitlement.id:null,attribution,details:{generation:generationNumber,improve,style,payment_method:entitlement.paymentMethod}});console.error('All VoxelPop image generation paths failed',lastError.slice(0,1200));return NextResponse.json({error:'Voxel generation could not finish. Your purchase is still valid and this attempt was not used. Please retry.'},{status:502})}
  const generations=used+1;await updateVoxelPopEntitlementMetadata(entitlement,{generations:String(generations)});await recordVoxelPopEvent({eventName:'image_generated',eventKey:`image_generated:${sessionId}:${generations}`,flowId,stripeSessionId:entitlement.paymentMethod==='stripe'?entitlement.id:null,attribution,details:{generation:generations,improve,style,payment_method:entitlement.paymentMethod}});return NextResponse.json({images:[image],names:['your-voxel'],theme:idea,generationsLeft:Math.max(0,MAX_GENERATIONS-generations),generation:generations});
 }catch(error){console.error('custom 3D voxel generation failed',error);return NextResponse.json({error:'Unable to generate your voxel right now. Your purchase is still valid; please retry.'},{status:500})}
}
