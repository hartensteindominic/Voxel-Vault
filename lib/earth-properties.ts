const BRIDGE_BASE_URL = 'https://api.bridgedataoutput.com/api/v2/OData';
const DOMAIN_API_URL = 'https://api.domain.com.au';
const DOMAIN_AUTH_URL = 'https://auth.domain.com.au/v1/connect/token';
const MAX_RESULTS = 20;

export type EarthPropertyCategory = 'house'|'condo'|'mobile-home'|'multifamily'|'storefront'|'commercial'|'warehouse'|'barn-farm'|'land'|'other';

export type EarthProperty = {
  id: string; provider: string; providerDataset: string; listingId: string;
  address: string; city: string; region: string; postalCode: string; country: string; currency: string;
  latitude: number | null; longitude: number | null; category: EarthPropertyCategory;
  propertyType: string; propertySubType: string; transactionType: 'sale'|'rent';
  listPriceCents: number | null; rentCentsMonthly: number | null; marketValueCents: number | null; marketValueText: string | null; marketValueLabel: string;
  beds: number | null; baths: number | null; livingAreaSqft: number | null; lotAreaSqft: number | null; stories: number | null;
  status: string; imageUrl: string | null; sourceUrl: string | null; virtualTourUrl: string | null; modifiedAt: string | null; sourceDisclosure: string;
};

export type EarthProviderCoverage = { id: string; name: string; configured: boolean; regions: string[]; mode: string };
type PartnerFeedConfig = { id?: string; name?: string; url?: string; token?: string; regions?: string[]; currency?: string };
let domainTokenCache: { token: string; expiresAt: number } | null = null;

function finiteNumber(value: unknown): number | null { const n=Number(value); return Number.isFinite(n)?n:null; }
function centsFromDollars(value: unknown): number | null { const n=finiteNumber(value); return n===null||n<0?null:Math.round(n*100); }
function safeText(value: unknown,max=240){ return String(value??'').trim().slice(0,max); }
function safeCurrency(value: unknown,fallback='USD'){ const v=safeText(value||fallback,3).toUpperCase(); return /^[A-Z]{3}$/.test(v)?v:fallback; }
function safeSourceUrl(value: unknown): string | null { if(!value)return null; try{const u=new URL(String(value));return ['http:','https:'].includes(u.protocol)?u.toString():null}catch{return null} }
function firstMediaUrl(row:any):string|null{ const media=Array.isArray(row?.Media)?row.Media:Array.isArray(row?.media)?row.media:[]; const item=media.find((m:any)=>m?.MediaURL||m?.MediaURLLarge||m?.MediaURLThumb||m?.url||m?.imageUrl); return safeSourceUrl(item?.MediaURL||item?.MediaURLLarge||item?.MediaURLThumb||item?.url||item?.imageUrl||row?.PhotoURL||row?.ImageURL); }
function categoryFrom(typeRaw:unknown,subTypeRaw:unknown):EarthPropertyCategory{
  const value=`${safeText(typeRaw)} ${safeText(subTypeRaw)}`.toLowerCase();
  if(/manufactured|mobile|trailer/.test(value))return'mobile-home';
  if(/condo|condominium|apartment|unit|flat/.test(value))return'condo';
  if(/multi.?family|duplex|triplex|quadruplex|block of units|apartment building/.test(value))return'multifamily';
  if(/warehouse|industrial|factory/.test(value))return'warehouse';
  if(/retail|storefront|shopping|restaurant|hospitality|cafe/.test(value))return'storefront';
  if(/farm|ranch|agricultural|agriculture|barn|rural/.test(value))return'barn-farm';
  if(/land|vacant|lot|acreage/.test(value))return'land';
  if(/commercial|office|business/.test(value))return'commercial';
  if(/residential|single.?family|house|townhouse|townhome|terrace/.test(value))return'house';
  return'other';
}

function normalizeBridgeProperty(row:any,dataset:string):EarthProperty{
  const type=safeText(row?.PropertyType,120),sub=safeText(row?.PropertySubType,120);
  const sale=centsFromDollars(row?.ListPrice),rent=centsFromDollars(row?.LeaseAmount??row?.RentPrice??row?.ListPriceLow);
  const transactionType:'sale'|'rent'=rent&&!sale?'rent':'sale';
  const listingId=safeText(row?.ListingId||row?.ListingKey||row?.ListingKeyNumeric,160),key=safeText(row?.ListingKey||listingId,180);
  const country=safeText(row?.Country||'US',40);
  return {
    id:`bridge:${dataset}:${key}`,provider:'Bridge / authorized MLS',providerDataset:dataset,listingId,
    address:safeText(row?.UnparsedAddress||[row?.StreetNumber,row?.StreetDirPrefix,row?.StreetName,row?.StreetSuffix].filter(Boolean).join(' '),260),
    city:safeText(row?.City,100),region:safeText(row?.StateOrProvince,80),postalCode:safeText(row?.PostalCode,32),country,
    currency:safeCurrency(row?.ListPriceCurrency||row?.Currency,country.toUpperCase()==='CA'?'CAD':'USD'),latitude:finiteNumber(row?.Latitude),longitude:finiteNumber(row?.Longitude),
    category:categoryFrom(type,sub),propertyType:type,propertySubType:sub,transactionType,
    listPriceCents:sale,rentCentsMonthly:rent,marketValueCents:transactionType==='sale'?sale:rent,marketValueText:null,marketValueLabel:transactionType==='sale'?'MLS list price':'Monthly asking rent',
    beds:finiteNumber(row?.BedroomsTotal),baths:finiteNumber(row?.BathroomsTotalInteger??row?.BathroomsFull??row?.BathroomsTotalDecimal),livingAreaSqft:finiteNumber(row?.LivingArea??row?.BuildingAreaTotal),lotAreaSqft:finiteNumber(row?.LotSizeSquareFeet),stories:finiteNumber(row?.Stories),
    status:safeText(row?.StandardStatus||row?.MlsStatus||'Active',80),imageUrl:firstMediaUrl(row),sourceUrl:safeSourceUrl(row?.ListingURL||row?.SourceURL),virtualTourUrl:safeSourceUrl(row?.VirtualTourURLUnbranded||row?.VirtualTourURLBranded),modifiedAt:row?.ModificationTimestamp?safeText(row.ModificationTimestamp,80):null,
    sourceDisclosure:'Live listing data supplied by an authorized MLS/Bridge dataset. Availability, price and property facts can change at the source.'
  };
}

function escapeODataString(value:string){return value.replace(/'/g,"''");}
function bridgeFilter({query,latitude,longitude}:{query?:string;latitude?:number;longitude?:number}){
  const clauses=["StandardStatus eq 'Active'"];const q=safeText(query,80);
  if(q){const escaped=escapeODataString(q);if(/^\d{5}(?:-\d{4})?$/.test(q))clauses.push(`PostalCode eq '${escaped}'`);else clauses.push(`(contains(UnparsedAddress,'${escaped}') or contains(City,'${escaped}') or contains(StateOrProvince,'${escaped}') or contains(Country,'${escaped}'))`);}
  else if(Number.isFinite(latitude)&&Number.isFinite(longitude)){const lat=Number(latitude),lon=Number(longitude);clauses.push(`Latitude ge ${lat-.22} and Latitude le ${lat+.22} and Longitude ge ${lon-.28} and Longitude le ${lon+.28}`);}
  return clauses.join(' and ');
}
function bridgeConfigured(){return Boolean(process.env.BRIDGE_DATASET_ID?.trim()&&process.env.BRIDGE_ACCESS_TOKEN?.trim());}
async function searchBridge(input:{query?:string;latitude?:number;longitude?:number;category?:string;transactionType?:string}){
  const dataset=process.env.BRIDGE_DATASET_ID?.trim(),token=process.env.BRIDGE_ACCESS_TOKEN?.trim();if(!dataset||!token)return[] as EarthProperty[];
  const endpoint=new URL(`${BRIDGE_BASE_URL}/${encodeURIComponent(dataset)}/Property`);endpoint.searchParams.set('$top','60');endpoint.searchParams.set('$orderby','ModificationTimestamp desc');endpoint.searchParams.set('$filter',bridgeFilter(input));endpoint.searchParams.set('$select',['ListingKey','ListingId','ListPrice','LeaseAmount','UnparsedAddress','StreetNumber','StreetName','StreetSuffix','City','StateOrProvince','PostalCode','Country','Latitude','Longitude','BedroomsTotal','BathroomsTotalInteger','BathroomsTotalDecimal','LivingArea','BuildingAreaTotal','LotSizeSquareFeet','Stories','PropertyType','PropertySubType','StandardStatus','MlsStatus','ModificationTimestamp','ListingURL','VirtualTourURLUnbranded','VirtualTourURLBranded'].join(','));endpoint.searchParams.set('$expand','Media($top=1)');
  const response=await fetch(endpoint,{headers:{Authorization:`Bearer ${token}`,Accept:'application/json'},cache:'no-store'});if(!response.ok)throw new Error(`Bridge property search failed (${response.status}): ${(await response.text()).slice(0,240)}`);
  const payload=await response.json(),rows=Array.isArray(payload?.value)?payload.value:Array.isArray(payload?.bundle)?payload.bundle:[];
  return rows.map((row:any)=>normalizeBridgeProperty(row,dataset)).filter((p:EarthProperty)=>!input.category||input.category==='all'||p.category===input.category).filter((p:EarthProperty)=>!input.transactionType||input.transactionType==='all'||p.transactionType===input.transactionType).slice(0,MAX_RESULTS);
}

function domainConfigured(){return Boolean(process.env.DOMAIN_CLIENT_ID?.trim()&&process.env.DOMAIN_CLIENT_SECRET?.trim());}
async function getDomainToken(){
  if(domainTokenCache&&domainTokenCache.expiresAt>Date.now()+60_000)return domainTokenCache.token;
  const id=process.env.DOMAIN_CLIENT_ID?.trim(),secret=process.env.DOMAIN_CLIENT_SECRET?.trim();if(!id||!secret)throw new Error('Domain credentials are not configured.');
  const body=new URLSearchParams({grant_type:'client_credentials',scope:'api_listings_read'});const response=await fetch(DOMAIN_AUTH_URL,{method:'POST',headers:{Authorization:`Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`,'Content-Type':'application/x-www-form-urlencoded',Accept:'application/json'},body,cache:'no-store'});if(!response.ok)throw new Error(`Domain authentication failed (${response.status}).`);
  const payload=await response.json(),token=safeText(payload?.access_token,4096),expires=Math.max(300,Number(payload?.expires_in||3600));if(!token)throw new Error('Domain authentication returned no access token.');domainTokenCache={token,expiresAt:Date.now()+expires*1000};return token;
}
async function resolveDomainLocation(query:string,token:string){
  const q=safeText(query,80);if(!q)return null;const endpoint=new URL(`${DOMAIN_API_URL}/v1/listings/locations`);endpoint.searchParams.set('terms',q);const response=await fetch(endpoint,{headers:{Authorization:`Bearer ${token}`,Accept:'application/json'},cache:'no-store'});if(!response.ok)return null;const rows=await response.json();const location=Array.isArray(rows)?rows.find((x:any)=>x?.type==='suburb')||rows[0]:null;if(!location)return null;
  return{state:safeText(location.state,20).toUpperCase(),region:safeText(location.region,80),area:safeText(location.area,80),suburb:safeText(location.name,80),postCode:safeText(location.postcode,20),includeSurroundingSuburbs:true};
}
function domainPropertyTypes(category?:string){const map:Record<string,string[]>={house:['House','Townhouse','Terrace'],condo:['ApartmentUnitFlat','NewApartments'],multifamily:['BlockOfUnits'],land:['VacantLand']};return category&&category!=='all'?map[category]:undefined;}
function parseDomainPriceText(value:unknown){const text=safeText(value,120);if(!text)return{cents:null as number|null,text:null as string|null};const match=text.replace(/,/g,'').match(/\$\s*([0-9]+(?:\.[0-9]+)?)/);return{cents:match?Math.round(Number(match[1])*100):null,text};}
function normalizeDomainProperty(item:any):EarthProperty|null{
  if(!item||item?.type==='Project')return null;const listing=item?.listing||item;if(!listing)return null;const details=listing?.propertyDetails||listing;const id=safeText(listing.id,80);if(!id)return null;
  const propertyType=safeText(details?.propertyType||listing?.propertyTypes?.[0],120),subtypes=Array.isArray(details?.allPropertyTypes)?details.allPropertyTypes.join(', '):Array.isArray(listing?.propertyTypes)?listing.propertyTypes.join(', '):'';
  const listingType=safeText(listing?.listingType||listing?.objective||listing?.saleMode,40).toLowerCase(),transactionType:'sale'|'rent'=/rent|lease/.test(listingType)?'rent':'sale';const price=parseDomainPriceText(listing?.priceDetails?.displayPrice||listing?.displayPrice||listing?.price);
  let monthlyRent=transactionType==='rent'?price.cents:null;if(monthlyRent&&/week|weekly|pw\b/i.test(price.text||''))monthlyRent=Math.round(monthlyRent*52/12);
  const slug=safeText(listing?.listingSlug,300),sourceUrl=safeSourceUrl(listing?.seoUrl)||(slug?`https://www.domain.com.au/${slug.replace(/^\/+/, '')}`:null);
  const landArea=finiteNumber(details?.landArea);
  return{
    id:`domain:au:${id}`,provider:'Domain Australia',providerDataset:'domain-au',listingId:id,address:safeText(details?.displayableAddress||listing?.addressParts?.displayAddress||[details?.streetNumber,details?.street].filter(Boolean).join(' '),260),city:safeText(details?.suburb||listing?.addressParts?.suburb,100),region:safeText(details?.state||listing?.addressParts?.stateAbbreviation,80).toUpperCase(),postalCode:safeText(details?.postcode||listing?.addressParts?.postcode,32),country:'AU',currency:'AUD',latitude:finiteNumber(details?.latitude??listing?.geoLocation?.latitude),longitude:finiteNumber(details?.longitude??listing?.geoLocation?.longitude),category:categoryFrom(propertyType,subtypes),propertyType,propertySubType:safeText(subtypes,160),transactionType,
    listPriceCents:transactionType==='sale'?price.cents:null,rentCentsMonthly:monthlyRent,marketValueCents:transactionType==='sale'?price.cents:monthlyRent,marketValueText:price.text,marketValueLabel:transactionType==='sale'?'Domain asking price':'Domain asking rent',beds:finiteNumber(details?.bedrooms??listing?.bedrooms),baths:finiteNumber(details?.bathrooms??listing?.bathrooms),livingAreaSqft:null,lotAreaSqft:landArea===null?null:Math.round(landArea*10.7639),stories:null,status:safeText(listing?.status||'Live',80),imageUrl:firstMediaUrl(listing),sourceUrl,virtualTourUrl:safeSourceUrl(listing?.virtualTourUrl),modifiedAt:listing?.dateUpdated?safeText(listing.dateUpdated,80):null,sourceDisclosure:'Live Australian listing data supplied by the authorized Domain API. Availability, price and property facts can change at Domain.'
  };
}
async function searchDomain(input:{query?:string;category?:string;transactionType?:string}){
  if(!domainConfigured()||!input.query)return[] as EarthProperty[];const token=await getDomainToken(),location=await resolveDomainLocation(input.query,token);if(!location)return[];
  const listingTypes=input.transactionType==='rent'?['Rent']:input.transactionType==='sale'?['Sale']:['Sale','Rent'];const batches=await Promise.all(listingTypes.map(async listingType=>{const body:Record<string,unknown>={listingType,locations:[location],pageSize:30};const types=domainPropertyTypes(input.category);if(types)body.propertyTypes=types;const response=await fetch(`${DOMAIN_API_URL}/v1/listings/residential/_search`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(body),cache:'no-store'});if(!response.ok)throw new Error(`Domain listing search failed (${response.status}): ${(await response.text()).slice(0,200)}`);const payload=await response.json();return Array.isArray(payload)?payload:[];}));
  return batches.flat().map(normalizeDomainProperty).filter((p):p is EarthProperty=>Boolean(p)).filter(p=>!input.category||input.category==='all'||p.category===input.category).slice(0,MAX_RESULTS);
}

function partnerFeeds():PartnerFeedConfig[]{const raw=process.env.EARTH_PARTNER_FEEDS_JSON?.trim();if(!raw)return[];try{const parsed=JSON.parse(raw);if(!Array.isArray(parsed))return[];return parsed.filter(item=>{try{return item&&typeof item==='object'&&new URL(String(item.url)).protocol==='https:'}catch{return false}}).slice(0,12)}catch{return[]}}
function normalizePartnerProperty(row:any,feed:PartnerFeedConfig):EarthProperty|null{
  const listingId=safeText(row?.listingId||row?.id,160);if(!listingId)return null;const transactionType:'sale'|'rent'=safeText(row?.transactionType,20).toLowerCase()==='rent'?'rent':'sale',currency=safeCurrency(row?.currency,safeCurrency(feed.currency,'USD')),sale=finiteNumber(row?.listPriceCents),rent=finiteNumber(row?.rentCentsMonthly),providerId=safeText(feed.id||feed.name||'partner',50).replace(/[^a-zA-Z0-9_-]/g,'-').toLowerCase(),type=safeText(row?.propertyType,120),sub=safeText(row?.propertySubType,120);
  return{id:`partner:${providerId}:${listingId}`,provider:safeText(feed.name||row?.provider||'Authorized property partner',100),providerDataset:providerId,listingId,address:safeText(row?.address,260),city:safeText(row?.city,100),region:safeText(row?.region,80),postalCode:safeText(row?.postalCode,32),country:safeText(row?.country,60),currency,latitude:finiteNumber(row?.latitude),longitude:finiteNumber(row?.longitude),category:categoryFrom(row?.category||type,sub),propertyType:type,propertySubType:sub,transactionType,listPriceCents:sale,rentCentsMonthly:rent,marketValueCents:finiteNumber(row?.marketValueCents)??(transactionType==='sale'?sale:rent),marketValueText:safeText(row?.marketValueText,120)||null,marketValueLabel:safeText(row?.marketValueLabel,80)||(transactionType==='sale'?'Source asking price':'Source asking rent'),beds:finiteNumber(row?.beds),baths:finiteNumber(row?.baths),livingAreaSqft:finiteNumber(row?.livingAreaSqft),lotAreaSqft:finiteNumber(row?.lotAreaSqft),stories:finiteNumber(row?.stories),status:safeText(row?.status||'Active',80),imageUrl:safeSourceUrl(row?.imageUrl),sourceUrl:safeSourceUrl(row?.sourceUrl),virtualTourUrl:safeSourceUrl(row?.virtualTourUrl),modifiedAt:row?.modifiedAt?safeText(row.modifiedAt,80):null,sourceDisclosure:safeText(row?.sourceDisclosure,300)||'Live listing data supplied by an authorized Voxel Vault property-data partner. Verify availability and facts at the original source.'};
}
async function searchPartnerFeed(feed:PartnerFeedConfig,input:{query?:string;latitude?:number;longitude?:number;category?:string;transactionType?:string}){
  if(!feed.url)return[] as EarthProperty[];const endpoint=new URL(feed.url);if(input.query)endpoint.searchParams.set('q',safeText(input.query,80));if(Number.isFinite(input.latitude))endpoint.searchParams.set('lat',String(input.latitude));if(Number.isFinite(input.longitude))endpoint.searchParams.set('lng',String(input.longitude));if(input.category)endpoint.searchParams.set('category',input.category);if(input.transactionType)endpoint.searchParams.set('type',input.transactionType);endpoint.searchParams.set('limit',String(MAX_RESULTS));const headers:Record<string,string>={Accept:'application/json'};if(feed.token)headers.Authorization=`Bearer ${feed.token}`;const response=await fetch(endpoint,{headers,cache:'no-store'});if(!response.ok)throw new Error(`${safeText(feed.name||'Partner feed',80)} search failed (${response.status}).`);const payload=await response.json(),rows=Array.isArray(payload)?payload:Array.isArray(payload?.listings)?payload.listings:[];return rows.map((row:any)=>normalizePartnerProperty(row,feed)).filter((p):p is EarthProperty=>Boolean(p)).filter(p=>!input.category||input.category==='all'||p.category===input.category).filter(p=>!input.transactionType||input.transactionType==='all'||p.transactionType===input.transactionType).slice(0,MAX_RESULTS);
}

export function getEarthProviderCoverage():EarthProviderCoverage[]{const partners=partnerFeeds();return[
  {id:'bridge',name:'Bridge / authorized MLS',configured:bridgeConfigured(),regions:['United States','Canada (participating MLS datasets)'],mode:'MLS / RESO listing feed'},
  {id:'domain-au',name:'Domain Australia',configured:domainConfigured(),regions:['Australia'],mode:'Official Domain listings API'},
  ...partners.map((feed,index)=>({id:safeText(feed.id||`partner-${index+1}`,50),name:safeText(feed.name||`Authorized partner ${index+1}`,100),configured:Boolean(feed.url),regions:Array.isArray(feed.regions)?feed.regions.map(r=>safeText(r,80)).filter(Boolean):['Configured partner region'],mode:'Authorized normalized partner feed'}))
];}

export async function searchEarthProperties(input:{query?:string;latitude?:number;longitude?:number;category?:string;transactionType?:string}){
  const coverage=getEarthProviderCoverage(),partners=partnerFeeds(),jobs:Promise<EarthProperty[]>[]=[];if(bridgeConfigured())jobs.push(searchBridge(input));if(domainConfigured())jobs.push(searchDomain(input));for(const feed of partners)jobs.push(searchPartnerFeed(feed,input));
  if(!jobs.length)return{configured:false,provider:'Global authorized property federation',providers:coverage,listings:[] as EarthProperty[],message:'The Earth interface is global, but no licensed listing feeds are connected yet. Voxel Vault will not fabricate inventory.'};
  const settled=await Promise.allSettled(jobs),listings=settled.flatMap(r=>r.status==='fulfilled'?r.value:[]),providerErrors=settled.filter(r=>r.status==='rejected').map((r:any)=>safeText(r.reason?.message||r.reason,180)),unique=Array.from(new Map(listings.map(l=>[l.id,l])).values()).slice(0,MAX_RESULTS);
  return{configured:true,provider:'Global authorized property federation',providers:coverage,listings:unique,providerErrors,message:unique.length?`Showing ${unique.length} live authorized listing${unique.length===1?'':'s'} across connected Earth data providers.`:providerErrors.length===settled.length?'Connected property providers are temporarily unavailable. No fabricated replacements were returned.':'No active authorized listings matched this location across the connected providers.'};
}

export const EARTH_PROPERTY_CATEGORIES:{id:EarthPropertyCategory|'all';label:string}[]=[{id:'all',label:'All'},{id:'house',label:'Houses'},{id:'condo',label:'Condos'},{id:'mobile-home',label:'Mobile / Trailer'},{id:'multifamily',label:'Multifamily'},{id:'storefront',label:'Storefronts'},{id:'commercial',label:'Commercial'},{id:'warehouse',label:'Warehouses'},{id:'barn-farm',label:'Barns / Farms'},{id:'land',label:'Land'}];
