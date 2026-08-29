import { NextResponse } from 'next/server';
import { stripe } from '../../../../lib/stripe-server';
import { requireVoxelVaultUser } from '../../../../lib/user-auth';
import { attributionFromMetadata, recordVoxelPopEvent } from '../../../../lib/voxelpop-analytics';

export const runtime = 'nodejs';
export const maxDuration = 120;
const MESH_ENDPOINT='https://api.meshy.ai/openapi/v1/image-to-3d';
const taskKey='mesh_task_0';

async function paidSession(sessionId:string){if(!sessionId)return null;const session=await stripe.checkout.sessions.retrieve(sessionId);if(session.payment_status!=='paid'||session.metadata?.product!=='voxelpop-3d-asset')return null;return session;}
function providerMessage(data:Record<string,unknown>){const taskError=data?.task_error as {message?:string}|undefined;return String(data?.message||data?.error||taskError?.message||'The 3D model provider could not complete this request.');}
function isProviderConfigFailure(message:string){const value=String(message||'').toLowerCase();return value.includes('image_enhancement')&&value.includes('not supported')&&value.includes('smart-topology');}

export async function POST(request:Request){
 const auth=await requireVoxelVaultUser(request);if(auth.ok===false)return NextResponse.json({error:'Sign in with Google before building this VoxelPop asset in 3D.'},{status:auth.status});
 const apiKey=process.env.MESHY_API_KEY;if(!apiKey)return NextResponse.json({configured:false,error:'3D mesh generation is not configured on this deployment.'},{status:503});
 try{
  const body=await request.json();const sessionId=typeof body?.sessionId==='string'?body.sessionId:'';const index=Number(body?.index);const image=typeof body?.image==='string'?body.image:'';const idea=typeof body?.idea==='string'?body.idea.trim().slice(0,420):'';const forceRestart=body?.forceRestart===true;
  if(index!==0)return NextResponse.json({error:'This purchase includes one voxel asset.'},{status:400});
  if(!/^data:image\/(png|jpeg);base64,/.test(image)||image.length>4_000_000)return NextResponse.json({error:'The generated source image is missing or too large.'},{status:400});
  const session=await paidSession(sessionId);if(!session)return NextResponse.json({error:'A completed VoxelPop 3D Asset purchase is required.'},{status:403});
  if(session.metadata?.voxelpop_user_id!==auth.user.id)return NextResponse.json({error:'This VoxelPop purchase belongs to a different signed-in account.'},{status:403});
  const attribution=attributionFromMetadata(session.metadata);const flowId=session.metadata?.flow_id||null;
  const existingTask=session.metadata?.[taskKey];const retryKey='mesh_retry_0';let retryCount=Number(session.metadata?.[retryKey]||0);
  if(existingTask){
   if(!forceRestart){await recordVoxelPopEvent({eventName:'mesh_started',eventKey:`mesh_started:${sessionId}:${existingTask}`,flowId,stripeSessionId:sessionId,attribution,details:{reused:true}});return NextResponse.json({configured:true,reused:true,taskId:existingTask})}
   const existingResponse=await fetch(`${MESH_ENDPOINT}/${encodeURIComponent(existingTask)}`,{headers:{Authorization:`Bearer ${apiKey}`},cache:'no-store'});const existingData=await existingResponse.json().catch(()=>({}));const existingStatus=String(existingData?.status||'').toUpperCase();
   if(!existingResponse.ok||!['FAILED','EXPIRED','CANCELED','CANCELLED'].includes(existingStatus)){await recordVoxelPopEvent({eventName:'mesh_started',eventKey:`mesh_started:${sessionId}:${existingTask}`,flowId,stripeSessionId:sessionId,attribution,details:{reused:true}});return NextResponse.json({configured:true,reused:true,taskId:existingTask})}
   const existingError=providerMessage(existingData);const providerConfigFailure=isProviderConfigFailure(existingError);
   if(!providerConfigFailure){if(retryCount>=1)return NextResponse.json({error:'This mesh has already used its retry. Please contact support if it still cannot finish.'},{status:409});retryCount+=1;}
  }
  const meshPayload={image_url:image,model_type:'smart-topology',ai_model:'meshy-t2',target_polycount:12000,should_texture:true,enable_pbr:true,texture_resolution:'2k',target_formats:['glb']};
  const response=await fetch(MESH_ENDPOINT,{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify(meshPayload),cache:'no-store'});const data=await response.json().catch(()=>({}));if(!response.ok)return NextResponse.json({error:providerMessage(data)},{status:response.status});const taskId=String(data?.result||data?.id||'');if(!taskId)return NextResponse.json({error:'The 3D provider did not return a task ID.'},{status:502});
  await stripe.checkout.sessions.update(sessionId,{metadata:{...(session.metadata||{}),[taskKey]:taskId,[retryKey]:String(retryCount),mesh_name_0:String(body?.name||'your-voxel').slice(0,80),mesh_idea_0:idea.slice(0,120)}});await recordVoxelPopEvent({eventName:'mesh_started',eventKey:`mesh_started:${sessionId}:${taskId}`,flowId,stripeSessionId:sessionId,attribution,details:{reused:false,retry:retryCount}});return NextResponse.json({configured:true,reused:false,taskId});
 }catch(error){console.error('creator mesh request failed',error);return NextResponse.json({error:'Unable to start the 3D mesh right now. Please retry.'},{status:500});}
}

export async function GET(request:Request){
 const apiKey=process.env.MESHY_API_KEY;if(!apiKey)return NextResponse.json({configured:false,error:'3D mesh generation is not configured on this deployment.'},{status:503});
 try{
  const url=new URL(request.url);const sessionId=url.searchParams.get('sessionId')||'';const taskId=url.searchParams.get('taskId')||'';const session=await paidSession(sessionId);if(!session)return NextResponse.json({error:'A completed VoxelPop 3D Asset purchase is required.'},{status:403});if(!taskId||session.metadata?.[taskKey]!==taskId)return NextResponse.json({error:'This 3D task does not belong to the current purchase.'},{status:403});
  const attribution=attributionFromMetadata(session.metadata);const flowId=session.metadata?.flow_id||null;
  const response=await fetch(`${MESH_ENDPOINT}/${encodeURIComponent(taskId)}`,{headers:{Authorization:`Bearer ${apiKey}`},cache:'no-store'});const data=await response.json().catch(()=>({}));if(!response.ok)return NextResponse.json({error:providerMessage(data)},{status:response.status});
  const status=String(data?.status||'PENDING');const upperStatus=status.toUpperCase();const modelUrl=typeof data?.model_urls?.glb==='string'?data.model_urls.glb:'';
  if(upperStatus==='SUCCEEDED'&&modelUrl)await recordVoxelPopEvent({eventName:'mesh_completed',eventKey:`mesh_completed:${sessionId}:${taskId}`,flowId,stripeSessionId:sessionId,attribution,details:{status:upperStatus}});
  if(['FAILED','EXPIRED','CANCELED','CANCELLED'].includes(upperStatus))await recordVoxelPopEvent({eventName:'mesh_failed',eventKey:`mesh_failed:${sessionId}:${taskId}`,flowId,stripeSessionId:sessionId,attribution,details:{status:upperStatus}});
  if(url.searchParams.get('preview')==='1'){
   if(!modelUrl)return NextResponse.json({error:'The GLB preview is not ready yet.'},{status:409});
   const modelResponse=await fetch(modelUrl,{cache:'no-store'});if(!modelResponse.ok)return NextResponse.json({error:'The generated GLB could not be loaded for preview.'},{status:502});
   return new NextResponse(modelResponse.body,{status:200,headers:{'Content-Type':'model/gltf-binary','Cache-Control':'private, max-age=3600','Content-Disposition':'inline; filename="voxelpop.glb"'}});
  }
  if(url.searchParams.get('download')==='1'){
   if(!modelUrl)return NextResponse.json({error:'The GLB file is not ready yet.'},{status:409});
   const modelResponse=await fetch(modelUrl,{cache:'no-store'});if(!modelResponse.ok)return NextResponse.json({error:'The generated GLB could not be downloaded.'},{status:502});await recordVoxelPopEvent({eventName:'glb_downloaded',eventKey:`glb_downloaded:${sessionId}:${taskId}`,flowId,stripeSessionId:sessionId,attribution,details:{status:upperStatus}});
   return new NextResponse(modelResponse.body,{status:200,headers:{'Content-Type':'model/gltf-binary','Cache-Control':'private, max-age=3600','Content-Disposition':'attachment; filename="voxelpop.glb"'}});
  }
  return NextResponse.json({configured:true,status,progress:modelUrl?100:Number(data?.progress||0),modelUrl:modelUrl||null,thumbnailUrl:data?.alpha_thumbnail_url||data?.thumbnail_url||null,thumbnailUrls:data?.thumbnail_urls||null,error:data?.task_error?.message||null});
 }catch(error){console.error('creator mesh status failed',error);return NextResponse.json({error:'Unable to read the 3D mesh status right now.'},{status:500});}
}
