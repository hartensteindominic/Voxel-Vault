'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabaseBrowser } from '../../lib/supabase-browser';

export default function VaultMessenger() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [profile, setProfile] = useState({ handle: '', displayName: '', bio: '' });
  const [people, setPeople] = useState([]);
  const [peer, setPeer] = useState(null);
  const [conversationId, setConversationId] = useState('');
  const [messages, setMessages] = useState([]);
  const [body, setBody] = useState('');
  const [tokenId, setTokenId] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const user = session?.user;

  useEffect(() => {
    supabaseBrowser.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabaseBrowser.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => { if (user) loadPeople(); }, [user?.id]);
  useEffect(() => {
    if (!conversationId) return;
    loadMessages(conversationId);
    const channel = supabaseBrowser.channel(`messages-${conversationId}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'vault_messages', filter: `conversation_id=eq.${conversationId}` }, payload => setMessages(current => current.some(message => message.id === payload.new.id) ? current : [...current, payload.new])).subscribe();
    return () => { supabaseBrowser.removeChannel(channel); };
  }, [conversationId]);

  async function signIn(event) {
    event.preventDefault(); setBusy(true);
    const { error } = await supabaseBrowser.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: `${window.location.origin}/messages` } });
    setStatus(error?.message || 'Check your email for the secure sign-in link.'); setBusy(false);
  }

  async function loadPeople() {
    const [{ data: mine }, { data, error }] = await Promise.all([
      supabaseBrowser.from('vault_profiles').select('*').eq('user_id', user.id).maybeSingle(),
      supabaseBrowser.from('vault_profiles').select('user_id,handle,display_name,bio').neq('user_id', user.id).limit(50),
    ]);
    if (error) { setStatus('Apply Supabase migration 004 to activate profiles and messages.'); return; }
    if (mine) setProfile({ handle: mine.handle, displayName: mine.display_name, bio: mine.bio || '' });
    setPeople(data || []);
  }

  async function saveProfile(event) {
    event.preventDefault(); setBusy(true);
    const { error } = await supabaseBrowser.from('vault_profiles').upsert({ user_id: user.id, handle: profile.handle.trim().toLowerCase(), display_name: profile.displayName.trim(), bio: profile.bio.trim(), updated_at: new Date().toISOString() });
    setStatus(error?.message || 'Profile saved.'); if (!error) await loadPeople(); setBusy(false);
  }

  async function openChat(person) {
    setPeer(person); setBusy(true);
    const { data: existing } = await supabaseBrowser.rpc('vault_find_direct_conversation', { peer: person.user_id });
    let id = existing || '';
    if (!id) {
      const { data: conversation, error } = await supabaseBrowser.from('vault_conversations').insert({ created_by: user.id }).select('id').single();
      if (error) { setStatus(error.message); setBusy(false); return; }
      const result = await supabaseBrowser.from('vault_conversation_members').insert([{ conversation_id: conversation.id, user_id: user.id }, { conversation_id: conversation.id, user_id: person.user_id }]);
      if (result.error) { setStatus(result.error.message); setBusy(false); return; }
      id = conversation.id;
    }
    setConversationId(id); setBusy(false);
  }

  async function loadMessages(id) {
    const { data, error } = await supabaseBrowser.from('vault_messages').select('*').eq('conversation_id', id).order('created_at').limit(200);
    if (error) setStatus(error.message); else setMessages(data || []);
  }

  async function send(event) {
    event.preventDefault(); if (!body.trim()) return;
    const draft = body.trim(); setBody('');
    const { error } = await supabaseBrowser.from('vault_messages').insert({ conversation_id: conversationId, sender_id: user.id, body: draft });
    if (error) { setBody(draft); setStatus(error.message); }
  }

  async function requestTransfer() {
    const contract = process.env.NEXT_PUBLIC_VOXEL_NFT_ADDRESS;
    if (!contract) { setStatus('NFT contract is not configured. Nothing was transferred.'); return; }
    if (!peer || !tokenId.trim()) { setStatus('Choose a collector and enter a token ID.'); return; }
    const { error } = await supabaseBrowser.from('vault_transfer_approvals').insert({ conversation_id: conversationId, requested_by: user.id, recipient_id: peer.user_id, nft_contract: contract, nft_token_id: tokenId.trim() });
    setStatus(error?.message || `Token #${tokenId.trim()} approval request sent. The NFT has not moved.`); if (!error) setTokenId('');
  }

  if (!session) return <main className="vmRoot"><header className="vmTop"><Link href="/">VOXEL VAULT</Link><span>PRIVATE MESSAGING</span></header><section className="vmSignin"><small>PROFILE + MESSAGES</small><h1>Your people.<br/><em>Your collection.</em></h1><p>Message collectors and prepare NFT handoffs. Only a wallet signature can move an NFT.</p><form onSubmit={signIn}><label>Email<input type="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" /></label><button disabled={busy}>{busy ? 'Sending…' : 'Email secure sign-in link'}</button></form>{status && <p role="status">{status}</p>}</section></main>;

  return <main className="vmRoot"><header className="vmTop"><Link href="/">VOXEL VAULT</Link><nav><Link href="/avatar">Avatar</Link><Link href="/vault">Collection</Link><Link href="/trade">Trade</Link></nav><button onClick={() => supabaseBrowser.auth.signOut()}>Sign out</button></header><section className="vmLayout"><aside className="vmSidebar"><div className="vmIdentity"><span>{(profile.displayName || 'VA').slice(0, 2).toUpperCase()}</span><strong>{profile.displayName || 'Set up your profile'}</strong></div><form className="vmProfile" onSubmit={saveProfile}><label>Handle<input required minLength={3} maxLength={24} pattern="[a-z0-9_]+" value={profile.handle} onChange={event => setProfile({ ...profile, handle: event.target.value })} placeholder="vault_handle" /></label><label>Display name<input required maxLength={50} value={profile.displayName} onChange={event => setProfile({ ...profile, displayName: event.target.value })} /></label><label>Bio<textarea maxLength={280} value={profile.bio} onChange={event => setProfile({ ...profile, bio: event.target.value })} /></label><button disabled={busy}>Save profile</button></form><div className="vmPeople"><small>PEOPLE</small>{people.length ? people.map(person => <button key={person.user_id} className={peer?.user_id === person.user_id ? 'active' : ''} onClick={() => openChat(person)}><span>{person.display_name.slice(0, 2).toUpperCase()}</span><div><strong>{person.display_name}</strong><small>@{person.handle}</small></div></button>) : <p>No other profiles yet.</p>}</div></aside><section className="vmChat">{peer ? <><header><div><small>SECURE CONVERSATION</small><h1>{peer.display_name}</h1><p>@{peer.handle} · transfers require approval.</p></div><Link href="/trade">Open Tap Trade</Link></header><div className="vmMessages">{messages.length ? messages.map(message => <article key={message.id} className={message.sender_id === user.id ? 'mine' : ''}><p>{message.body}</p><time>{new Date(message.created_at).toLocaleString()}</time></article>) : <div className="vmEmpty"><strong>Talk first. Trade second.</strong><p>Agree on the handoff before either wallet signs.</p></div>}</div><form className="vmComposer" onSubmit={send}><input aria-label="Message" maxLength={2000} value={body} onChange={event => setBody(event.target.value)} placeholder={`Message ${peer.display_name}`} /><button>Send</button></form><div className="vmTransfer"><div><small>APPROVAL-GATED HANDOFF</small><strong>Prepare an NFT transfer</strong><p>Your NPC and Vault AI cannot sign it.</p></div><label>Token ID<input value={tokenId} onChange={event => setTokenId(event.target.value)} /></label><button onClick={requestTransfer}>Request approval</button></div></> : <div className="vmEmpty vmWelcome"><small>VAULT SOCIAL</small><h1>Message.<br/>Share. Trade.</h1><p>Choose a collector from your private network.</p></div>}</section></section>{status && <div role="status" className="vmToast">{status}<button onClick={() => setStatus('')} aria-label="Dismiss">×</button></div>}</main>;
}
