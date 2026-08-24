import { NextResponse } from 'next/server';
import { stripe } from '../../../../lib/stripe-server';

export const runtime = 'nodejs';
export const maxDuration = 120;

const assetNames = [
  'hero-character','companion','helmet','signature-item','weapon',
  'shield','bow','projectile','tool','coin',
  'gem','treasure-chest','key','collectible','potion',
  'crystal','spell-effect','magic-orb','portal','tree',
  'rock','plant','world-prop','building','tower',
];

const styleDirections: Record<string,string> = {
  polished: 'polished premium voxel art, crisp geometry, tasteful detail, game-ready presentation',
  chunky: 'chunky low-poly voxel art, bold block shapes, readable silhouettes, playful game asset style',
  cute: 'cute friendly voxel art, rounded blocky proportions, charming expressions, bright cohesive palette',
  dark: 'dark-fantasy voxel art, dramatic materials, moody jewel-tone palette, readable silhouettes',
};

function aiConfig(){
  const gatewayKey=process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN;
  if(gatewayKey) return { key:gatewayKey, base:'https://ai-gateway.vercel.sh/v1', vision:'openai/gpt-5.4-mini', image:'openai/gpt-image-1-mini' };
  if(process.env.OPENAI_API_KEY) return { key:process.env.OPENAI_API_KEY, base:'https://api.openai.com/v1', vision:'gpt-5.4-mini', image:'gpt-image-1-mini' };
  return null;
}

async function describeReference(config:NonNullable<ReturnType<typeof aiConfig>>, image:string){
  const response=await fetch(`${config.base}/chat/completions`,{
    method:'POST',
    headers:{Authorization:`Bearer ${config.key}`,'Content-Type':'application/json'},
    body:JSON.stringify({
      model:config.vision,
      messages:[{role:'user',content:[
        {type:'text',text:'Describe this reference for an asset-pack art director. Focus on subject identity, distinctive shapes, materials, colors, mood and visual motifs. Do not identify private people. Keep it under 120 words.'},
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
  return String(json?.choices?.[0]?.message?.content||'').slice(0,900);
}

export async function POST(request:Request){
  try{
    const body=await request.json();
    const sessionId=typeof body?.sessionId==='string'?body.sessionId:'';
    const idea=typeof body?.idea==='string'?body.idea.trim().slice(0,600):'';
    const style=typeof body?.style==='string'?body.style:'polished';
    const reference=typeof body?.reference==='string'?body.reference:'';

    if(!sessionId||idea.length<8) return NextResponse.json({error:'A purchase and a short pack description are required.'},{status:400});
    if(reference && (!reference.startsWith('data:image/') || reference.length>2_500_000)) return NextResponse.json({error:'The reference image is too large. Please choose a smaller image.'},{status:400});

    const session=await stripe.checkout.sessions.retrieve(sessionId);
    if(session.payment_status!=='paid'||session.metadata?.product!=='ai-voxel-pack-v2') return NextResponse.json({error:'A completed $15 pack purchase is required.'},{status:403});

    const generations=Number(session.metadata?.generations||0);
    if(generations>=2) return NextResponse.json({error:'This purchase has already used its generation allowance. Download the pack you generated, or start a new pack.'},{status:409});

    const config=aiConfig();
    if(!config) return NextResponse.json({error:'AI generation is not configured on this deployment yet. Your payment is safe; please contact support before retrying.'},{status:503});

    let referenceNotes='';
    if(reference) referenceNotes=await describeReference(config,reference);

    const finish=styleDirections[style]||styleDirections.polished;
    const prompt=`Create ONE square master sprite sheet containing exactly 25 separate voxel-style game assets arranged in a precise 5 by 5 grid. Theme: ${idea}. ${referenceNotes?`Reference-image art direction: ${referenceNotes}.`:''}\n\nVisual direction: ${finish}. Every asset must clearly belong to the same world, sharing palette, materials, lighting and proportions. Use an isometric three-quarter view where appropriate. Each cell must contain exactly one isolated object, centered with generous transparent padding. Keep all objects fully inside their cells. No overlaps between cells. NO text, NO letters, NO numbers, NO labels, NO logos, NO watermark, NO border and NO grid lines. Transparent background only.\n\nPlace these 25 assets in this exact row-major order: ${assetNames.join(', ')}. Make every item visibly distinct and useful as a standalone game/social/creator asset. The final image will be automatically cut into 25 equal squares, so alignment to the exact 5x5 cell layout is critical.`;

    const imageResponse=await fetch(`${config.base}/images/generations`,{
      method:'POST',
      headers:{Authorization:`Bearer ${config.key}`,'Content-Type':'application/json'},
      body:JSON.stringify({model:config.image,prompt,n:1,size:'1024x1024',quality:'low',background:'transparent',output_format:'png'}),
    });

    if(!imageResponse.ok){
      const detail=await imageResponse.text();
      console.error('asset pack generation failed',imageResponse.status,detail.slice(0,1000));
      return NextResponse.json({error:'The image generator could not finish this pack. Please retry once; you will not be charged again.'},{status:502});
    }

    const generated=await imageResponse.json();
    const image=generated?.data?.[0]?.b64_json;
    if(!image) return NextResponse.json({error:'The generator returned an empty pack. Please retry.'},{status:502});

    await stripe.checkout.sessions.update(sessionId,{metadata:{...(session.metadata||{}),generations:String(generations+1)}});

    return NextResponse.json({image:`data:image/png;base64,${image}`,names:assetNames,theme:idea,generationsLeft:Math.max(0,1-generations)});
  }catch(error){
    console.error('custom creator pack failed',error);
    return NextResponse.json({error:'Unable to generate the pack right now. Please retry.'},{status:500});
  }
}
