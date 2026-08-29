'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import BasicRoomDecorator from './BasicRoomDecorator';

function isHeic(file) {
  return /image\/(heic|heif)/i.test(String(file?.type || '')) || /\.(heic|heif)$/i.test(String(file?.name || ''));
}

function supportedPhoto(file) {
  return ['image/jpeg', 'image/png', 'image/webp'].includes(String(file?.type || '').toLowerCase()) || isHeic(file);
}

async function normalizeIphonePhoto(file) {
  if (!isHeic(file)) return file;
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('HEIC preview could not be decoded.'));
    });
    const maxEdge = 2400;
    const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth || 1, image.naturalHeight || 1));
    const width = Math.max(1, Math.round((image.naturalWidth || 1) * scale));
    const height = Math.max(1, Math.round((image.naturalHeight || 1) * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Photo conversion is unavailable on this device.');
    context.drawImage(image, 0, 0, width, height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', .92));
    if (!blob) throw new Error('Photo conversion failed.');
    const name = String(file.name || 'room-photo.heic').replace(/\.(heic|heif)$/i, '.jpg');
    return new File([blob], name || 'room-photo.jpg', { type: 'image/jpeg', lastModified: Date.now() });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function RentalRoomPanel({ session, lease, attachments = [], voxelBySession, editable = false, onRefresh }) {
  const [reference, setReference] = useState(null);
  const [setupRequired, setSetupRequired] = useState(false);
  const [pendingPhoto, setPendingPhoto] = useState(null);
  const [pendingPreview, setPendingPreview] = useState('');
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const inputRef = useRef(null);

  const roomItems = useMemo(() => attachments.map((attachment) => {
    const voxel = voxelBySession?.get?.(attachment.voxel_session_id);
    return {
      id: attachment.id,
      name: attachment.voxel_name || voxel?.name || 'Voxel',
      modelUrl: voxel?.modelUrl || '',
      image: voxel?.image || '',
      placedTransform: attachment.placed_transform || null,
    };
  }), [attachments, voxelBySession]);

  useEffect(() => {
    if (!session?.access_token || !lease?.id) return;
    let active = true;
    fetch(`/api/vault/rentals/${encodeURIComponent(lease.id)}/room-photo`, {
      cache: 'no-store',
      headers: { Authorization: `Bearer ${session.access_token}` },
    }).then(async (response) => {
      const data = await response.json().catch(() => ({}));
      if (!active) return;
      if (!response.ok || data?.ok === false) throw new Error(data?.error || 'Room photo could not be loaded.');
      setReference(data?.reference || null);
      setSetupRequired(data?.setupRequired === true);
    }).catch((error) => {
      if (active) setMessage(error instanceof Error ? error.message : 'Room photo could not be loaded.');
    });
    return () => { active = false; };
  }, [session?.access_token, lease?.id]);

  useEffect(() => () => {
    if (pendingPreview) URL.revokeObjectURL(pendingPreview);
  }, [pendingPreview]);

  function choosePhoto() {
    inputRef.current?.click();
  }

  async function selectPhoto(event) {
    const selected = event.target.files?.[0];
    event.target.value = '';
    if (!selected) return;
    if (!supportedPhoto(selected)) return setMessage('Choose a JPG, PNG, WebP, HEIC, or HEIF room photo.');
    if (selected.size > 12 * 1024 * 1024) return setMessage('Choose a room photo smaller than 12 MB.');
    setBusy('prepare');
    setMessage(isHeic(selected) ? 'Preparing your iPhone room photo…' : 'Preparing your room photo…');
    try {
      const photo = await normalizeIphonePhoto(selected);
      if (photo.size > 8 * 1024 * 1024) throw new Error('This room photo is still too large. Try a screenshot or smaller version.');
      if (pendingPreview) URL.revokeObjectURL(pendingPreview);
      setPendingPhoto(photo);
      setPendingPreview(URL.createObjectURL(photo));
      setRightsConfirmed(false);
      setMessage('Photo ready. Confirm you can use it, then save it to this rental.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'This iPhone photo could not be prepared. A screenshot will work too.');
    } finally {
      setBusy('');
    }
  }

  async function uploadPhoto() {
    if (!session?.access_token || !lease?.id || !pendingPhoto) return;
    if (!rightsConfirmed) return setMessage('Confirm that you took this room photo or have permission to use it.');
    setBusy('upload');
    setMessage('Saving your room photo privately…');
    try {
      const form = new FormData();
      form.append('photo', pendingPhoto);
      form.append('rightsConfirmed', 'true');
      const response = await fetch(`/api/vault/rentals/${encodeURIComponent(lease.id)}/room-photo`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: form,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok === false) throw new Error(data?.error || 'Room photo could not be saved.');
      setReference(data.reference || null);
      setSetupRequired(false);
      setPendingPhoto(null);
      if (pendingPreview) URL.revokeObjectURL(pendingPreview);
      setPendingPreview('');
      setRightsConfirmed(false);
      setMessage('Room photo saved privately. Use it as your visual guide while decorating.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Room photo could not be saved.');
    } finally {
      setBusy('');
    }
  }

  async function removePhoto() {
    if (!session?.access_token || !lease?.id) return;
    setBusy('remove-photo');
    setMessage('');
    try {
      const response = await fetch(`/api/vault/rentals/${encodeURIComponent(lease.id)}/room-photo`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok === false) throw new Error(data?.error || 'Room photo could not be removed.');
      setReference(null);
      setMessage('Room reference removed. Your saved voxel layout is unchanged.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Room photo could not be removed.');
    } finally {
      setBusy('');
    }
  }

  async function saveLayout(attachmentId, transform) {
    if (!session?.access_token || !lease?.id || !attachmentId) return;
    setBusy(`layout:${attachmentId}`);
    setMessage('Saving room layout…');
    try {
      const response = await fetch(`/api/vault/rentals/${encodeURIComponent(lease.id)}/attachments`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ attachmentId, transform }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok === false || data?.transformBounded !== true) throw new Error(data?.error || 'Room layout could not be saved.');
      setMessage('Layout saved. This only changes your renter decoration layer.');
      await onRefresh?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Room layout could not be saved.');
    } finally {
      setBusy('');
    }
  }

  const visualUrl = pendingPreview || reference?.url || '';

  return <section className="rentalRoomPanel">
    <div className="roomIntro">
      <div><span>DECORATE</span><h3>Make the room yours.</h3></div>
      <small>Private tenant layer</small>
    </div>

    <div className="roomPhotoCard">
      {visualUrl ? <img src={visualUrl} alt="Private renter-supplied room reference"/> : <div className="photoBlank"><b>＋ Room photo</b><span>Optional visual reference</span></div>}
      <div className="photoBadge">ROOM REFERENCE · NOT VERIFIED FLOOR PLAN</div>
    </div>

    <input ref={inputRef} className="hiddenInput" type="file" accept="image/*,.heic,.heif" onChange={selectPhoto}/>

    {pendingPhoto ? <div className="photoConfirm">
      <label><input type="checkbox" checked={rightsConfirmed} onChange={(event) => setRightsConfirmed(event.target.checked)}/><span>I took this photo or have permission to use it.</span></label>
      <button type="button" onClick={uploadPhoto} disabled={!rightsConfirmed || busy === 'upload'}>{busy === 'upload' ? 'Saving…' : 'Use this room photo'}</button>
      <button type="button" className="quiet" onClick={choosePhoto}>Choose another</button>
    </div> : <div className="photoActions">
      <button type="button" onClick={choosePhoto} disabled={!editable || busy === 'prepare'}>{busy === 'prepare' ? 'Preparing…' : reference ? 'Replace room photo' : 'Upload room photo'}</button>
      {reference ? <button type="button" className="quiet" onClick={removePhoto} disabled={busy === 'remove-photo'}>{busy === 'remove-photo' ? 'Removing…' : 'Remove photo'}</button> : null}
    </div>}

    {setupRequired ? <p className="setupNote">Room-photo storage is ready in code but migration 021 still needs to be applied in this environment.</p> : null}
    <p className="photoTruth">Your upload stays private and is only a decoration reference. It does not become property evidence, a lease document, or canonical building geometry.</p>

    <BasicRoomDecorator
      items={roomItems}
      editable={editable}
      savingId={busy.startsWith('layout:') ? busy.slice('layout:'.length) : ''}
      onSave={saveLayout}
    />

    {message ? <div className="roomMessage" role="status">{message}</div> : null}

    <style jsx>{`
      .rentalRoomPanel{margin-top:18px;border-radius:28px;background:#fff7ef;padding:14px;border:1px solid rgba(72,45,35,.08)}
      .roomIntro{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;padding:4px 3px 11px}.roomIntro span{font-size:9px;letter-spacing:.15em;font-weight:950;color:#7138f5}.roomIntro h3{margin:3px 0 0;font-size:22px;letter-spacing:-.04em}.roomIntro small{font-size:10px;color:#8b756c;font-weight:750}
      .roomPhotoCard{position:relative;min-height:170px;border-radius:22px;overflow:hidden;background:#2e174d}.roomPhotoCard img{display:block;width:100%;height:230px;object-fit:cover}.photoBlank{min-height:190px;display:grid;place-content:center;text-align:center;color:#fffaf0}.photoBlank b{font-size:22px}.photoBlank span{font-size:11px;margin-top:4px;color:#ded0ef}.photoBadge{position:absolute;left:10px;bottom:10px;max-width:calc(100% - 20px);border-radius:999px;padding:8px 10px;background:rgba(255,250,240,.92);color:#614f47;font-size:8px;letter-spacing:.08em;font-weight:950}
      .hiddenInput{display:none}.photoActions,.photoConfirm{display:grid;gap:8px;margin-top:10px}.photoActions{grid-template-columns:1fr auto}.photoActions button,.photoConfirm button{min-height:46px;border:0;border-radius:16px;padding:0 16px;background:#7138f5;color:white;font-size:12px;font-weight:950}.photoActions .quiet,.photoConfirm .quiet{background:#eee6e0;color:#66524a}.photoConfirm label{display:flex;align-items:flex-start;gap:10px;padding:12px;border-radius:16px;background:white;color:#67534b;font-size:12px;font-weight:750;line-height:1.35}.photoConfirm input{width:19px;height:19px;flex:0 0 auto}.photoTruth,.setupNote{margin:9px 3px 0;font-size:10px;line-height:1.45;color:#89746a;font-weight:650}.setupNote{padding:10px 12px;border-radius:14px;background:#fff0c8;color:#755b45}.roomMessage{margin-top:10px;border-radius:15px;background:#3b254e;color:white;padding:10px 12px;font-size:11px;font-weight:750;line-height:1.4}
      @media(max-width:520px){.roomIntro{align-items:flex-start;flex-direction:column;gap:2px}.roomPhotoCard img{height:200px}.photoActions{grid-template-columns:1fr}.photoActions button,.photoConfirm button{min-height:50px}}
    `}</style>
  </section>;
}
