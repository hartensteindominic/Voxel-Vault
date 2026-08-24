import { NextResponse } from 'next/server';
import { stripe } from '../../../../lib/stripe-server';

export const runtime = 'nodejs';
export const maxDuration = 120;

const MESH_ENDPOINT='https://api.meshy.ai/openapi/v1/image-to-3d';
const taskKeys=['mesh_task_0','mesh_task_1','mesh_task_2'];

async function paidSession(sessionId:string){
  if(!sessionId) return null;
  const session=await stripe.checkout.sessions.retrieve(sessionId);
  if(session.payment_status!=='paid'||session.metadata?.product!=='ai-voxel-pack-v3') return null;
  return session;
}

function providerMessage(data:Record<string,unknown>){
  const taskError=data?.task_error as {message?:string}|undefined;
  return String(data?.message||data?.error||taskError?.message||'The 3D model provider could not complete this request.');
}

export async function POST(request:Request){
  const apiKey=process.env.MESHY_API_KEY;
  if(!apiKey) return NextResponse.json({configured:false,error:'3D mesh generation is not configured on this deployment.'},{status:503});

  try{
    const body=await request.json();
    const sessionId=typeof body?.sessionId==='string'?body.sessionId:'';
    const index=Number(body?.index);
    const image=typeof body?.image==='string'?body.image:'';
    const idea=typeof body?.idea==='string'?body.idea.trim().slice(0,420):'';
    const forceRestart=body?.forceRestart===true;

    if(!Number.isInteger(index)||index<0||index>2) return NextResponse.json({error:'Choose one of the three generated assets.'},{status:400});
    if(!/^data:image\/(png|jpeg);base64,/.test(image)||image.length>4_000_000) return NextResponse.json({error:'The generated source image is missing or too large.'},{status:400});

    const session=await paidSession(sessionId);
    if(!session) return NextResponse.json({error:'A completed VoxelPop 3D Pack purchase is required.'},{status:403});

    const taskKey=taskKeys[index];
    const existingTask=session.metadata?.[taskKey];
    const retryKey=`mesh_retry_${index}`;
    let retryCount=Number(session.metadata?.[retryKey]||0);
    if(existingTask){
      if(!forceRestart) return NextResponse.json({configured:true,reused:true,taskId:existingTask});
      const existingResponse=await fetch(`${MESH_ENDPOINT}/${encodeURIComponent(existingTask)}`,{headers:{Authorization:`Bearer ${apiKey}`},cache:'no-store'});
      const existingData=await existingResponse.json().catch(()=>({}));
      const existingStatus=String(existingData?.status||'').toUpperCase();
      if(!existingResponse.ok||!['FAILED','EXPIRED','CANCELED','CANCELLED'].includes(existingStatus)) return NextResponse.json({configured:true,reused:true,taskId:existingTask});
      if(retryCount>=1) return NextResponse.json({error:'This mesh has already used its retry. Download the other models or contact support for this asset.'},{status:409});
      retryCount+=1;
    }

    const response=await fetch(MESH_ENDPOINT,{
      method:'POST',
      headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},
      body:JSON.stringify({
        image_url:image,
        model_type:'smart-topology',
        ai_model:'meshy-t2',
        target_polycount:12000,
        should_texture:true,
        enable_pbr:true,
        texture_resolution:'2k',
        texture_image_url:image,
        image_enhancement:false,
        target_formats:['glb'],
        auto_size:true,
        origin_at:'bottom',
        alpha_thumbnail:true,
        multi_view_thumbnails:true,
        moderation:true,
      }),
      cache:'no-store',
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok) return NextResponse.json({error:providerMessage(data)},{status:response.status});

    const taskId=String(data?.result||data?.id||'');
    if(!taskId) return NextResponse.json({error:'The 3D provider did not return a task ID.'},{status:502});

    await stripe.checkout.sessions.update(sessionId,{metadata:{
      ...(session.metadata||{}),
      [taskKey]:taskId,
      [retryKey]:String(retryCount),
      [`mesh_name_${index}`]:String(body?.name||`voxel-${index+1}`).slice(0,80),
      [`mesh_idea_${index}`]:idea.slice(0,120),
    }});

    return NextResponse.json({configured:true,reused:false,taskId});
  }catch(error){
    console.error('creator mesh request failed',error);
    return NextResponse.json({error:'Unable to start the 3D mesh right now. Please retry.'},{status:500});
  }
}

export async function GET(request:Request){
  const apiKey=process.env.MESHY_API_KEY;
  if(!apiKey) return NextResponse.json({configured:false,error:'3D mesh generation is not configured on this deployment.'},{status:503});

  try{
    const url=new URL(request.url);
    const sessionId=url.searchParams.get('sessionId')||'';
    const taskId=url.searchParams.get('taskId')||'';
    const session=await paidSession(sessionId);
    if(!session) return NextResponse.json({error:'A completed VoxelPop 3D Pack purchase is required.'},{status:403});
    if(!taskId||!taskKeys.some(key=>session.metadata?.[key]===taskId)) return NextResponse.json({error:'This 3D task does not belong to the current purchase.'},{status:403});

    const response=await fetch(`${MESH_ENDPOINT}/${encodeURIComponent(taskId)}`,{
      headers:{Authorization:`Bearer ${apiKey}`},
      cache:'no-store',
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok) return NextResponse.json({error:providerMessage(data)},{status:response.status});

    const status=String(data?.status||'PENDING');
    const modelUrl=data?.model_urls?.glb||null;
    if(url.searchParams.get('download')==='1'){
      if(!modelUrl) return NextResponse.json({error:'The GLB file is not ready yet.'},{status:409});
      return NextResponse.redirect(modelUrl);
    }

    return NextResponse.json({
      configured:true,
      status,
      progress:modelUrl?100:Number(data?.progress||0),
      modelUrl,
      thumbnailUrl:data?.alpha_thumbnail_url||data?.thumbnail_url||null,
      thumbnailUrls:data?.thumbnail_urls||null,
      error:data?.task_error?.message||null,
    });
  }catch(error){
    console.error('creator mesh status failed',error);
    return NextResponse.json({error:'Unable to read the 3D mesh status right now.'},{status:500});
  }
}
