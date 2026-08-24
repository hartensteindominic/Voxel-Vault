import { NextResponse } from 'next/server';
import { stripe } from '../../../../lib/stripe-server';

export const runtime = 'nodejs';
export const maxDuration = 300;

const styleDirections: Record<string,string> = {
  polished: 'premium high-detail voxel art, crisp block geometry, realistic materials, clean readable silhouette',
  chunky: 'chunky low-poly voxel art, bold block shapes, readable silhouette, playful game-asset proportions',
  cute: 'cute friendly voxel art, rounded blocky proportions, charming expression, bright cohesive palette',
  dark: 'dark-fantasy voxel art, dramatic materials, moody jewel-tone palette, crisp readable silhouette',
};

type AIConfig={key:string;base:string;imageModels:string[]};

function aiConfigs(request:Request):AIConfig[]{
  const configs:AIConfig[]=[];
  if(process.env.OPENAI_API_KEY) configs.push({key:process.env.OPENAI_API_KEY,base:'https://api.openai.com/v1',imageModels:['gpt-image-1']});
  const gatewayKey=process.env.AI_GATEWAY_API_KEY || request.headers.get('x-vercel-oidc-token') || process.env.VERCEL_OIDC_TOKEN;
  if(gatewayKey) configs.push({key:gatewayKey,base:'https://ai-gateway.vercel.sh/v1',imageModels:['openai/gpt-image-1']});
  return configs;
}

async function generateImage(config:AIConfig,prompt:string){
  let last='';
  for(const model of config.imageModels){
    try{
      const response=await fetch(`${config.base}/images/generations`,{
        method:'POST',
        headers:{Authorization:`Bearer ${config.key}`,'Content-Type':'application/json'},
        body:JSON.stringify({model,prompt,n:1,size:'1024x1024',quality:'medium'})
      });
      if(!response.ok){last=`${model} ${response.status}: ${(await response.text()).slice(0,700)}`;console.error('VoxelPop image model failed',config.base,last);continue;}
      const generated=await response.json();
      const item=generated?.data?.[0];
      if(item?.b64_json) return `data:image/png;base64,${item.b64_json}`;
      if(item?.url){
        const imageResponse=await fetch(item.url,{cache:'no-store'});
        if(imageResponse.ok){const bytes=Buffer.from(await imageResponse.arrayBuffer());return `data:${imageResponse.headers.get('content-type')||'image/png'};base64,${bytes.toString('base64')}`;}
      }
      last=`${model}: empty image response`;
    }catch(error){last=error instanceof Error?error.message:String(error);console.error('VoxelPop image request failed',model,last);}
  }
  throw new Error(last||'No image model returned an asset');
}

export async function POST(request:Request){
  try{
    const body=await request.json();
    const sessionId=typeof body?.sessionId==='string'?body.sessionId:'';
    const idea=typeof body?.idea==='string'?body.idea.trim().slice(0,600):'';
    const style=typeof body?.style==='string'?body.style:'polished';
    if(!sessionId||idea.length<3) return NextResponse.json({error:'A purchase and a description are required.'},{status:400});

    const session=await stripe.checkout.sessions.retrieve(sessionId);
    if(session.payment_status!=='paid'||session.metadata?.product!=='voxelpop-3d-asset') return NextResponse.json({error:'A completed VoxelPop 3D Asset purchase is required.'},{status:403});
    if(Number(session.metadata?.generations||0)>=1) return NextResponse.json({error:'This purchase has already generated its voxel. Return to this purchase on the same device to continue building or downloading its 3D mesh.'},{status:409});

    const configs=aiConfigs(request);
    if(!configs.length) return NextResponse.json({error:'VoxelPop image generation is not configured on this deployment. Add OPENAI_API_KEY or AI_GATEWAY_API_KEY in Vercel; your purchase remains valid.'},{status:503});

    const finish=styleDirections[style]||styleDirections.polished;
    const prompt=`Create ONE complete 3D voxel game asset of: ${idea}. Visual direction: ${finish}. Front three-quarter view, whole subject visible, centered with generous padding. Strong readable voxel/block geometry and depth. Isolated subject only on a plain white background. No scene, floor, platform, border, text, letters, numbers, logo or watermark. This image will be used for image-to-3D reconstruction, so keep all major forms distinct and visible.`;

    let lastError='';
    for(const config of configs){
      try{
        const image=await generateImage(config,prompt);
        await stripe.checkout.sessions.update(sessionId,{metadata:{...(session.metadata||{}),generations:'1'}});
        return NextResponse.json({images:[image],names:['your-voxel'],theme:idea,generationsLeft:0});
      }catch(error){lastError=error instanceof Error?error.message:String(error);console.error('VoxelPop provider failed',config.base,lastError.slice(0,1000));}
    }

    console.error('All VoxelPop image providers failed',lastError.slice(0,1200));
    return NextResponse.json({error:'Voxel generation is temporarily unavailable. Your purchase is still valid and has not been used. Please retry.'},{status:502});
  }catch(error){
    console.error('custom 3D voxel generation failed',error);
    return NextResponse.json({error:'Unable to generate your voxel right now. Your purchase is still valid; please retry.'},{status:500});
  }
}
