import { NextResponse } from 'next/server';
import { stripe } from '../../../../lib/stripe-server';

export const runtime = 'nodejs';
export const maxDuration = 300;

const assetDirections = [
  {
    name: 'primary-voxel',
    direction: 'Create the definitive primary version of the requested subject in a clear neutral or natural pose.',
  },
  {
    name: 'matching-variant',
    direction: 'Create a clearly different pose or useful variation of the exact same subject. Preserve identity, colors, outfit, materials and proportions.',
  },
  {
    name: 'collector-variant',
    direction: 'Create a premium third variation of the exact same subject with one tasteful prompt-matched accessory or detail. Preserve identity and the shared design language.',
  },
];

const styleDirections: Record<string,string> = {
  polished: 'premium high-detail voxel art, crisp block geometry, realistic materials, clean readable silhouette',
  chunky: 'chunky low-poly voxel art, bold block shapes, readable silhouette, playful game-asset proportions',
  cute: 'cute friendly voxel art, rounded blocky proportions, charming expression, bright cohesive palette',
  dark: 'dark-fantasy voxel art, dramatic materials, moody jewel-tone palette, crisp readable silhouette',
};

function aiConfig(request:Request){
  const gatewayKey=process.env.AI_GATEWAY_API_KEY || request.headers.get('x-vercel-oidc-token') || process.env.VERCEL_OIDC_TOKEN;
  if(gatewayKey) return { key:gatewayKey, base:'https://ai-gateway.vercel.sh/v1', vision:'openai/gpt-5.4-mini', image:'openai/gpt-image-1-mini' };
  if(process.env.OPENAI_API_KEY) return { key:process.env.OPENAI_API_KEY, base:'https://api.openai.com/v1', vision:'gpt-5.4-mini', image:'gpt-image-1-mini' };
  return null;
}

type AIConfig=NonNullable<ReturnType<typeof aiConfig>>;

async function describeReference(config:AIConfig, image:string){
  const response=await fetch(`${config.base}/chat/completions`,{
    method:'POST',
    headers:{Authorization:`Bearer ${config.key}`,'Content-Type':'application/json'},
    body:JSON.stringify({
      model:config.vision,
      messages:[{role:'user',content:[
        {type:'text',text:'Describe this reference for a 3D character or object artist. Focus on subject identity, complete silhouette, proportions, pose, clothing or construction, materials, colors and distinctive details. Do not identify private people. Keep it under 160 words.'},
        {type:'image_url',image_url:{url:image,detail:'low'}},
      ]}],
    }),
  });
  if(!response.ok){
    const detail=await response.text();
    console.error('reference analysis failed',response.status,detail.slice(0,500));
    return '';
  }
  const json=await response.json();
  return String(json?.choices?.[0]?.message?.content||'').slice(0,1200);
}

async function generateImage(config:AIConfig,prompt:string){
  const response=await fetch(`${config.base}/images/generations`,{
    method:'POST',
    headers:{Authorization:`Bearer ${config.key}`,'Content-Type':'application/json'},
    body:JSON.stringify({
      model:config.image,
      prompt,
      n:1,
      size:'1024x1024',
      quality:'medium',
      background:'opaque',
      output_format:'jpeg',
      output_compression:88,
    }),
  });
  if(!response.ok){
    const detail=await response.text();
    console.error('voxel source generation failed',response.status,detail.slice(0,1000));
    throw new Error('The image generator could not finish all three assets. Please retry once; you will not be charged again.');
  }
  const generated=await response.json();
  const image=generated?.data?.[0]?.b64_json;
  if(!image) throw new Error('The generator returned an empty asset. Please retry.');
  return `data:image/jpeg;base64,${image}`;
}

export async function POST(request:Request){
  try{
    const body=await request.json();
    const sessionId=typeof body?.sessionId==='string'?body.sessionId:'';
    const idea=typeof body?.idea==='string'?body.idea.trim().slice(0,600):'';
    const style=typeof body?.style==='string'?body.style:'polished';
    const reference=typeof body?.reference==='string'?body.reference:'';

    if(!sessionId||idea.length<8) return NextResponse.json({error:'A purchase and a short description are required.'},{status:400});
    if(reference && (!reference.startsWith('data:image/') || reference.length>2_500_000)) return NextResponse.json({error:'The reference image is too large. Please choose a smaller image.'},{status:400});

    const session=await stripe.checkout.sessions.retrieve(sessionId);
    if(session.payment_status!=='paid'||session.metadata?.product!=='ai-voxel-pack-v3') return NextResponse.json({error:'A completed VoxelPop 3D Pack purchase is required.'},{status:403});

    const generations=Number(session.metadata?.generations||0);
    if(generations>=2) return NextResponse.json({error:'This purchase has already used its image-generation allowance. Use the images you generated to build and download the 3D meshes.'},{status:409});

    const config=aiConfig(request);
    if(!config) return NextResponse.json({error:'AI generation is not configured on this deployment yet. Your payment is safe; please contact support before retrying.'},{status:503});

    const referenceNotes=reference?await describeReference(config,reference):'';
    const finish=styleDirections[style]||styleDirections.polished;
    const identity=`Requested subject: ${idea}. ${referenceNotes?`Reference-image identity and art direction: ${referenceNotes}.`:''}`;
    const shared=`${identity}\n\nRender a SINGLE complete subject as a real 3D voxel collectible suitable for image-to-3D reconstruction. Visual direction: ${finish}. Use a front three-quarter camera view at eye level with the entire subject visible from top to bottom and generous padding on every side. Show one isolated subject only. Keep limbs, accessories and silhouette separated and readable. Use balanced studio lighting that reveals depth without a cast shadow. Plain white background. No scene, floor, platform, border, text, letters, numbers, logo or watermark.`;

    const images=await Promise.all(assetDirections.map(asset=>generateImage(config,`${asset.direction}\n\n${shared}`)));

    await stripe.checkout.sessions.update(sessionId,{metadata:{...(session.metadata||{}),generations:String(generations+1)}});
    return NextResponse.json({
      images,
      names:assetDirections.map(asset=>asset.name),
      theme:idea,
      generationsLeft:Math.max(0,1-generations),
    });
  }catch(error){
    console.error('custom 3D voxel pack failed',error);
    const message=error instanceof Error?error.message:'Unable to generate the pack right now. Please retry.';
    return NextResponse.json({error:message},{status:500});
  }
}
