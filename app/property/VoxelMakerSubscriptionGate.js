'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getSupabaseBrowserAsync } from '../../lib/supabase-browser';
import { VOXEL_MAKER_PLANS, formatVoxelMakerPrice } from '../../lib/voxel-maker-plans';

function clean(value) { return String(value || '').trim(); }
function perVoxelLabel(plan) {
  const monthlyVoxels = Math.max(1, Number(plan?.monthlyVoxels || 0));
  const monthlyPrice = Math.max(0, Number(plan?.priceCents || 0)) / 100;
  return `$${(monthlyPrice / monthlyVoxels).toFixed(2)} / voxel`;
}

export default function VoxelMakerSubscriptionGate({ children }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [busyPlan, setBusyPlan] = useState('');
  const [message, setMessage] = useState('');
  const clientRef = useRef(null);
  const autoCheckoutRef = useRef(false);

  const loadStatus = useCallback(async (accessToken) => {
    if (!accessToken) {
      setSubscription(null);
      return null;
    }
    setLoadingStatus(true);
    try {
      const response = await fetch('/api/voxel-maker/subscription/status', {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || 'Could not check your Voxel Maker plan.');
      setSubscription(data);
      return data;
    } catch (error) {
      setMessage(clean(error?.message || error || 'Could not check your Voxel Maker plan.'));
      return null;
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    let authSubscription = null;
    getSupabaseBrowserAsync().then(async (client) => {
      if (!active) return;
      clientRef.current = client;
      const { data } = await client.auth.getSession();
      if (!active) return;
      const nextSession = data.session || null;
      setSession(nextSession);
      setReady(true);
      if (nextSession?.access_token) loadStatus(nextSession.access_token);
      const auth = client.auth.onAuthStateChange((_event, next) => {
        if (!active) return;
        setSession(next || null);
        setReady(true);
        if (next?.access_token) loadStatus(next.access_token);
        else setSubscription(null);
      });
      authSubscription = auth.data.subscription;
    }).catch(() => {
      if (active) {
        setReady(true);
        setMessage('Sign-in is unavailable on this deployment.');
      }
    });
    return () => { active = false; authSubscription?.unsubscribe?.(); };
  }, [loadStatus]);

  async function signInForPlan(planId) {
    setBusyPlan(planId);
    setMessage('Opening secure sign-in…');
    try {
      const client = clientRef.current || await getSupabaseBrowserAsync();
      clientRef.current = client;
      const redirect = new URL('/property', window.location.origin);
      redirect.searchParams.set('choose', planId);
      const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirect.toString() } });
      if (error) throw error;
    } catch (error) {
      setBusyPlan('');
      setMessage(clean(error?.message || error || 'Could not sign in.'));
    }
  }

  const checkout = useCallback(async (planId) => {
    if (!session?.access_token) return signInForPlan(planId);
    setBusyPlan(planId);
    setMessage('Opening secure monthly checkout…');
    try {
      const response = await fetch('/api/voxel-maker/subscription/checkout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
      });
      const data = await response.json().catch(() => ({}));
      if (data?.active) {
        await loadStatus(session.access_token);
        setBusyPlan('');
        return;
      }
      if (!response.ok || !data?.url) throw new Error(data?.error || 'Checkout is unavailable.');
      window.location.assign(data.url);
    } catch (error) {
      setBusyPlan('');
      setMessage(clean(error?.message || error || 'Checkout is unavailable.'));
    }
  }, [session?.access_token, loadStatus]);

  useEffect(() => {
    if (!ready || !session?.access_token || loadingStatus || subscription?.active || autoCheckoutRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const planId = clean(params.get('choose')).toLowerCase();
    if (!VOXEL_MAKER_PLANS.some((plan) => plan.id === planId)) return;
    autoCheckoutRef.current = true;
    params.delete('choose');
    const next = `${window.location.pathname}${params.toString() ? `?${params}` : ''}`;
    window.history.replaceState({}, '', next);
    checkout(planId);
  }, [ready, session?.access_token, subscription?.active, loadingStatus, checkout]);

  useEffect(() => {
    if (!session?.access_token) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('subscription') !== 'success') return;
    let cancelled = false;
    let attempts = 0;
    const refresh = async () => {
      attempts += 1;
      const result = await loadStatus(session.access_token);
      if (cancelled || result?.active || attempts >= 4) return;
      window.setTimeout(refresh, 900);
    };
    refresh();
    params.delete('subscription');
    const next = `${window.location.pathname}${params.toString() ? `?${params}` : ''}`;
    window.history.replaceState({}, '', next);
    return () => { cancelled = true; };
  }, [session?.access_token, loadStatus]);

  async function manageBilling() {
    if (!session?.access_token) return;
    setMessage('Opening billing…');
    try {
      const response = await fetch('/api/voxel-maker/subscription/portal', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.url) throw new Error(data?.error || 'Billing management is unavailable.');
      window.location.assign(data.url);
    } catch (error) {
      setMessage(clean(error?.message || error || 'Billing management is unavailable.'));
    }
  }

  if (!ready) return <main className="vmPage"><div className="vmLoading"><div className="vmCube">V</div><strong>Opening Voxel Maker…</strong></div><style jsx>{styles}</style></main>;

  if (subscription?.active) {
    const used = Number(subscription?.usage?.used || 0);
    const limit = Number(subscription?.usage?.limit || subscription?.plan?.monthlyVoxels || 0);
    return <>
      <div className="vmPlanBar">
        <div className="vmPlanIdentity"><span className="vmDot"/><strong>Voxel Maker {subscription.plan?.name}</strong><small>{used}/{limit} creations this month</small></div>
        <div className="vmPlanActions"><span>{formatVoxelMakerPrice(subscription.plan?.priceCents || 0)}/mo</span>{subscription.canManageBilling ? <button type="button" onClick={manageBilling}>Manage</button> : null}</div>
      </div>
      {children}
      <style jsx>{styles}</style>
    </>;
  }

  return <main className="vmPage">
    <section className="vmShell">
      <header className="vmHero">
        <div className="vmBrand"><div className="vmCube">V</div><span>VOXEL VAULT</span></div>
        <p className="vmEyebrow">VOXEL MAKER</p>
        <h1>Turn houses into<br/><em>collectible voxels.</em></h1>
        <p className="vmLead">Upload a house photo, confirm its address, build the voxel, save it to your inventory, and mint it when you want.</p>
        <div className="vmFlow"><span>PHOTO</span><b>→</b><span>ADDRESS</span><b>→</b><span>VOXEL</span><b>→</b><span>INVENTORY</span></div>
      </header>

      <div className="vmPricingHeading"><div><p className="vmEyebrow">MONTHLY PLANS</p><h2>Pick how much you create.</h2></div><p>Cancel anytime. Minting stays optional.</p></div>
      <div className="vmChoiceHint"><div><span>★ RECOMMENDED</span><strong>Creator · $29/mo</strong><small>The best balance for most creators.</small></div><p>Need maximum capacity? Studio gives you 60 creations and the lowest cost per voxel.</p></div>

      <div className="vmPlans">
        {VOXEL_MAKER_PLANS.map((plan) => <article key={plan.id} className={`vmPlan vmPlan-${plan.id}`}>
          {plan.id === 'creator' ? <div className="vmRecommendedFlag">RECOMMENDED</div> : null}
          <div className="vmPlanTop"><div><p>{plan.name}</p>{plan.badge ? <span>{plan.badge}</span> : null}</div><div className="vmPrice"><strong>{formatVoxelMakerPrice(plan.priceCents)}<small>/mo</small></strong><em>{perVoxelLabel(plan)} <small>at full use</small></em></div></div>
          <h3>{plan.monthlyVoxels} voxels <small>each month</small></h3>
          {plan.id === 'creator' ? <div className="vmValueCallout">BEST BALANCE OF PRICE + CAPACITY</div> : null}
          {plan.id === 'studio' ? <div className="vmValueCallout vmValueCalloutStudio">LOWEST COST PER VOXEL</div> : null}
          <p className="vmBlurb">{plan.blurb}</p>
          <ul>{plan.features.map((feature) => <li key={feature}><span>✓</span>{feature}</li>)}</ul>
          <button type="button" onClick={() => checkout(plan.id)} disabled={Boolean(busyPlan)}>{busyPlan === plan.id ? 'Opening…' : session?.user ? `Choose ${plan.name}` : `Start ${plan.name}`}</button>
        </article>)}
      </div>

      {!session?.user ? <p className="vmSigninNote">Choosing a plan starts with Google sign-in so your voxels stay attached to your inventory.</p> : null}
      {loadingStatus ? <p className="vmMessage">Checking your subscription…</p> : message ? <p className="vmMessage" role="status">{message}</p> : null}
      <p className="vmFine">Per-voxel figures assume the full monthly allowance is used. Each plan covers the Voxel Maker creation allowance shown above. A Voxel Vault mint represents the digital collectible only and does not create ownership rights in the physical property.</p>
    </section>
    <style jsx>{styles}</style>
  </main>;
}

const styles = `
:global(body){margin:0;background:#fff9f1;color:#251a2c;font-family:Inter,ui-rounded,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased}.vmPage{min-height:100vh;padding:18px 14px calc(80px + env(safe-area-inset-bottom));background:radial-gradient(circle at 12% 2%,rgba(255,194,72,.38),transparent 27%),radial-gradient(circle at 92% 8%,rgba(111,54,245,.18),transparent 28%),radial-gradient(circle at 46% 100%,rgba(190,255,74,.24),transparent 30%),#fff9f1}.vmShell{width:min(1080px,100%);margin:0 auto}.vmLoading{min-height:70vh;display:grid;place-items:center;align-content:center;gap:16px;color:#6845b8}.vmCube{width:58px;height:58px;display:grid;place-items:center;border-radius:18px;background:linear-gradient(145deg,#8c59ff,#642eed);box-shadow:0 7px 0 #4f1bc9,0 16px 34px rgba(92,42,220,.23);color:#fff;font-size:28px;font-weight:1000}.vmBrand{display:flex;align-items:center;gap:13px}.vmBrand span,.vmEyebrow{font-size:9px;font-weight:1000;letter-spacing:.14em;color:#7653b7}.vmHero{padding:18px 4px 32px}.vmHero .vmEyebrow{margin:35px 0 9px}.vmHero h1{margin:0;max-width:820px;font-size:clamp(48px,8vw,86px);line-height:.88;letter-spacing:-.075em}.vmHero h1 em{font-style:normal;color:#7540f3}.vmLead{max-width:620px;margin:21px 0 18px;color:#756b75;font-size:14px;line-height:1.65}.vmFlow{display:flex;align-items:center;flex-wrap:wrap;gap:7px}.vmFlow span{padding:8px 10px;border:1px solid #ded2e5;border-radius:999px;background:rgba(255,255,255,.8);font-size:8px;font-weight:1000;letter-spacing:.06em}.vmFlow b{color:#9f8aaa}.vmPricingHeading{display:flex;align-items:end;justify-content:space-between;gap:18px;margin:8px 4px 15px}.vmPricingHeading h2{margin:5px 0 0;font-size:clamp(28px,4vw,42px);letter-spacing:-.055em}.vmPricingHeading>p{max-width:260px;margin:0;color:#887d87;font-size:11px;text-align:right}.vmChoiceHint{display:flex;align-items:center;justify-content:space-between;gap:20px;margin:0 4px 24px;padding:13px 15px;border:1px solid #d9caee;border-radius:18px;background:linear-gradient(100deg,rgba(123,70,246,.1),rgba(255,255,255,.72));box-shadow:0 10px 28px rgba(80,45,120,.06)}.vmChoiceHint>div{display:flex;align-items:center;gap:9px;flex-wrap:wrap}.vmChoiceHint span{padding:6px 8px;border-radius:999px;background:#7440f2;color:#fff;font-size:7px;font-weight:1000;letter-spacing:.08em}.vmChoiceHint strong{font-size:12px}.vmChoiceHint small,.vmChoiceHint p{margin:0;color:#776d7a;font-size:9px;line-height:1.45}.vmChoiceHint p{max-width:340px;text-align:right}.vmPlans{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;align-items:stretch}.vmPlan{position:relative;overflow:hidden;min-height:400px;padding:18px;border:1px solid #e2d7e6;border-radius:27px;background:rgba(255,255,255,.92);box-shadow:0 18px 45px rgba(62,40,76,.08);display:flex;flex-direction:column;transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease}.vmPlan:before{content:"";position:absolute;inset:0 0 auto;height:7px;background:#ddd}.vmPlan-starter:before{background:#ffc44d}.vmPlan-pro:before{background:#c8ff50}.vmPlan-creator{overflow:visible;border:2px solid #7742f2;background:linear-gradient(165deg,#fff,#faf6ff 64%,#f3ecff);box-shadow:0 24px 62px rgba(91,45,205,.22),0 0 0 5px rgba(120,67,244,.08);z-index:3}.vmPlan-creator:before{height:9px;border-radius:25px 25px 0 0;background:linear-gradient(90deg,#9a68ff,#7037ef)}.vmRecommendedFlag{position:absolute;top:-16px;left:50%;transform:translateX(-50%);padding:7px 13px;border-radius:999px;background:#7440f2;color:#fff;box-shadow:0 8px 18px rgba(98,47,222,.28);font-size:7px;font-weight:1000;letter-spacing:.09em;white-space:nowrap}.vmPlan-studio{background:radial-gradient(circle at 90% 8%,rgba(198,255,77,.12),transparent 28%),linear-gradient(160deg,#2d1e38,#15101c);border-color:#453254;color:#fff;box-shadow:0 24px 60px rgba(39,20,54,.28)}.vmPlan-studio:before{height:9px;background:linear-gradient(90deg,#c6ff4d,#8a50ff,#ffbf43)}.vmPlanTop{display:flex;align-items:start;justify-content:space-between;gap:8px;margin-top:4px}.vmPlanTop p{margin:0;font-size:13px;font-weight:1000}.vmPlanTop div>span{display:inline-block;margin-top:6px;padding:5px 7px;border-radius:999px;background:#ede5ff;color:#7043d1;font-size:6px;font-weight:1000;letter-spacing:.08em}.vmPlan-creator .vmPlanTop div>span{background:#7440f2;color:#fff}.vmPlan-studio .vmPlanTop div>span{background:#c9ff52;color:#293a0c}.vmPrice{text-align:right}.vmPrice>strong{display:block;font-size:27px;letter-spacing:-.055em}.vmPrice>strong small{font-size:9px;font-weight:800;letter-spacing:0;color:#8e828f}.vmPrice>em{display:block;margin-top:3px;color:#8f8490;font-size:7px;font-style:normal;font-weight:900;white-space:nowrap}.vmPrice>em small{font-weight:700}.vmPlan-studio .vmPrice>strong small,.vmPlan-studio .vmPrice>em{color:#bdb3c0}.vmPlan h3{margin:26px 0 6px;font-size:25px;letter-spacing:-.05em}.vmPlan h3 small{display:block;margin-top:2px;color:#8f8490;font-size:10px;letter-spacing:0}.vmValueCallout{align-self:flex-start;margin:5px 0 10px;padding:6px 8px;border-radius:9px;background:#eee5ff;color:#6840c2;font-size:6px;font-weight:1000;letter-spacing:.07em}.vmValueCalloutStudio{background:#c9ff52;color:#2c3d0e}.vmBlurb{min-height:41px;margin:0;color:#837884;font-size:10px;line-height:1.5}.vmPlan-studio .vmBlurb,.vmPlan-studio h3 small{color:#b8aebb}.vmPlan ul{list-style:none;padding:0;margin:21px 0 24px;display:grid;gap:10px}.vmPlan li{display:flex;gap:8px;align-items:center;font-size:9px;font-weight:800;color:#5e545f}.vmPlan-studio li{color:#e2dbe5}.vmPlan li span{width:20px;height:20px;display:grid;place-items:center;border-radius:7px;background:#f0e9f3;color:#7446d5;font-size:9px}.vmPlan-creator li span{background:#eee6ff;color:#6431df}.vmPlan-studio li span{background:#392b45;color:#ccff5d}.vmPlan button{margin-top:auto;min-height:52px;border:0;border-radius:16px;background:#251a2c;color:#fff;font:950 12px inherit;cursor:pointer}.vmPlan-creator button{min-height:56px;background:linear-gradient(180deg,#8350ff,#6e36ed);box-shadow:0 6px 0 #5222c6,0 14px 24px rgba(92,43,203,.18);font-size:13px}.vmPlan-pro button{background:#c6ff4d;color:#344313;box-shadow:0 5px 0 #9fd42d}.vmPlan-studio button{background:linear-gradient(180deg,#fff,#f2ebf5);color:#251a2c;box-shadow:0 5px 0 #cfc5d2}.vmPlan button:disabled{opacity:.55;box-shadow:none}.vmSigninNote,.vmMessage,.vmFine{max-width:700px;margin:18px auto 0;text-align:center;color:#776d77;font-size:10px;line-height:1.55}.vmMessage{color:#6942bc;font-weight:850}.vmFine{color:#9a9099;font-size:8px}.vmPlanBar{position:sticky;top:0;z-index:90;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px max(12px,calc((100vw - 720px)/2));border-bottom:1px solid #e2d8e5;background:rgba(255,250,243,.92);backdrop-filter:blur(18px);color:#332739}.vmPlanIdentity{display:flex;align-items:center;gap:8px;min-width:0}.vmDot{width:9px;height:9px;border-radius:50%;background:#aee63d;box-shadow:0 0 0 4px rgba(174,230,61,.18)}.vmPlanIdentity strong{font-size:10px;white-space:nowrap}.vmPlanIdentity small{color:#887d88;font-size:8px;white-space:nowrap}.vmPlanActions{display:flex;align-items:center;gap:8px}.vmPlanActions span{font-size:9px;font-weight:900;color:#7551b6}.vmPlanActions button{min-height:31px;padding:0 10px;border:1px solid #dbd1e1;border-radius:10px;background:#fff;color:#6442ae;font:900 8px inherit;cursor:pointer}@media(min-width:851px){.vmPlan-creator{transform:translateY(-9px)}.vmPlan:hover{transform:translateY(-4px)}.vmPlan-creator:hover{transform:translateY(-13px)}}@media(max-width:850px){.vmPlans{grid-template-columns:repeat(2,minmax(0,1fr))}.vmPlan-creator{transform:none}}@media(max-width:580px){.vmPage{padding-left:10px;padding-right:10px}.vmHero{padding-top:10px}.vmHero h1{font-size:49px}.vmPricingHeading{align-items:start;flex-direction:column}.vmPricingHeading>p{text-align:left}.vmChoiceHint{align-items:flex-start;flex-direction:column;gap:8px;margin-bottom:20px}.vmChoiceHint p{text-align:left}.vmPlans{grid-template-columns:1fr}.vmPlan{min-height:350px}.vmPlan-creator{order:-1;margin-top:7px}.vmRecommendedFlag{top:-13px}.vmPlanIdentity small{display:none}.vmPlanActions span{display:none}}
`;