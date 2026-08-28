'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import GlobalEarthGlobe from './GlobalEarthGlobe';

const CATEGORIES = [
  ['all','All'],['house','Houses'],['condo','Condos'],['mobile-home','Mobile / Trailer'],['multifamily','Multifamily'],['storefront','Storefronts'],['commercial','Commercial'],['warehouse','Warehouses'],['barn-farm','Barns / Farms'],['land','Land'],
];

function money(property) {
  if (!property) return 'Price on request';
  const cents = Number(property.marketValueCents);
  if (Number.isFinite(cents)) {
    const currency = /^[A-Z]{3}$/.test(String(property.currency || '')) ? property.currency : 'USD';
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(cents / 100) + (property.transactionType === 'rent' ? ' / mo' : '');
    } catch {}
  }
  return property.marketValueText || 'Price on request';
}

function addressLine(property) {
  return [property?.address, property?.city, property?.region, property?.postalCode, property?.country].filter(Boolean).join(', ');
}

function safeMapUrl(property) {
  if (Number.isFinite(Number(property?.latitude)) && Number.isFinite(Number(property?.longitude))) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${property.latitude},${property.longitude}`)}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressLine(property))}`;
}

function categoryLabel(category) {
  return CATEGORIES.find(([id]) => id === category)?.[1] || 'Property';
}

function shortProvider(provider) {
  return String(provider || 'Authorized source').replace(' / authorized MLS',' MLS');
}

function PropertyModel({ property }) {
  const mountRef = useRef(null);
  useEffect(() => {
    let dead = false;
    let cleanup = () => {};
    import('three').then((THREE) => {
      if (dead || !mountRef.current) return;
      const mount = mountRef.current;
      const width = Math.max(300, mount.clientWidth || 300);
      const height = Math.max(300, mount.clientHeight || 380);
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.setSize(width, height);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      mount.innerHTML = '';
      mount.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      scene.fog = new THREE.Fog(0x080b0f, 18, 42);
      scene.add(new THREE.HemisphereLight(0xf7fbff, 0x101913, 2.2));
      const sun = new THREE.DirectionalLight(0xffffff, 3.0);
      sun.position.set(8, 13, 9);
      scene.add(sun);
      const accent = new THREE.PointLight(0x79efbc, 26, 28);
      accent.position.set(-6, 5, 7);
      scene.add(accent);
      const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 100);
      const root = new THREE.Group();
      scene.add(root);
      const geometries = [];
      const materials = [];
      const mat = (color, roughness = .68, metalness = .04) => { const m = new THREE.MeshStandardMaterial({ color, roughness, metalness }); materials.push(m); return m; };
      const box = (w,h,d,color,x,y,z) => { const g = new THREE.BoxGeometry(w,h,d); geometries.push(g); const mesh = new THREE.Mesh(g,mat(color)); mesh.position.set(x,y,z); root.add(mesh); return mesh; };
      const slab = (w,d,color,x=0,z=0) => box(w,.18,d,color,x,-.2,z);

      slab(16,12,0x26362e);
      const category = property?.category || 'house';
      if (category === 'land') {
        slab(12,8,0x536d42);
        for (let i=0;i<9;i+=1) box(.18,.18,.18,0xb7c999,-5+i*1.2,.05,-2+(i%3)*2);
      } else if (category === 'barn-farm') {
        box(7,3.8,5,0x8e4b3a,0,1.6,0);
        const roofG = new THREE.ConeGeometry(5,2.4,4); geometries.push(roofG); const roof = new THREE.Mesh(roofG,mat(0x4b342d)); roof.rotation.y=Math.PI/4; roof.scale.z=.72; roof.position.set(0,4.35,0); root.add(roof);
        box(1.8,2.5,.15,0xe2d1bd,0,1.1,2.55);
      } else if (category === 'mobile-home') {
        box(9,2.25,3.3,0xd7d9d5,0,1,0); box(9.4,.25,3.7,0x3d4246,0,2.28,0); box(2.4,.16,2.2,0x8b735d,3.1,-.02,2.6);
      } else if (category === 'storefront') {
        box(8.5,3.6,4.5,0xb8b3a6,0,1.5,0); box(7.3,2.2,.1,0x6bb4c8,0,1.35,2.28); box(9,.45,4.8,0x25292f,0,3.45,0);
      } else if (category === 'warehouse' || category === 'commercial') {
        box(10,4.2,6,category === 'warehouse'?0x8c939a:0xb6b8ba,0,1.8,0); box(3.2,2.7,.12,0x39424d,2.5,1.15,3.02); box(10.4,.3,6.4,0x2b3035,0,4,0);
      } else if (category === 'condo' || category === 'multifamily') {
        box(7,6.8,5.3,0xc2c3bf,0,3.1,0); for(let y=0;y<3;y+=1)for(let x=-1;x<=1;x+=1)box(1.2,1,.08,0x6fa8ba,x*1.8,1.2+y*1.8,2.68);
      } else {
        box(8.4,2.8,4.7,0xc8c2b6,-.6,1.2,.2); box(5.4,2.35,3.6,0xb2b5b2,1.8,3.65,-.4); box(8.8,.28,5.1,0x32363b,-.6,2.78,.2); box(5.8,.28,4,0x32363b,1.8,5,-.4); box(4.2,1.7,.08,0x77b9cc,-1.3,1.2,2.58);
      }

      const ringG = new THREE.RingGeometry(6.8,6.95,64); geometries.push(ringG); const ringM = mat(0x78efbd,.32,.1); const ring = new THREE.Mesh(ringG,ringM); ring.rotation.x=-Math.PI/2; ring.position.y=-.1; root.add(ring);
      let az=.68, el=.46, radius=20, dragging=false, lastX=0, lastY=0;
      const update=()=>{const c=Math.cos(el);camera.position.set(Math.sin(az)*c*radius,Math.sin(el)*radius,Math.cos(az)*c*radius);camera.lookAt(0,1.4,0)}; update();
      const down=e=>{dragging=true;lastX=e.clientX;lastY=e.clientY};
      const move=e=>{if(!dragging)return;az-=(e.clientX-lastX)*.008;el=Math.max(.2,Math.min(.95,el+(e.clientY-lastY)*.005));lastX=e.clientX;lastY=e.clientY;update()};
      const up=()=>{dragging=false};
      renderer.domElement.addEventListener('pointerdown',down);renderer.domElement.addEventListener('pointermove',move);renderer.domElement.addEventListener('pointerup',up);
      let frame; const animate=()=>{frame=requestAnimationFrame(animate);ring.material.opacity=.88;renderer.render(scene,camera)}; animate();
      const resize=()=>{if(!mountRef.current)return;const w=Math.max(300,mountRef.current.clientWidth||300),h=Math.max(300,mountRef.current.clientHeight||380);renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix()};window.addEventListener('resize',resize);
      cleanup=()=>{cancelAnimationFrame(frame);window.removeEventListener('resize',resize);renderer.domElement.removeEventListener('pointerdown',down);renderer.domElement.removeEventListener('pointermove',move);renderer.domElement.removeEventListener('pointerup',up);geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());renderer.dispose();mount.innerHTML=''};
    });
    return()=>{dead=true;cleanup()};
  },[property?.id,property?.category]);
  return <div className="model" ref={mountRef}/>;
}

export default function EarthPropertiesPage() {
  const [query,setQuery]=useState('');
  const [category,setCategory]=useState('all');
  const [type,setType]=useState('all');
  const [listings,setListings]=useState([]);
  const [providers,setProviders]=useState([]);
  const [selectedId,setSelectedId]=useState('');
  const [message,setMessage]=useState('Search anywhere on Earth or tap the globe.');
  const [configured,setConfigured]=useState(null);
  const [busy,setBusy]=useState(false);
  const [lastSearch,setLastSearch]=useState(null);
  const selected=useMemo(()=>listings.find(item=>item.id===selectedId)||listings[0]||null,[listings,selectedId]);
  const liveProviders=providers.filter(provider=>provider.configured);

  async function load(params={}, nextCategory=category, nextType=type) {
    setBusy(true);
    try {
      const search = new URLSearchParams({ category: nextCategory, type: nextType });
      if (params?.query) search.set('q',params.query);
      if (Number.isFinite(params?.lat)&&Number.isFinite(params?.lng)){search.set('lat',String(params.lat));search.set('lng',String(params.lng));}
      const response=await fetch(`/api/earth-properties/search?${search.toString()}`,{cache:'no-store'});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data?.error||'Property search failed.');
      setConfigured(Boolean(data.configured));
      setProviders(Array.isArray(data.providers)?data.providers:[]);
      setListings(Array.isArray(data.listings)?data.listings:[]);
      setSelectedId(data.listings?.[0]?.id||'');
      setMessage(data.message||'Search complete.');
      if(params?.query||Number.isFinite(params?.lat))setLastSearch(params);
    } catch(error){setListings([]);setSelectedId('');setMessage(String(error?.message||error||'Search failed.'));}
    finally{setBusy(false)}
  }

  useEffect(()=>{load({});},[]);

  function submit(event){event.preventDefault();const q=query.trim();if(!q){setMessage('Enter a city, country, ZIP/postcode or address.');return}load({query:q});}
  function nearMe(){
    if(!navigator.geolocation){setMessage('Location services are unavailable in this browser.');return}
    setBusy(true);setMessage('Getting your location…');
    navigator.geolocation.getCurrentPosition(
      pos=>{setQuery('Near me');load({lat:pos.coords.latitude,lng:pos.coords.longitude});},
      err=>{setBusy(false);setMessage(err.message||'Location permission was not granted.');},
      {enableHighAccuracy:false,timeout:10000,maximumAge:300000},
    );
  }
  function globeLocation({latitude,longitude}){
    const label=`${latitude.toFixed(2)}°, ${longitude.toFixed(2)}°`;
    setQuery(label);setMessage(`Searching connected real-estate feeds around ${label}…`);load({lat:latitude,lng:longitude});
  }
  function chooseCategory(next){setCategory(next);if(lastSearch)load(lastSearch,next,type);}
  function chooseType(next){setType(next);if(lastSearch)load(lastSearch,category,next);}

  return <main className="page">
    <header><Link href="/vault">VOXEL VAULT</Link><nav><Link href="/vault/estates/mine">MY TWINS</Link><Link href="/vault/properties/claim">VERIFY PROPERTY</Link></nav></header>

    <section className="hero">
      <div className="heroCopy"><div className="kicker"><i/> GLOBAL EARTH · LIVE AUTHORIZED DATA</div><h1>The whole Earth.<br/><em>Real listings only.</em></h1><p>Explore property anywhere in the world. Voxel Vault federates authorized listing providers into one simple spatial view and never fills unsupported regions with fictional inventory.</p>
        <form onSubmit={submit} className="heroSearch"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="City, country, postcode or address"/><button disabled={busy}>{busy?'SEARCHING…':'SEARCH EARTH'}</button><button type="button" onClick={nearMe} disabled={busy}>NEAR ME</button></form>
        <div className="liveLine"><span>{liveProviders.length} LIVE DATA PROVIDER{liveProviders.length===1?'':'S'}</span><span>{listings.length} LISTING{listings.length===1?'':'S'} IN THIS VIEW</span></div>
      </div>
      <div className="globeCard"><GlobalEarthGlobe listings={listings} selectedId={selected?.id||''} onSelect={setSelectedId} onLocation={globeLocation}/><div className="globeHint">DRAG TO ROTATE · TAP EARTH TO SEARCH · TAP MARKER TO OPEN</div></div>
    </section>

    <section className="coverage">
      <div className="coverageTitle"><b>LIVE COVERAGE</b><span>Worldwide interface · listings appear only where an authorized feed is connected.</span></div>
      <div className="providerRail">{providers.length?providers.map(provider=><div key={provider.id} className={provider.configured?'provider live':'provider'}><i/><div><b>{provider.name}</b><span>{provider.regions?.join(' · ')||'Configured region'}</span></div><strong>{provider.configured?'LIVE':'AWAITING ACCESS'}</strong></div>):<div className="provider"><i/><div><b>Provider status loading</b><span>Checking authorized data connections.</span></div></div>}</div>
    </section>

    <section className="filters">
      <div>{[['all','Buy + Rent'],['sale','For Sale'],['rent','For Rent']].map(([id,label])=><button key={id} className={type===id?'active':''} onClick={()=>chooseType(id)}>{label}</button>)}</div>
      <div className="categories">{CATEGORIES.map(([id,label])=><button key={id} className={category===id?'active':''} onClick={()=>chooseCategory(id)}>{label}</button>)}</div>
      <p className={configured===false?'message warning':'message'}>{message}</p>
    </section>

    <section className="workspace">
      <div className="results">
        {listings.length===0?<div className="empty"><b>{configured===false?'CONNECT AUTHORIZED LISTING FEEDS':'NO LIVE LISTINGS IN THIS VIEW'}</b><span>{configured===false?'The globe works worldwide now. Real listing markers will appear as licensed feeds are connected; Voxel Vault will not invent properties.':'Try another city/country, tap another point on Earth, or change filters.'}</span></div>:listings.map(item=><button key={item.id} className={selected?.id===item.id?'listing active':'listing'} onClick={()=>setSelectedId(item.id)}>
          <div className="photo">{item.imageUrl?<img src={item.imageUrl} alt="" referrerPolicy="no-referrer"/>:<span>{categoryLabel(item.category)}</span>}</div>
          <div className="listingBody"><div className="sourceTag">{shortProvider(item.provider)} · {item.country||'Earth'}</div><strong>{money(item)}</strong><b>{item.address||'Address available from source'}</b><small>{[item.city,item.region,item.postalCode].filter(Boolean).join(', ')}</small><div>{item.beds!=null?`${item.beds} bd · `:''}{item.baths!=null?`${item.baths} ba · `:''}{item.livingAreaSqft?`${Math.round(item.livingAreaSqft).toLocaleString()} sqft`:categoryLabel(item.category)}</div></div>
        </button>)}
      </div>

      <div className="detail">
        {selected?<><div className="visual"><PropertyModel property={selected}/><div className="visualLabel">VOXEL VAULT 3D VIEW · {selected.country||'EARTH'} · {categoryLabel(selected.category).toUpperCase()}</div></div>
          <div className="detailBody"><div className="source"><i/>{selected.provider} · {selected.status}</div><h2>{selected.address||'Real Earth property'}</h2><p className="location">{[selected.city,selected.region,selected.postalCode,selected.country].filter(Boolean).join(', ')}</p>
          <div className="price"><span>{selected.marketValueLabel}</span><strong>{money(selected)}</strong><small>{selected.modifiedAt?`Source updated ${new Date(selected.modifiedAt).toLocaleDateString()}`:'Verify latest availability at source'}</small></div>
          <div className="facts"><div><b>{selected.beds??'—'}</b><span>BEDS</span></div><div><b>{selected.baths??'—'}</b><span>BATHS</span></div><div><b>{selected.livingAreaSqft?Math.round(selected.livingAreaSqft).toLocaleString():'—'}</b><span>SQ FT</span></div><div><b>{categoryLabel(selected.category)}</b><span>TYPE</span></div></div>
          <a className="primary" href={selected.sourceUrl||safeMapUrl(selected)} target="_blank" rel="noreferrer">{selected.sourceUrl?'OPEN REAL SOURCE LISTING':'OPEN EARTH LOCATION'} ↗</a>
          <Link className="secondary" href="/vault/properties/claim">VERIFY OWNER · CREATE PROPERTY PASSPORT</Link>
          <div className="mintCallout"><b>MINTING RECOMMENDED AFTER VERIFICATION</b><span>Use the optional onchain twin as provenance / backup and wallet visibility. It does not replace the deed or guarantee appreciation.</span></div>
          <p className="fine"><b>Physical purchase:</b> the real property still transfers through the source/broker, contract, title, escrow/attorney, funding and deed-recording process.</p></div></>:<div className="detailEmpty"><b>SELECT A REAL PROPERTY</b><span>Search or tap the globe. Only source-backed listings appear here.</span></div>}
      </div>
    </section>

    <footer><b>GLOBAL VALUE TRACKING</b><span>Each listing keeps its source currency and latest authorized source price/value. Property-market values can change with the real source; a digital twin’s resale value is separate and never guaranteed.</span></footer>
    <style jsx>{`
      :global(body){margin:0;background:#07090c;color:#f7f8fa;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.page{min-height:100vh;padding:0 clamp(14px,3vw,38px) 70px;background:radial-gradient(circle at 77% 8%,rgba(89,72,218,.13),transparent 25%),radial-gradient(circle at 20% 20%,rgba(80,220,170,.06),transparent 22%),#07090c}header{height:64px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,.07)}header>a{font-size:10px;letter-spacing:.16em;font-weight:950;color:#fff;text-decoration:none}nav{display:flex;gap:7px}nav a{font-size:7px;font-weight:900;color:#9199aa;text-decoration:none;border:1px solid rgba(255,255,255,.09);border-radius:999px;padding:9px 11px}.hero{display:grid;grid-template-columns:minmax(0,1fr) minmax(380px,.72fr);gap:22px;padding:42px 0 24px;align-items:stretch}.heroCopy{padding:20px 0}.kicker{font-size:8px;letter-spacing:.17em;font-weight:950;color:#8e97a8}.kicker i,.source i{display:inline-block;width:6px;height:6px;border-radius:50%;background:#79efbc;margin-right:8px;box-shadow:0 0 16px #79efbc}.hero h1{font-size:clamp(52px,7vw,96px);letter-spacing:-.07em;line-height:.86;margin:16px 0 20px}.hero h1 em{font-style:normal;color:#767f90}.hero p{max-width:680px;color:#8d96a7;font-size:13px;line-height:1.75}.heroSearch{display:grid;grid-template-columns:1fr auto auto;gap:7px;margin-top:24px}.heroSearch input{min-width:0;border:1px solid rgba(255,255,255,.11);background:rgba(255,255,255,.05);color:#fff;border-radius:14px;padding:15px 16px;font:inherit;font-size:11px;outline:none}.heroSearch input::placeholder{color:#646d7c}.heroSearch button{border:0;border-radius:14px;padding:0 15px;background:#fff;color:#080a0d;font-size:7px;font-weight:950;letter-spacing:.08em}.heroSearch button:last-child{background:rgba(121,239,188,.1);border:1px solid rgba(121,239,188,.18);color:#8df2d0}.liveLine{display:flex;gap:18px;margin-top:13px}.liveLine span{font-size:7px;color:#6e7788;letter-spacing:.12em;font-weight:900}.globeCard{position:relative;min-height:430px;border:1px solid rgba(255,255,255,.08);border-radius:28px;overflow:hidden;background:radial-gradient(circle at 50% 45%,rgba(42,76,64,.35),transparent 43%),linear-gradient(150deg,#0d1117,#080a0e)}.globeHint{position:absolute;left:14px;right:14px;bottom:13px;z-index:2;text-align:center;font-size:6px;color:#778292;letter-spacing:.12em;font-weight:900;background:rgba(5,8,10,.58);border:1px solid rgba(255,255,255,.07);padding:8px;border-radius:999px;pointer-events:none}.coverage{border-top:1px solid rgba(255,255,255,.07);border-bottom:1px solid rgba(255,255,255,.07);padding:16px 0}.coverageTitle{display:flex;justify-content:space-between;gap:16px;align-items:center;margin-bottom:10px}.coverageTitle b{font-size:8px;letter-spacing:.14em}.coverageTitle span{font-size:8px;color:#727b8b}.providerRail{display:flex;gap:8px;overflow:auto;padding-bottom:2px}.provider{flex:0 0 270px;display:grid;grid-template-columns:auto 1fr auto;gap:9px;align-items:center;border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:11px;background:rgba(255,255,255,.025)}.provider>i{width:7px;height:7px;border-radius:50%;background:#4e5664}.provider.live>i{background:#79efbc;box-shadow:0 0 13px #79efbc}.provider div{min-width:0}.provider b{display:block;font-size:8px}.provider span{display:block;color:#687182;font-size:6px;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.provider strong{font-size:6px;color:#626c7d;letter-spacing:.08em}.provider.live strong{color:#79efbc}.filters{position:sticky;top:0;z-index:5;padding:12px 0;background:rgba(7,9,12,.93);backdrop-filter:blur(14px);border-bottom:1px solid rgba(255,255,255,.07)}.filters>div{display:flex;gap:6px;overflow:auto;margin-bottom:7px}.filters button{white-space:nowrap;border:1px solid rgba(255,255,255,.09);background:transparent;color:#7c8596;border-radius:999px;padding:8px 10px;font-size:7px;font-weight:900}.filters button.active{background:#fff;color:#080a0d;border-color:#fff}.message{margin:8px 2px 0;font-size:8px;color:#767f90}.message.warning{color:#e8bd75}.workspace{display:grid;grid-template-columns:minmax(330px,.72fr) minmax(480px,1.28fr);gap:14px;padding-top:16px}.results{display:grid;gap:8px;align-content:start;max-height:790px;overflow:auto;padding-right:2px}.listing{display:grid;grid-template-columns:124px 1fr;gap:12px;text-align:left;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.025);border-radius:18px;padding:8px;color:#fff}.listing.active{border-color:rgba(121,239,188,.28);background:rgba(121,239,188,.035)}.photo{height:105px;border-radius:12px;background:linear-gradient(140deg,#18231e,#10141a);overflow:hidden;display:grid;place-items:center}.photo img{width:100%;height:100%;object-fit:cover}.photo span{font-size:7px;font-weight:900;color:#8b998f}.listingBody{display:flex;flex-direction:column;justify-content:center;min-width:0}.sourceTag{font-size:6px!important;color:#79cbb1!important;letter-spacing:.08em;text-transform:uppercase}.listingBody strong{font-size:19px;letter-spacing:-.04em;margin-top:3px}.listingBody b{font-size:9px;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.listingBody small,.listingBody>div{font-size:7px;color:#717b8b;margin-top:4px}.detail{background:linear-gradient(145deg,rgba(255,255,255,.055),rgba(255,255,255,.018));border:1px solid rgba(255,255,255,.08);border-radius:25px;overflow:hidden;min-height:650px}.visual{height:390px;background:linear-gradient(#10151b,#0b0e12);position:relative}.model{position:absolute;inset:0}.visualLabel{position:absolute;left:14px;bottom:14px;background:rgba(6,9,11,.72);border:1px solid rgba(255,255,255,.08);padding:8px 10px;border-radius:999px;font-size:6px;font-weight:950;letter-spacing:.1em;color:#8aeecb}.detailBody{padding:24px}.source{font-size:7px;letter-spacing:.12em;font-weight:950;color:#8791a2}.detail h2{font-size:34px;letter-spacing:-.05em;margin:10px 0 3px}.location{font-size:10px;color:#788192;margin:0 0 19px}.price{border-top:1px solid rgba(255,255,255,.07);border-bottom:1px solid rgba(255,255,255,.07);padding:14px 0;display:grid;grid-template-columns:1fr auto;gap:4px}.price span,.price small{font-size:7px;color:#747d8e;font-weight:850;letter-spacing:.08em}.price strong{font-size:26px;letter-spacing:-.04em;grid-row:1/3;grid-column:2}.facts{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:16px 0}.facts div{border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:11px}.facts b{display:block;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.facts span{display:block;font-size:6px;color:#737c8c;margin-top:3px;letter-spacing:.08em}.primary,.secondary{display:block;text-align:center;text-decoration:none;border-radius:13px;padding:14px;margin-top:7px;font-size:8px;font-weight:950;letter-spacing:.08em}.primary{background:#fff;color:#080a0d}.secondary{border:1px solid rgba(255,255,255,.1);color:#fff}.mintCallout{margin-top:13px;border:1px solid rgba(121,239,188,.14);background:rgba(121,239,188,.035);border-radius:13px;padding:12px;display:grid;gap:5px}.mintCallout b{font-size:7px;letter-spacing:.1em;color:#91e7ca}.mintCallout span{font-size:8px;color:#737e8e;line-height:1.5}.fine{font-size:8px;line-height:1.6;color:#717a8a;margin:13px 2px 0}.fine b{color:#a3abb8}.empty,.detailEmpty{border:1px dashed rgba(255,255,255,.12);border-radius:18px;padding:30px;display:grid;gap:8px;color:#737d8d}.empty b,.detailEmpty b{font-size:8px;letter-spacing:.12em;color:#b6bdc8}.empty span,.detailEmpty span{font-size:9px;line-height:1.6}.detailEmpty{margin:24px}footer{margin-top:25px;padding-top:20px;border-top:1px solid rgba(255,255,255,.07);display:grid;grid-template-columns:150px 1fr;gap:12px;color:#70798a}footer b{font-size:7px;letter-spacing:.12em;color:#abb2be}footer span{font-size:8px;line-height:1.6}@media(max-width:940px){.hero{grid-template-columns:1fr}.globeCard{min-height:380px}.workspace{grid-template-columns:1fr}.results{max-height:470px}.detail{min-height:0}.visual{height:330px}}@media(max-width:560px){.page{padding:0 10px 55px}header nav a:last-child{display:none}.hero{padding-top:25px}.hero h1{font-size:56px}.heroSearch{grid-template-columns:1fr auto}.heroSearch button:last-child{grid-column:1/3;padding:12px}.globeCard{min-height:340px;border-radius:22px}.coverageTitle span{display:none}.workspace{padding-top:12px}.listing{grid-template-columns:105px 1fr}.photo{height:92px}.facts{grid-template-columns:repeat(2,1fr)}.detail h2{font-size:28px}.visual{height:300px}.coverageTitle{margin-bottom:8px}}
    `}</style>
  </main>
}
