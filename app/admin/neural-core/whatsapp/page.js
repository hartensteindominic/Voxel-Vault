'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { getSupabaseBrowserAsync } from '../../../../lib/supabase-browser';
import styles from '../list/listing.module.css';

const MIGRATION_SQL = `create extension if not exists pgcrypto;

create table if not exists public.voxelflip_control_actions (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  wallet text check (wallet is null or wallet ~* '^0x[0-9a-f]{40}$'),
  action_type text not null check (action_type in ('revenue_notice','reinvest','list','buy','mint','test')),
  status text not null default 'pending' check (status in ('pending','approved','skipped','expired','notified','executed','failed')),
  payload jsonb not null default '{}'::jsonb,
  whatsapp_message_id text,
  responder_hash text,
  approved_via text,
  expires_at timestamptz,
  responded_at timestamptz,
  executed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists voxelflip_control_actions_status_time_idx on public.voxelflip_control_actions (status, created_at desc);
create index if not exists voxelflip_control_actions_wallet_time_idx on public.voxelflip_control_actions (lower(wallet), created_at desc);
alter table public.voxelflip_control_actions enable row level security;
revoke all on table public.voxelflip_control_actions from anon, authenticated;
grant select, insert, update on table public.voxelflip_control_actions to service_role;
`;

function state(value) { return value ? 'READY' : 'WAITING'; }

export default function WhatsAppControlPage() {
  const [authState, setAuthState] = useState('loading');
  const [token, setToken] = useState('');
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const load = useCallback(async accessToken => {
    if (!accessToken) return;
    setBusy('load');
    setError('');
    try {
      const response = await fetch('/api/admin/neural-core/whatsapp', {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'WhatsApp control status could not be checked.');
      setStatus(data);
      setAuthState('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'WhatsApp control status could not be checked.');
    } finally {
      setBusy('');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let subscription;
    (async () => {
      try {
        const client = await getSupabaseBrowserAsync();
        const { data } = await client.auth.getSession();
        if (cancelled) return;
        const accessToken = data?.session?.access_token || '';
        if (!accessToken) {
          setAuthState('signed-out');
          return;
        }
        setToken(accessToken);
        setAuthState('authenticated');
        await load(accessToken);
        const result = client.auth.onAuthStateChange((_event, session) => {
          const next = session?.access_token || '';
          setToken(next);
          setAuthState(next ? 'ready' : 'signed-out');
        });
        subscription = result?.data?.subscription;
      } catch (err) {
        if (!cancelled) {
          setAuthState('signed-out');
          setError(err instanceof Error ? err.message : 'Google session could not be loaded.');
        }
      }
    })();
    return () => { cancelled = true; subscription?.unsubscribe?.(); };
  }, [load]);

  async function runTest(action) {
    if (!token) return;
    setBusy(action);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/admin/neural-core/whatsapp', {
        method: 'POST',
        headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'WhatsApp test failed.');
      setMessage(data.notice || 'WhatsApp test sent.');
      await load(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'WhatsApp test failed.');
    } finally {
      setBusy('');
    }
  }

  async function copySql() {
    try {
      await navigator.clipboard.writeText(MIGRATION_SQL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError('Clipboard access was blocked. Select the SQL and copy it manually.');
    }
  }

  if (authState === 'loading') return <main className={styles.page}><section className={styles.locked}><h1>Loading WhatsApp control…</h1></section></main>;
  if (authState === 'signed-out') return <main className={styles.page}>
    <nav className={styles.nav}><Link href="/studio">VoxelPop</Link><em>WHATSAPP CONTROL · PRIVATE</em></nav>
    <section className={styles.locked}><small>GOOGLE SESSION REQUIRED</small><h1>Sign in first.</h1><p>This control page uses the private Neural Core admin allowlist.</p><Link href="/studio#my-voxels">Open Studio and sign in →</Link></section>
  </main>;

  const tableReady = Boolean(status?.database?.controlActions?.ready);
  const meta = status?.meta || {};

  return <main className={styles.page}>
    <nav className={styles.nav}><Link href="/admin/neural-core">← Neural Core</Link><em>WHATSAPP CONTROL</em></nav>
    <header className={styles.hero}>
      <small>DETECT → TEXT → APPROVE / SKIP → QUEUE</small>
      <h1>Autonomous alerts.<br/><em>You stay in control.</em></h1>
      <p>Neural Core can notify you and collect a one-time approval in WhatsApp. A WhatsApp tap is never a blockchain signature. Spending, listing, buying and minting remain locked until the bounded executor is separately verified.</p>
    </header>

    <div className={styles.shell}>
      <section className={styles.panel}>
        <div className={styles.panelHead}><div><small>READINESS</small><h2>{status?.ready ? 'WhatsApp control is connected.' : 'Connect the remaining pieces.'}</h2></div><span className={styles.badge}>{status?.ready ? 'READY' : 'SETUP'}</span></div>
        <div className={styles.grid}>
          <article className={styles.metric}><small>CONTROL STORAGE · 013</small><b>{state(tableReady)}</b></article>
          <article className={styles.metric}><small>META OUTBOUND</small><b>{state(Boolean(meta.outboundReady))}</b></article>
          <article className={styles.metric}><small>SIGNED WEBHOOK</small><b>{state(Boolean(meta.webhookReady))}</b></article>
          <article className={styles.metric}><small>REVENUE TEMPLATE</small><b>{state(Boolean(meta.revenueTemplate))}</b></article>
          <article className={styles.metric}><small>APPROVAL TEMPLATE</small><b>{state(Boolean(meta.approvalTemplate))}</b></article>
          <article className={styles.metric}><small>AUTO-SIGNING</small><b>OFF</b></article>
        </div>
        {message && <div className={styles.success} style={{marginTop:14}}>{message}</div>}
        {error && <div className={styles.error} style={{marginTop:14}}>{error}</div>}
      </section>

      {!tableReady && <section className={styles.panel}>
        <div className={styles.panelHead}><div><small>ONE-TIME DATABASE STEP</small><h2>Install control storage.</h2></div><span className={styles.badge}>PRIVATE</span></div>
        <p style={{color:'#aaaab6',lineHeight:1.65}}>Copy this SQL into the Voxel Vault Supabase SQL Editor and run it once. Browser roles get no direct access to this table.</p>
        <div className={styles.actions}><button className={styles.primary} onClick={copySql}>{copied ? 'Copied ✓' : 'Copy migration 013 SQL'}</button><a className={styles.secondary} href="https://supabase.com/dashboard/projects" target="_blank" rel="noreferrer">Open Supabase ↗</a></div>
        <textarea readOnly value={MIGRATION_SQL} style={{width:'100%',minHeight:240,boxSizing:'border-box',marginTop:16,background:'#0b0b10',color:'#b9bbc5',border:'1px solid #31313c',borderRadius:14,padding:14,fontFamily:'ui-monospace,SFMono-Regular,Menlo,monospace',fontSize:11,lineHeight:1.5}} />
      </section>}

      <section className={styles.panel}>
        <div className={styles.panelHead}><div><small>META CLOUD API</small><h2>Direct WhatsApp. No Twilio.</h2></div><span className={styles.badge}>SERVER ONLY</span></div>
        <p style={{color:'#aaaab6',lineHeight:1.65}}>Create a Meta Business app, add the WhatsApp product, and use a WhatsApp Business sender number. Your approver number is stored only as a Vercel environment variable; it is never committed to GitHub. Your connected Instagram account does not by itself configure WhatsApp Cloud API.</p>
        <div className={styles.field}><label>Webhook callback URL</label><input readOnly value={status?.webhookUrl || ''}/></div>
        <div className={styles.field}><label>Required Vercel environment variables</label><textarea readOnly value={(status?.requiredEnv || []).join('\n')} style={{width:'100%',minHeight:190,boxSizing:'border-box',background:'#0b0b10',color:'#b9bbc5',border:'1px solid #31313c',borderRadius:14,padding:14,fontFamily:'ui-monospace,SFMono-Regular,Menlo,monospace',fontSize:12,lineHeight:1.5}} /></div>
        <p style={{color:'#aaaab6',lineHeight:1.65}}>Use digits-only E.164 format for <code>WHATSAPP_APPROVER_NUMBER</code>. Keep the access token, app secret and webhook verification token private. Optional: <code>WHATSAPP_GRAPH_API_VERSION=v26.0</code> and <code>WHATSAPP_TEMPLATE_LANGUAGE=en_US</code>.</p>
        <div className={styles.actions}><a className={styles.secondary} href="https://developers.facebook.com/apps/" target="_blank" rel="noreferrer">Open Meta Developer Apps ↗</a></div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHead}><div><small>MESSAGE TEMPLATES</small><h2>Create these two approved templates.</h2></div></div>
        <div className={styles.field}><label>Revenue template · one body variable</label><textarea readOnly value={status?.templates?.revenue?.body || ''} /></div>
        <div className={styles.field}><label>Approval template · three body variables + 2 quick replies</label><textarea readOnly value={`${status?.templates?.approval?.body || ''}\n\nButtons: APPROVE · SKIP`} /></div>
        <p style={{color:'#aaaab6',lineHeight:1.65}}>Put the approved template names into <code>WHATSAPP_REVENUE_TEMPLATE_NAME</code> and <code>WHATSAPP_APPROVAL_TEMPLATE_NAME</code>. Proactive bot alerts use templates so the system does not depend on an open customer-service chat window.</p>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHead}><div><small>LIVE TEST</small><h2>Prove the control loop before money.</h2></div><span className={styles.badge}>NO EXECUTION</span></div>
        <p style={{color:'#aaaab6',lineHeight:1.65}}>The approval test creates a 15-minute TEST action. Tap APPROVE or SKIP in WhatsApp; the webhook stores the decision but cannot execute any blockchain action.</p>
        <div className={styles.actions}>
          <button className={styles.primary} disabled={Boolean(busy) || !status?.ready} onClick={() => runTest('test-approval')}>{busy === 'test-approval' ? 'Sending…' : 'Send APPROVE / SKIP test'}</button>
          <button className={styles.secondary} disabled={Boolean(busy) || !status?.ready} onClick={() => runTest('test-revenue')}>{busy === 'test-revenue' ? 'Sending…' : 'Send revenue alert test'}</button>
          <button className={styles.secondary} disabled={Boolean(busy)} onClick={() => load(token)}>{busy === 'load' ? 'Checking…' : 'Check again'}</button>
        </div>
      </section>
    </div>
  </main>;
}
