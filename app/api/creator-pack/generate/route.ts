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

type AIConfig={key:string;base:string;vision:string;image:string};

function aiConfigs(request:Request):AIConfig[]{
  const configs:AIConfig[]=[];
  // Prefer a direct OpenAI key when present. It is the most reliable path for the Images API.
  if(process.env.OPENAI_API_KEY) configs.push({key:process.env.OPENAI_API_KEY,base:'https://api.openai.com/v1',vision:'gpt-5.4-mini',image:'gpt-image-1-mini'});
  const gatewayKey=process.env.AI_GATEWAY_API_KEY || request.headers.get('x-vercel-oidc-token') || process.env.VERCEL_OIDC_TOKEN;
  if(gatewayKey) configs.push({key:gatewayKey,base:'https://ai-gateway.vercel.sh/v1',vision:'openai/gpt-5.4-mini',image:'openai/gpt-image-1-mini'});
  return configs;
}

async function describeReference(config:AIConfig,image:string){
  const response=await fetch(`${config.base}/chat/completions`,{method:'POST',headers:{Authorization:`Bearer ${config.key}`,'Content-Type':'application/json'},body:JSON.stringify({model:config.vision,messages:[{role:'user',content:[{type:'text',text:'Describe this reference for a 3D character or object artist. Focus on subject identity, complete silhouette, proportions, pose, clothing or construction, materials, colors and distinctive details. Do not identify private people. Keep it under 160 words.'},{type:'image_url',image_url:{url:image,detail:'low'}}]}]})});
  if(!response.ok){console.error('reference analysis failed',response.status,(await response.text()).slice(0,500));return '';}
  const json=await response.json(); return String(json?.choices?.[0]?.message?.content||'').slice(0,1200);
}

async function generateImage(config:AIConfig,prompt:string){
  const response=await fetch(`${config.base}/images/generations`,{method:'POST',headers:{Authorization:`Bearer ${config.key}`,'Content-Type':'application/json'},body:JSON.stringify({model:config.image,prompt,n:1,size:'1024x1024',quality:'medium',background:'opaque',output_format:'jpeg',output_compression:88})});
  if(!response.ok){const detail=(await response.text()).slice(0,1200);console.error('voxel source generation failed',config.base,response.status,detail);throw new Error(`${response.status}:${detail}`);}
  const generated=await response.json(); const image=generated?.data?.[0]?.b64_json;
  if(!image) throw new Error('empty image response');
  return `data:image/jpeg;base64,${image}`;
}

export async function POST(request:Request){
  try{
    const body=await request.json(); const sessionId=typeof body?.sessionId==='string'?body.sessionId:''; const idea=typeof body?.idea==='string'?body.idea.trim().slice(0,600):''; const style=typeof body?.style==='string'?body.style:'polished'; const reference=typeof body?.reference==='string'?body.reference:'';
    if(!sessionId||idea.length<8) return NextResponse.json({error:'A purchase and a short description are required.'},{status:400});
    if(reference && (!reference.startsWith('data:image/') || reference.length>2_500_000)) return NextResponse.json({error:'The reference image is too large. Please choose a smaller image.'},{status:400});
    const session=await stripe.checkout.sessions.retrieve(sessionId);
    if(session.payment_status!=='paid'||session.metadata?.product!=='voxelpop-3d-asset') return NextResponse.json({error:'A completed VoxelPop 3D Asset purchase is required.'},{status:403});
    if(Number(session.metadata?.generations||0)>=1) return NextResponse.json({error:'This purchase has already generated its voxel. You can continue building or downloading its 3D mesh.'},{status:409});

    const configs=aiConfigs(request);
    if(!configs.length) return NextResponse.json({error:'AI generation is not configured on this deployment yet. Your payment is safe; please contact support before retrying.'},{status:503});
    const finish=styleDirections[style]||styleDirections.polished;
    let lastError='';
    for(const config of configs){
      try{
        const referenceNotes=reference?await describeReference(config,reference):'';
        const identity=`Requested subject: ${idea}. ${referenceNotes?`Reference-image identity and art direction: ${referenceNotes}.`:''}`;
        const prompt=`Create the definitive version of this requested subject. ${identity}\n\nRender a SINGLE complete subject as a real 3D voxel collectible suitable for image-to-3D reconstruction. Visual direction: ${finish}. Use a front three-quarter camera view at eye level with the entire subject visible from top to bottom and generous padding on every side. Show one isolated subject only. Keep limbs, accessories and silhouette separated and readable. Use balanced studio lighting that reveals depth without a cast shadow. Plain white background. No scene, floor, platform, border, text, letters, numbers, logo or watermark.`;
        const image=await generateImage(config,prompt);
        await stripe.checkout.sessions.update(sessionId,{metadata:{...(session.metadata||{}),generations:'1'}});
        return NextResponse.json({images:[image],names:['your-voxel'],theme:idea,generationsLeft:0});
      }catch(error){lastError=error instanceof Error?error.message:String(error);console.error('VoxelPop provider attempt failed',config.base,lastError.slice(0,1000));}
    }
    console.error('All VoxelPop image providers failed',lastError.slice(0,1200));
    return NextResponse.json({error:'The voxel generator is temporarily unavailable. Your purchase is still valid—please tap Generate my voxel again in a moment.'},{status:502});
  }catch(error){console.error('custom 3D voxel generation failed',error);return NextResponse.json({error:'Unable to generate your voxel right now. Your purchase is still valid; please retry.'},{status:500});}
}
