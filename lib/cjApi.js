const CJ_BASE='https://developers.cjdropshipping.com/api2.0/v1';
let cachedToken=null;
let cachedUntil=0;

function apiKey(){return process.env.CJ_API_KEY||process.env.CJDROPSHIPPING_API_KEY||''}

export async function getCjAccessToken(){
  if(cachedToken&&Date.now()<cachedUntil)return cachedToken;
  const key=apiKey();
  if(!key)throw new Error('CJ API key is not configured');
  const response=await fetch(`${CJ_BASE}/authentication/getAccessToken`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({apiKey:key}),cache:'no-store'});
  const data=await response.json().catch(()=>({}));
  const token=data?.data?.accessToken;
  if(!response.ok||!token)throw new Error(data?.message||'CJ authentication failed');
  cachedToken=token;
  cachedUntil=Date.now()+12*60*60*1000;
  return token;
}

export async function getCjProductBySku(productSku){
  if(!productSku)throw new Error('CJ product SKU is required');
  const token=await getCjAccessToken();
  const url=new URL(`${CJ_BASE}/product/query`);
  url.searchParams.set('productSku',productSku);
  url.searchParams.set('features','enable_video');
  const response=await fetch(url,{headers:{'CJ-Access-Token':token},cache:'no-store'});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok||payload?.result===false||!payload?.data)throw new Error(payload?.message||'CJ product query failed');
  return payload.data;
}

export function cjProductImages(product){
  const images=[];
  if(product?.bigImage)images.push(product.bigImage);
  if(Array.isArray(product?.productImageSet))images.push(...product.productImageSet);
  return [...new Set(images.filter(value=>typeof value==='string'&&/^https?:\/\//i.test(value)))];
}
