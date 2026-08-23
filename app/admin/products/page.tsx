'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { getSupabaseBrowser } from '../../../lib/supabase-browser';

type Product = Record<string, any> & { id: string; readiness?: { ready: boolean; missing: string[]; invalid: string[] } };
const fields = [
  ['name','Product name'],['source_name','Supplier name'],['source_url','Supplier URL'],['physical_sku','Physical SKU'],
  ['source_price_cents','Supplier price (cents)'],['retail_price_cents','Vault price (cents)'],
  ['fulfillment_provider','Authorized fulfillment adapter'],['fulfillment_sku','Fulfillment SKU'],
  ['model_uri','GLB/GLTF URI'],['usdz_uri','USDZ URI'],['model_license','Model rights'],
  ['model_license_uri','Rights evidence URI'],['model_hash','GLB SHA-256'],['contract_address','NFT contract'],['chain_id','Base chain ID'],
  ['token_id','Pre-minted token ID'],['mint_tx_hash','Confirmed mint transaction'],
] as const;

async function api(path: string, token: string, init?: RequestInit) {
  const response = await fetch(path, { ...init, headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, ...(init?.headers || {}) } });
  const payload = await response.json();
  if (!response.ok) throw Object.assign(new Error(payload.error || 'Request failed.'), { payload });
  return payload;
}

export default function ProductPublisherPage() {
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const [session,setSession] = useState<any>(null);
  const [email,setEmail] = useState('');
  const [products,setProducts] = useState<Product[]>([]);
  const [selectedId,setSelectedId] = useState('');
  const [sourceUrl,setSourceUrl] = useState('');
  const [status,setStatus] = useState('');
  const [busy,setBusy] = useState(false);
  const selected = useMemo(() => products.find((product) => product.id === selectedId) || null, [products, selectedId]);

  useEffect(() => {
    if (!configured) return;
    const db = getSupabaseBrowser();
    db.auth.getSession().then(({data}) => setSession(data.session));
    const { data } = db.auth.onAuthStateChange((_event,next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, [configured]);

  useEffect(() => {
    if (!session?.access_token) return;
    setBusy(true);
    api('/api/admin/products', session.access_token).then(({products: next}) => {
      setProducts(next);
      setSelectedId((current) => current || next[0]?.id || '');
    }).catch((error) => setStatus(error.message)).finally(() => setBusy(false));
  }, [session?.access_token]);

  async function signIn(event: FormEvent) {
    event.preventDefault();
    const { error } = await getSupabaseBrowser().auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: `${window.location.origin}/admin/products` } });
    setStatus(error?.message || 'Check your email for the secure sign-in link.');
  }

  async function createDraft(event: FormEvent) {
    event.preventDefault();
    if (!session?.access_token) return;
    setBusy(true); setStatus('');
    try {
      const { product } = await api('/api/admin/products', session.access_token, { method:'POST', body: JSON.stringify({ sourceUrl }) });
      setProducts((current) => [product, ...current]);
      setSelectedId(product.id); setSourceUrl(''); setStatus('Draft created.');
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Unable to create draft.'); }
    finally { setBusy(false); }
  }

  function change(key: string, value: string) {
    setProducts((current) => current.map((product) => product.id === selectedId ? { ...product, [key]: value } : product));
  }

  async function update(action: 'save'|'review') {
    if (!selected || !session?.access_token) return;
    setBusy(true); setStatus('');
    const body: Record<string, unknown> = { action };
    for (const [key] of fields) body[key] = selected[key] ?? '';
    body.source_price_cents = selected.source_price_cents ? Number(selected.source_price_cents) : null;
    body.retail_price_cents = selected.retail_price_cents ? Number(selected.retail_price_cents) : null;
    body.chain_id = selected.chain_id ? Number(selected.chain_id) : null;
    body.fulfillment_status = selected.fulfillment_status;
    body.shipping_status = selected.shipping_status;
    body.mint_status = selected.mint_status;
    body.inventory_status = selected.inventory_status;
    try {
      const { product } = await api(`/api/admin/products/${selected.id}`, session.access_token, { method:'PATCH', body:JSON.stringify(body) });
      setProducts((current) => current.map((item) => item.id === product.id ? product : item));
      setStatus(action === 'review' && product.status === 'ready' ? 'Product passed the Vault Ready checks.' : 'Draft saved.');
    } catch (error: any) {
      if (error?.payload?.readiness) change('readiness', error.payload.readiness as any);
      setStatus(error instanceof Error ? error.message : 'Unable to update draft.');
    } finally { setBusy(false); }
  }

  async function verifyMint() {
    if (!selected || !session?.access_token) return;
    setBusy(true); setStatus('');
    try {
      await update('save');
      const {product} = await api(`/api/admin/products/${selected.id}/verify-mint`,session.access_token,{method:'POST'});
      setProducts((current)=>current.map((item)=>item.id===product.id?product:item));
      setStatus('Mint confirmed on Base.');
    } catch(error) { setStatus(error instanceof Error?error.message:'Mint verification failed.'); }
    finally { setBusy(false); }
  }

  if (!configured) return <main className="publisher"><p className="notice">Vault accounts are not configured.</p><Styles/></main>;
  if (!session) return <main className="publisher"><header><Link href="/">VOXEL VAULT</Link><span>PRODUCT PUBLISHER</span></header><form className="signin" onSubmit={signIn}><h1>Admin sign in</h1><label>Email<input required type="email" value={email} onChange={(event)=>setEmail(event.target.value)}/></label><button>Send secure link</button>{status&&<p role="status">{status}</p>}</form><Styles/></main>;

  const readiness = selected?.readiness || {ready:false,missing:[],invalid:[]};
  return <main className="publisher">
    <header><Link href="/">VOXEL VAULT</Link><span>PRODUCT PUBLISHER</span><button onClick={()=>getSupabaseBrowser().auth.signOut()}>Sign out</button></header>
    <div className="workspace">
      <aside>
        <form className="import" onSubmit={createDraft}><label>Supplier product URL<input required type="url" placeholder="https://supplier.example/product" value={sourceUrl} onChange={(event)=>setSourceUrl(event.target.value)}/></label><button disabled={busy}>Create draft</button></form>
        <nav aria-label="Product drafts">{products.map((product)=><button className={product.id===selectedId?'active':''} key={product.id} onClick={()=>setSelectedId(product.id)}><strong>{product.name||product.source_host}</strong><span>{product.status}</span></button>)}</nav>
      </aside>
      <section className="editor">
        {!selected?<div className="empty">Create a supplier draft to begin.</div>:<>
          <div className="editorHead"><div><small>{selected.source_host}</small><h1>{selected.name||'Untitled product'}</h1></div><b data-ready={readiness.ready}>{readiness.ready?'Vault Ready':'Not ready'}</b></div>
          <div className="formGrid">{fields.map(([key,label])=><label className={key.endsWith('_url')||key.endsWith('_uri')||key==='model_license'||key==='mint_tx_hash'?'wide':''} key={key}>{label}<input type={key.includes('price')||key==='chain_id'?'number':'text'} value={selected[key]??''} onChange={(event)=>change(key,event.target.value)}/></label>)}</div>
          <div className="states">
            <label>Fulfillment<select value={selected.fulfillment_status} onChange={(e)=>change('fulfillment_status',e.target.value)}><option value="unverified">Unverified</option><option value="testing">Testing</option><option value="verified">Verified</option><option value="blocked">Blocked</option></select></label>
            <label>Shipping + returns<select value={selected.shipping_status} onChange={(e)=>change('shipping_status',e.target.value)}><option value="unverified">Unverified</option><option value="testing">Testing</option><option value="verified">Verified</option><option value="blocked">Blocked</option></select></label>
            <label>Pre-mint receipt<span className="stateValue">{selected.mint_status?.replaceAll('_',' ')||'unverified'}</span><button type="button" disabled={busy||!selected.contract_address||!selected.token_id||!selected.mint_tx_hash} onClick={verifyMint}>Verify on Base</button></label>
            <label>Inventory<select value={selected.inventory_status} onChange={(e)=>change('inventory_status',e.target.value)}><option value="unverified">Unverified</option><option value="available">Available</option><option value="reserved">Reserved</option><option value="sold">Sold</option><option value="transferred">Transferred</option><option value="blocked">Blocked</option></select></label>
          </div>
          {!readiness.ready&&<div className="readiness"><strong>Required before publication</strong><ul>{[...(readiness.missing||[]),...(readiness.invalid||[]).map((item:string)=>`Invalid ${item}`)].map((item)=><li key={item}>{item}</li>)}</ul></div>}
          <footer><button disabled={busy} onClick={()=>update('save')}>Save draft</button><button className="publish" disabled={busy} onClick={()=>update('review')}>Run Vault Ready checks</button></footer>
        </>}
      </section>
    </div>
    {status&&<p className="toast" role="status">{status}</p>}<Styles/>
  </main>;
}

function Styles(){return <style jsx global>{`
  *{box-sizing:border-box}.publisher{min-height:100vh;background:#090b0e;color:#f5f7f9;font-family:Inter,system-ui,sans-serif}.publisher>header{height:60px;display:flex;align-items:center;gap:24px;padding:0 24px;border-bottom:1px solid #292d33;background:#111419}.publisher>header a{color:#fff;text-decoration:none;font-size:11px;font-weight:900}.publisher>header span{color:#99a2ad;font-size:10px;letter-spacing:.12em}.publisher>header button{margin-left:auto}.workspace{display:grid;grid-template-columns:300px minmax(0,1fr);min-height:calc(100vh - 60px)}aside{border-right:1px solid #292d33;background:#0d1014;padding:18px}.import{display:grid;gap:9px;padding-bottom:18px;border-bottom:1px solid #292d33}label{display:grid;gap:6px;color:#aeb5be;font-size:11px}input,select,.stateValue{width:100%;border:1px solid #343a43;border-radius:6px;background:#15191e;color:#fff;padding:10px;font:inherit}.stateValue{text-transform:capitalize}button{border:1px solid #3b424c;border-radius:6px;background:#1b2026;color:#f5f7f9;padding:10px 12px;font-weight:750;cursor:pointer}button:disabled{cursor:not-allowed;opacity:.45}aside nav{display:grid;margin-top:12px}aside nav button{display:flex;justify-content:space-between;gap:12px;border:0;border-bottom:1px solid #252a30;border-radius:0;background:transparent;text-align:left}aside nav button.active{background:#20262d;border-left:3px solid #70d6a6}aside nav strong{overflow:hidden;text-overflow:ellipsis}aside nav span{text-transform:uppercase;color:#8d96a1;font-size:8px}.editor{padding:28px;max-width:1120px;width:100%;margin:0 auto}.editorHead{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-bottom:24px}.editorHead small{color:#70d6a6;text-transform:uppercase}.editorHead h1{margin:6px 0 0;font-size:28px}.editorHead b{border:1px solid #864e40;border-radius:6px;color:#ffb19d;padding:8px 10px;text-transform:uppercase;font-size:9px}.editorHead b[data-ready="true"]{border-color:#39765a;color:#8cf0bd}.formGrid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.formGrid .wide{grid-column:1/-1}.states{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:20px;padding:18px 0;border-top:1px solid #292d33;border-bottom:1px solid #292d33}.readiness{margin-top:18px;border-left:3px solid #e0b34e;background:#171714;padding:14px 16px}.readiness strong{font-size:11px}.readiness ul{columns:2;margin:10px 0 0;padding-left:18px;color:#c9c1aa;font-size:10px;line-height:1.7}.editor footer{display:flex;justify-content:flex-end;gap:10px;margin-top:20px}.editor footer .publish{background:#70d6a6;border-color:#70d6a6;color:#07110c}.empty,.notice{margin:70px auto;max-width:560px;color:#aab1bb}.signin{max-width:420px;margin:100px auto;display:grid;gap:16px;border:1px solid #292d33;border-radius:8px;padding:24px;background:#111419}.signin h1{margin:0}.signin p{color:#d7c37f}.toast{position:fixed;right:20px;bottom:20px;margin:0;border:1px solid #424951;border-radius:6px;background:#1a1e23;padding:12px 16px;font-size:11px}@media(max-width:850px){.workspace{grid-template-columns:1fr}aside{border-right:0;border-bottom:1px solid #292d33}.formGrid,.states{grid-template-columns:1fr}.formGrid .wide{grid-column:auto}.readiness ul{columns:1}.editor{padding:20px}.editor footer{flex-wrap:wrap}}
`}</style>}
