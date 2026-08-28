'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';

const CATEGORIES = [
  ['all','All'],['house','Houses'],['condo','Condos'],['mobile-home','Mobile / Trailer'],['multifamily','Multifamily'],['storefront','Storefronts'],['commercial','Commercial'],['warehouse','Warehouses'],['barn-farm','Barns / Farms'],['land','Land'],
];

function money(cents, transactionType) {
  if (!Number.isFinite(Number(cents))) return 'Price on request';
  const value = Number(cents) / 100;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value) + (transactionType === 'rent' ? ' / mo' : '');
}

function addressLine(property) {
  return [property?.address, property?.city, property?.region, property?.postalCode].filter(Boolean).join(', ');
}

function safeMapUrl(property) {
  if (Number.isFinite(property?.latitude) && Number.isFinite(property?.longitude)) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${property.latitude},${property.longitude}`)}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressLine(property))}`;
}

function categoryLabel(category) {
  return CATEGORIES.find(([id]) => id === category)?.[1] || 'Property';
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
      const height = Math.max(320, mount.clientHeight || 420);
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
      renderer.setSize(width, height);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      mount.innerHTML = '';
      mount.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      scene.fog = new THREE.Fog(0x0b0d11, 18, 42);
      scene.add(new THREE.HemisphereLight(0xf7f9ff, 0x18201a, 2.25));
      const sun = new THREE.DirectionalLight(0xffffff, 3.2);
      sun.position.set(8, 13, 9);
      scene.add(sun);
      const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 100);
      const root = new THREE.Group();
      scene.add(root);
      const geometries = [];
      const materials = [];
      const mat = (color, roughness = .68, metalness = .04) => { const m = new THREE.MeshStandardMaterial({ color, roughness, metalness }); materials.push(m); return m; };
      const box = (w,h,d,color,x,y,z) => { const g = new THREE.BoxGeometry(w,h,d); geometries.push(g); const mesh = new THREE.Mesh(g,mat(color)); mesh.position.set(x,y,z); root.add(mesh); return mesh; };
      const slab = (w,d,color,x=0,z=0) => box(w,.18,d,color,x,-.2,z);

      slab(16,12,0x29352c);
      const category = property?.category || 'house';
      if (category === 'land') {
        slab(12,8,0x566b3f);
        for (let i=0;i<7;i+=1) box(.18,.18,.18,0xb7c999,-4.5+i*1.5,.05,-2+(i%2)*3);
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

      const ringG = new THREE.RingGeometry(6.8,6.95,64); geometries.push(ringG); const ringM = mat(0x78efbd,.32,.1); materials.push(ringM); const ring = new THREE.Mesh(ringG,ringM); ring.rotation.x=-Math.PI/2; ring.position.y=-.1; root.add(ring);
      let az=.68, el=.46, radius=20, dragging=false, lastX=0, lastY=0;
      const update=()=>{const c=Math.cos(el);camera.position.set(Math.sin(az)*c*radius,Math.sin(el)*radius,Math.cos(az)*c*radius);camera.lookAt(0,1.4,0)}; update();
      const down=e=>{dragging=true;lastX=e.clientX;lastY=e.clientY};
      const move=e=>{if(!dragging)return;az-=(e.clientX-lastX)*.008;el=Math.max(.2,Math.min(.95,el+(e.clientY-lastY)*.005));lastX=e.clientX;lastY=e.clientY;update()};
      const up=()=>{dragging=false};
      renderer.domElement.addEventListener('pointerdown',down);renderer.domElement.addEventListener('pointermove',move);renderer.domElement.addEventListener('pointerup',up);
      let frame; const animate=()=>{frame=requestAnimationFrame(animate);renderer.render(scene,camera)}; animate();
      const resize=()=>{if(!mountRef.current)return;const w=Math.max(300,mountRef.current.clientWidth||300),h=Math.max(320,mountRef.current.clientHeight||420);renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix()};window.addEventListener('resize',resize);
      cleanup=()=>{cancelAnimationFrame(frame);window.removeEventListener('resize',resize);geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());renderer.dispose();mount.innerHTML=''};
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
  const [selectedId,setSelectedId]=useState('');
  const [message,setMessage]=useState('Search a city, ZIP, address, or use your location.');
  const [configured,setConfigured]=useState(null);
  const [busy,setBusy]=useState(false);
  const selected=useMemo(()=>listings.find(item=>item.id===selectedId)||listings[0]||null,[listings,selectedId]);

  async function load(params) {
    setBusy(true);
    try {
      const search = new URLSearchParams({ category, type });
      if (params?.query) search.set('q',params.query);
      if (Number.isFinite(params?.lat)&&Number.isFinite(params?.lng)){search.set('lat',String(params.lat));search.set('lng',String(params.lng));}
      const response=await fetch(`/api/earth-properties/search?${search.toString()}`,{cache:'no-store'});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data?.error||'Property search failed.');
      setConfigured(Boolean(data.configured));setListings(Array.isArray(data.listings)?data.listings:[]);setSelectedId(data.listings?.[0]?.id||'');setMessage(data.message||'Search complete.');
    } catch(error){setListings([]);setSelectedId('');setMessage(String(error?.message||error||'Search failed.'));}
    finally{setBusy(false)}
  }

  function submit(event){event.preventDefault();load({query:query.trim()});}
  function nearMe(){
    if(!navigator.geolocation){setMessage('Location services are unavailable in this browser.');return}
    setBusy(true);setMessage('Getting your location…');
    navigator.geolocation.getCurrentPosition(
      pos=>{setQuery('Near me');load({lat:pos.coords.latitude,lng:pos.coords.longitude});},
      err=>{setBusy(false);setMessage(err.message||'Location permission was not granted.');},
      {enableHighAccuracy:false,timeout:10000,maximumAge:300000},
    );
  }

  useEffect(()=>{ if((query&&query!=='Near me')||listings.length) return; },[category,type]);

  return <main className="page">
    <header><Link href="/vault">VOXEL VAULT</Link><nav><Link href="/vault/estates/mine">MY DIGITAL TWINS</Link><Link href="/vault/properties/claim">VERIFY PROPERTY</Link></nav></header>
    <section className="hero"><div><div className="kicker">EARTH · VERIFIED DATA LAYER</div><h1>Real places.<br/><em>One simple view.</em></h1><p>Search real Earth listings from authorized property feeds. Voxel Vault adds the 3D layer and optional blockchain backup without pretending an NFT is the deed.</p></div><div className="truth"><b>REAL PROPERTY</b><span>Source listing + location + market price</span><b>DIGITAL BACKUP</b><span>Encouraged after owner/authorized verification</span></div></section>

    <section className="searchPanel">
      <form onSubmit={submit}><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="City, ZIP, or address"/><button disabled={busy}>{busy?'SEARCHING…':'SEARCH'}</button><button type="button" className="near" onClick={nearMe} disabled={busy}>NEAR ME</button></form>
      <div className="switches"><div>{[['all','Buy + Rent'],['sale','For Sale'],['rent','For Rent']].map(([id,label])=><button key={id} className={type===id?'active':''} onClick={()=>setType(id)}>{label}</button>)}</div><div className="categories">{CATEGORIES.map(([id,label])=><button key={id} className={category===id?'active':''} onClick={()=>setCategory(id)}>{label}</button>)}</div></div>
      <div className={`message ${configured===false?'needsFeed':''}`}>{message}{configured===false?<><br/><a href="https://www.zillowgroup.com/developers/api/mls-broker-data/mls-listings/" target="_blank" rel="noreferrer">REQUEST AUTHORIZED ZILLOW / BRIDGE MLS ACCESS ↗</a></>:null}</div>
    </section>

    <section className="workspace">
      <div className="results">
        {listings.length===0?<div className="empty"><b>{configured===false?'CONNECT A REAL LISTING FEED':'NO LISTINGS YET'}</b><span>{configured===false?'Voxel Vault will not fill this screen with fictional Earth properties. Once an authorized MLS/Bridge feed is connected, live listings appear here.':'Search another location or category.'}</span></div>:listings.map(item=><button key={item.id} className={selected?.id===item.id?'listing active':'listing'} onClick={()=>setSelectedId(item.id)}>
          <div className="photo">{item.imageUrl?<img src={item.imageUrl} alt="" referrerPolicy="no-referrer"/>:<span>{categoryLabel(item.category)}</span>}</div>
          <div className="listingBody"><strong>{money(item.marketValueCents,item.transactionType)}</strong><b>{item.address||'Address available from source'}</b><small>{[item.city,item.region,item.postalCode].filter(Boolean).join(', ')}</small><div>{item.beds!=null?`${item.beds} bd · `:''}{item.baths!=null?`${item.baths} ba · `:''}{item.livingAreaSqft?`${Math.round(item.livingAreaSqft).toLocaleString()} sqft`:categoryLabel(item.category)}</div></div>
        </button>)}
      </div>

      <div className="detail">
        {selected?<><div className="visual"><PropertyModel property={selected}/><div className="visualLabel">3D VOXEL VAULT VIEW · {categoryLabel(selected.category).toUpperCase()}</div></div>
          <div className="detailBody"><div className="source">{selected.provider} · {selected.status}</div><h2>{selected.address||'Real Earth property'}</h2><p className="location">{[selected.city,selected.region,selected.postalCode].filter(Boolean).join(', ')}</p>
          <div className="price"><span>{selected.marketValueLabel}</span><strong>{money(selected.marketValueCents,selected.transactionType)}</strong><small>{selected.modifiedAt?`Source updated ${new Date(selected.modifiedAt).toLocaleDateString()}`:'Use source for latest availability'}</small></div>
          <div className="facts"><div><b>{selected.beds??'—'}</b><span>BEDS</span></div><div><b>{selected.baths??'—'}</b><span>BATHS</span></div><div><b>{selected.livingAreaSqft?Math.round(selected.livingAreaSqft).toLocaleString():'—'}</b><span>SQ FT</span></div><div><b>{categoryLabel(selected.category)}</b><span>TYPE</span></div></div>
          <a className="primary" href={selected.sourceUrl||safeMapUrl(selected)} target="_blank" rel="noreferrer">{selected.sourceUrl?'OPEN SOURCE LISTING':'OPEN EARTH LOCATION'} ↗</a>
          <Link className="secondary" href="/vault/properties/claim">VERIFY OWNER / CREATE PROPERTY PASSPORT</Link>
          <p className="fine"><b>Real-property purchase:</b> use the listing/broker/closing process. A Voxel Vault digital twin or mint does not transfer the deed. Minting is encouraged after verification as a public provenance/backup layer, not as a guarantee of price appreciation.</p></div></>:<div className="detailEmpty"><b>SELECT A REAL PROPERTY</b><span>The 3D view stays intentionally lightweight for stability on phones.</span></div>}
      </div>
    </section>

    <footer><b>VALUE TRACKING</b><span>Voxel Vault displays the latest authorized source price/value and source update time. When the provider changes, the displayed market reference changes too. Digital-token resale value remains separate and is never guaranteed.</span></footer>
    <style jsx>{`
      :global(body){margin:0;background:#f5f5f2;color:#151615;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.page{min-height:100vh;padding:0 24px 60px}header{height:64px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #deded8}header>a{font-size:11px;letter-spacing:.15em;font-weight:950;color:#151615;text-decoration:none}nav{display:flex;gap:8px}nav a{font-size:8px;font-weight:900;color:#5f625f;text-decoration:none;border:1px solid #d7d8d2;border-radius:999px;padding:9px 12px}.hero{display:grid;grid-template-columns:1fr 360px;gap:30px;padding:58px 0 34px}.kicker{font-size:8px;letter-spacing:.17em;font-weight:950;color:#6b716b}.hero h1{font-size:clamp(48px,7vw,92px);letter-spacing:-.07em;line-height:.84;margin:14px 0 22px}.hero h1 em{font-style:normal;color:#797d78}.hero p{max-width:680px;color:#656a65;font-size:13px;line-height:1.7}.truth{align-self:end;border:1px solid #dcddd7;border-radius:20px;padding:18px;display:grid;grid-template-columns:auto 1fr;gap:8px 12px;background:#fff}.truth b{font-size:7px;letter-spacing:.11em}.truth span{font-size:8px;color:#757a75}.searchPanel{position:sticky;top:0;z-index:5;background:rgba(245,245,242,.94);backdrop-filter:blur(14px);border-top:1px solid #dddeda;border-bottom:1px solid #dddeda;padding:14px 0}.searchPanel form{display:grid;grid-template-columns:1fr auto auto;gap:8px}.searchPanel input{border:1px solid #cfd1cc;border-radius:13px;background:#fff;padding:14px 16px;font:inherit;font-size:12px;outline:none}.searchPanel form button{border:0;border-radius:13px;padding:0 18px;font-size:8px;font-weight:950;letter-spacing:.08em;background:#151615;color:#fff}.searchPanel form .near{background:#e8e9e4;color:#202220}.switches{display:flex;gap:12px;justify-content:space-between;margin-top:10px;overflow:auto}.switches>div{display:flex;gap:6px}.switches button{white-space:nowrap;border:1px solid #d6d7d1;background:transparent;color:#6b706b;border-radius:999px;padding:8px 10px;font-size:7px;font-weight:900}.switches button.active{background:#151615;color:#fff;border-color:#151615}.message{font-size:8px;color:#737873;margin-top:10px}.message a{color:#345c49;font-weight:900}.workspace{display:grid;grid-template-columns:minmax(330px,.72fr) minmax(480px,1.28fr);gap:16px;padding-top:18px}.results{display:grid;gap:8px;align-content:start;max-height:780px;overflow:auto;padding-right:3px}.listing{display:grid;grid-template-columns:125px 1fr;gap:12px;text-align:left;border:1px solid #dddeda;background:#fff;border-radius:18px;padding:8px;color:#151615}.listing.active{border-color:#7f887f;box-shadow:0 8px 30px rgba(30,40,30,.06)}.photo{height:105px;border-radius:12px;background:#e5e7e1;overflow:hidden;display:grid;place-items:center}.photo img{width:100%;height:100%;object-fit:cover}.photo span{font-size:7px;font-weight:900;color:#697069}.listingBody{display:flex;flex-direction:column;justify-content:center;min-width:0}.listingBody strong{font-size:19px;letter-spacing:-.04em}.listingBody b{font-size:10px;margin-top:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.listingBody small,.listingBody div{font-size:8px;color:#747974;margin-top:4px}.detail{background:#fff;border:1px solid #dddeda;border-radius:26px;overflow:hidden;min-height:650px}.visual{height:390px;background:linear-gradient(#e8ece8,#dfe5de);position:relative}.model{position:absolute;inset:0}.visualLabel{position:absolute;left:14px;bottom:14px;background:rgba(255,255,255,.82);border:1px solid rgba(20,25,20,.1);padding:8px 10px;border-radius:999px;font-size:7px;font-weight:950;letter-spacing:.1em}.detailBody{padding:24px}.source{font-size:7px;letter-spacing:.13em;font-weight:950;color:#6a706a}.detail h2{font-size:34px;letter-spacing:-.05em;margin:10px 0 3px}.location{font-size:11px;color:#767b76;margin:0 0 20px}.price{border-top:1px solid #ecece8;border-bottom:1px solid #ecece8;padding:14px 0;display:grid;grid-template-columns:1fr auto;gap:4px}.price span,.price small{font-size:7px;color:#777c77;font-weight:850;letter-spacing:.08em}.price strong{font-size:26px;letter-spacing:-.04em;grid-row:1/3;grid-column:2}.facts{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:16px 0}.facts div{border:1px solid #e3e4df;border-radius:12px;padding:11px}.facts b{display:block;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.facts span{display:block;font-size:6px;color:#808580;margin-top:3px;letter-spacing:.08em}.primary,.secondary{display:block;text-align:center;text-decoration:none;border-radius:13px;padding:14px;margin-top:7px;font-size:8px;font-weight:950;letter-spacing:.08em}.primary{background:#161716;color:#fff}.secondary{border:1px solid #d6d7d1;color:#161716}.fine{font-size:8px;line-height:1.6;color:#777c77;margin:16px 2px 0}.fine b{color:#313431}.empty,.detailEmpty{border:1px dashed #cfd2cb;border-radius:18px;padding:30px;display:grid;gap:8px;color:#6f746f}.empty b,.detailEmpty b{font-size:9px;letter-spacing:.12em;color:#353835}.empty span,.detailEmpty span{font-size:10px;line-height:1.6}.detailEmpty{margin:24px}footer{margin-top:26px;padding-top:20px;border-top:1px solid #dcddd7;display:grid;grid-template-columns:140px 1fr;gap:12px;color:#747974}footer b{font-size:8px;letter-spacing:.12em;color:#333633}footer span{font-size:8px;line-height:1.6}@media(max-width:900px){.page{padding:0 12px 50px}.hero{grid-template-columns:1fr;padding-top:34px}.truth{display:none}.workspace{grid-template-columns:1fr}.results{max-height:460px}.detail{min-height:0}.visual{height:330px}.searchPanel{top:0}.switches{display:block}.switches>div{overflow:auto;margin-top:7px}.hero h1{font-size:58px}}@media(max-width:520px){header nav a:last-child{display:none}.searchPanel form{grid-template-columns:1fr auto}.searchPanel form .near{grid-column:1/3;padding:12px}.listing{grid-template-columns:105px 1fr}.photo{height:92px}.facts{grid-template-columns:repeat(2,1fr)}.detail h2{font-size:28px}.visual{height:300px}}
    `}</style>
  </main>
}
