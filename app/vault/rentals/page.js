'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getSupabaseBrowserAsync } from '../../../lib/supabase-browser';
import { loadAccountVoxels, summarizeVoxel } from '../../../lib/voxelpop-account';
import styles from './rentals.module.css';

function money(minor, currency = 'USD') {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(Number(minor || 0) / 100);
  } catch {
    return `$${(Number(minor || 0) / 100).toFixed(2)}`;
  }
}

function dateLabel(value) {
  if (!value) return '';
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function statusLabel(status) {
  return {
    'pending-verification': 'LEASE PENDING',
    current: 'CURRENT',
    late: 'LATE',
    notice: 'NOTICE',
    'legal-process': 'LEGAL PROCESS',
    ended: 'LEASE ENDED',
  }[String(status || '')] || 'UNKNOWN';
}

function tenantCanEdit(lease) {
  return Boolean(lease?.leaseVerified && !lease?.terminationVerified && ['current', 'late', 'notice', 'legal-process'].includes(String(lease?.status || '')));
}

export default function RentalsPage() {
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [leases, setLeases] = useState([]);
  const [mintedVoxels, setMintedVoxels] = useState([]);
  const [setupRequired, setSetupRequired] = useState(false);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [pickerLeaseId, setPickerLeaseId] = useState('');
  const clientRef = useRef(null);

  const voxelBySession = useMemo(() => new Map(mintedVoxels.map((voxel) => [voxel.sessionId, voxel])), [mintedVoxels]);

  useEffect(() => {
    let active = true;
    let subscription = null;
    getSupabaseBrowserAsync().then(async (client) => {
      if (!active) return;
      clientRef.current = client;
      const { data } = await client.auth.getSession();
      if (active) {
        setSession(data.session || null);
        setAuthReady(true);
      }
      const auth = client.auth.onAuthStateChange((_event, next) => {
        if (!active) return;
        setSession(next || null);
        setAuthReady(true);
      });
      subscription = auth.data.subscription;
    }).catch(() => setAuthReady(true));
    return () => { active = false; subscription?.unsubscribe?.(); };
  }, []);

  useEffect(() => {
    if (!session?.access_token || !session?.user) {
      setLeases([]);
      setMintedVoxels([]);
      return;
    }
    refreshAll(session);
  }, [session?.access_token, session?.user?.id]);

  async function refreshAll(activeSession = session) {
    if (!activeSession?.access_token || !activeSession?.user) return;
    setBusy('load');
    setMessage('');
    try {
      const [rentalResponse, voxelRecords] = await Promise.all([
        fetch('/api/vault/rentals', {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${activeSession.access_token}` },
        }),
        loadAccountVoxels(clientRef.current || await getSupabaseBrowserAsync(), activeSession.user),
      ]);
      const rentalData = await rentalResponse.json().catch(() => ({}));
      if (!rentalResponse.ok || rentalData?.ok === false) throw new Error(rentalData?.error || 'Could not load your rentals.');
      setLeases(Array.isArray(rentalData?.leases) ? rentalData.leases : []);
      setSetupRequired(rentalData?.setupRequired === true);
      setMintedVoxels((Array.isArray(voxelRecords) ? voxelRecords : []).map(summarizeVoxel).filter((voxel) => voxel?.mint?.tokenId));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not load your rentals.');
    } finally {
      setBusy('');
    }
  }

  async function signIn() {
    setBusy('signin');
    setMessage('');
    try {
      const client = clientRef.current || await getSupabaseBrowserAsync();
      clientRef.current = client;
      const { error } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.href },
      });
      if (error) throw error;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not start sign-in.');
      setBusy('');
    }
  }

  async function attachVoxel(leaseId, sessionId) {
    if (!session?.access_token) return;
    setBusy(`attach:${leaseId}:${sessionId}`);
    setMessage('Adding your minted voxel…');
    try {
      const response = await fetch(`/api/vault/rentals/${encodeURIComponent(leaseId)}/attachments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ sessionId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok === false) throw new Error(data?.error || 'Could not add that voxel.');
      setPickerLeaseId('');
      setMessage('Added. The voxel is still your separate asset—it is just associated with this rental.');
      await refreshAll();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not add that voxel.');
    } finally {
      setBusy('');
    }
  }

  async function removeVoxel(leaseId, attachmentId) {
    if (!session?.access_token) return;
    setBusy(`remove:${attachmentId}`);
    setMessage('');
    try {
      const response = await fetch(`/api/vault/rentals/${encodeURIComponent(leaseId)}/attachments`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ attachmentId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok === false) throw new Error(data?.error || 'Could not remove that voxel.');
      setMessage('Removed from this property. The voxel is still in your Vault.');
      await refreshAll();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not remove that voxel.');
    } finally {
      setBusy('');
    }
  }

  return <main className={styles.page}>
    <section className={styles.shell}>
      <nav className={styles.nav}>
        <Link href="/" className={styles.brand}>VOXEL VAULT</Link>
        <Link href="/vault" className={styles.navLink}>Vault</Link>
      </nav>

      <header className={styles.header}>
        <div className={styles.kicker}>MY VAULT · RENTED</div>
        <h1>Your place.<br/><em>Your voxels.</em></h1>
        <p>A verified rental can live in your Vault while you are the tenant. Your own minted voxels can move in with you.</p>
      </header>

      <div className={styles.flow} aria-label="Rental flow">
        <span>LEASE</span><i>→</i><span>PAY MONTHLY</span><i>→</i><span>DECORATE</span><i>→</i><span>MOVE OUT</span>
      </div>

      {!authReady || busy === 'load' ? <div className={styles.empty}>Loading your rented properties…</div> : null}

      {authReady && !session?.user ? <section className={styles.signinCard}>
        <div className={styles.bigIcon}>⌂</div>
        <h2>Sign in to see rentals.</h2>
        <p>Lease and payment details stay private to your signed-in account.</p>
        <button onClick={signIn} disabled={busy === 'signin'}>{busy === 'signin' ? 'Opening…' : 'Sign in with Google'}</button>
      </section> : null}

      {session?.user && setupRequired ? <section className={styles.noticeCard}>
        <b>Rental storage is being prepared.</b>
        <span>Real leases stay locked until the private rental migration is installed and a verified lease/provider record exists.</span>
      </section> : null}

      {session?.user && !setupRequired && !leases.length && busy !== 'load' ? <section className={styles.signinCard}>
        <div className={styles.bigIcon}>🏠</div>
        <h2>No rented property yet.</h2>
        <p>A property appears here only after a real rental agreement is verified. Uploading or minting a house does not make you its tenant.</p>
        <Link className={styles.linkButton} href="/property">Explore a property</Link>
      </section> : null}

      <div className={styles.leaseList}>
        {leases.map((lease) => {
          const editable = tenantCanEdit(lease);
          const nextPayment = lease.nextPayment;
          const attached = Array.isArray(lease.attachments) ? lease.attachments : [];
          const attachedIds = new Set(attached.map((item) => item.voxel_session_id));
          const availableVoxels = mintedVoxels.filter((voxel) => !attachedIds.has(voxel.sessionId));
          return <article className={styles.leaseCard} key={lease.id}>
            <div className={styles.propertyVisual}>
              <div className={styles.house}>⌂</div>
              <span className={`${styles.status} ${styles[`status_${String(lease.status || '').replaceAll('-', '_')}`] || ''}`}>{statusLabel(lease.status)}</span>
            </div>

            <div className={styles.leaseBody}>
              <div className={styles.propertyLabel}>{lease.propertyLabel || 'Verified rented property'}</div>
              <div className={styles.rent}>{money(lease.monthlyRentMinor, lease.currency)}<small>/ month</small></div>
              <div className={styles.facts}>
                <span><b>Lease</b>{lease.leaseVerified ? 'Verified' : 'Pending'}</span>
                <span><b>Next</b>{nextPayment ? `${money(nextPayment.amount_due_minor, nextPayment.currency)} · ${dateLabel(nextPayment.due_on)}` : `Due day ${lease.dueDay}`}</span>
                <span><b>Payment</b>{nextPayment ? String(nextPayment.status || 'upcoming').toUpperCase() : 'Provider managed'}</span>
              </div>

              {['late', 'notice', 'legal-process'].includes(lease.status) ? <div className={styles.legalNote}>
                <b>{lease.status === 'late' ? 'Payment is late.' : lease.status === 'notice' ? 'A lease notice is recorded.' : 'A legal process is recorded.'}</b>
                <span>Voxel Vault does not automatically evict or remove tenancy because of a late payment. Real lease and local legal process control.</span>
              </div> : null}

              {lease.status === 'ended' ? <div className={styles.archivedNote}>
                <b>Lease ended · tenant layer archived</b>
                <span>Your attached voxels are still yours. This property layer is now read-only.</span>
              </div> : null}

              <section className={styles.tenantLayer}>
                <div className={styles.layerHead}>
                  <div><span>TENANT LAYER</span><h3>Things you brought with you.</h3></div>
                  {editable ? <button className={styles.addButton} onClick={() => setPickerLeaseId(pickerLeaseId === lease.id ? '' : lease.id)}>+ Add minted voxel</button> : null}
                </div>

                {pickerLeaseId === lease.id && editable ? <div className={styles.picker}>
                  {availableVoxels.length ? availableVoxels.map((voxel) => <button key={voxel.sessionId} onClick={() => attachVoxel(lease.id, voxel.sessionId)} disabled={busy.startsWith('attach:')}>
                    <img src={voxel.image} alt=""/><span><b>{voxel.name.replaceAll('-', ' ')}</b><small>Minted #{voxel.mint.tokenId}</small></span>
                  </button>) : <div className={styles.pickerEmpty}>No unused minted voxels yet. <Link href="/studio">Create one →</Link></div>}
                </div> : null}

                {attached.length ? <div className={styles.attachedGrid}>
                  {attached.map((attachment) => {
                    const voxel = voxelBySession.get(attachment.voxel_session_id);
                    return <div className={styles.voxelCard} key={attachment.id}>
                      {voxel?.image ? <img src={voxel.image} alt={attachment.voxel_name || 'Attached voxel'}/> : <div className={styles.voxelFallback}>◆</div>}
                      <div><b>{attachment.voxel_name || 'Minted voxel'}</b><small>#{attachment.token_id} · {String(attachment.status || 'active').toUpperCase()}</small></div>
                      {editable && attachment.status === 'active' ? <button onClick={() => removeVoxel(lease.id, attachment.id)} disabled={busy === `remove:${attachment.id}`}>Remove</button> : null}
                    </div>;
                  })}
                </div> : <div className={styles.layerEmpty}>Your minted furniture, art, pets and other voxels can live here without becoming part of the deed or verified building geometry.</div>}
              </section>

              <div className={styles.providerNote}>
                <b>Real lease + payments</b>
                <span>{lease.provider ? `${lease.provider} is the recorded lease/payment source.` : 'Signing and rent collection stay with the verified property manager/provider until a production integration is connected.'}</span>
              </div>
            </div>
          </article>;
        })}
      </div>

      {message ? <div className={styles.message} role="status">{message}</div> : null}
      <footer className={styles.truth}>A Rental Pass or voxel layer records digital access/status only. It is not the lease itself, does not replace landlord-tenant law, and cannot automatically evict a tenant.</footer>
    </section>
  </main>;
}
