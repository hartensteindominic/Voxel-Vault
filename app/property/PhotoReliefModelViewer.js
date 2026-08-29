'use client';

import { useEffect, useRef, useState } from 'react';
import { getSupabaseBrowserAsync } from '../../lib/supabase-browser';
import styles from './PhotoReliefModelViewer.module.css';

const DEVICE_DB = 'voxelpop-property-device-v1';
const DEVICE_STORE = 'pending-photos';
const CONTEXT_PREFIX = 'voxel-vault:property-generation-context:';
const GLOBAL_RENDER_KEY = '__VOXELPOP_PROPERTY_RENDER__';

function clean(value) {
  return String(value || '').trim();
}

function openDeviceDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('Private on-device photo storage is unavailable.'));
    const request = indexedDB.open(DEVICE_DB, 1);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Private photo storage could not open.'));
  });
}

async function digestBytes(bytes) {
  if (!globalThis.crypto?.subtle) return '';
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((value) => value.toString(16).padStart(2, '0')).join('');
}

async function currentDraftContext(imageUrl) {
  const sourceResponse = await fetch(imageUrl);
  const sourceBlob = await sourceResponse.blob();
  const sourceBytes = await sourceBlob.arrayBuffer();
  const sourceDigest = await digestBytes(sourceBytes);

  const db = await openDeviceDb();
  const records = await new Promise((resolve, reject) => {
    const request = db.transaction(DEVICE_STORE, 'readonly').objectStore(DEVICE_STORE).getAll();
    request.onsuccess = () => resolve(Array.isArray(request.result) ? request.result : []);
    request.onerror = () => reject(request.error || new Error('Private photo storage could not be read.'));
  });
  db.close();

  const candidates = [];
  for (const record of records) {
    if (!record?.draftId || !record?.bytes) continue;
    const contextKey = `${CONTEXT_PREFIX}${record.draftId}`;
    const rawContext = window.localStorage.getItem(contextKey);
    if (!rawContext) continue;
    let matches = false;
    if (sourceDigest) {
      try { matches = await digestBytes(record.bytes) === sourceDigest; } catch {}
    } else {
      matches = Number(record.bytes?.byteLength || 0) === Number(sourceBytes.byteLength || 0)
        && clean(record.type) === clean(sourceBlob.type);
    }
    if (!matches) continue;
    try {
      candidates.push({
        draftId: clean(record.draftId),
        savedAt: Number(record.savedAt || 0),
        context: JSON.parse(rawContext || 'null'),
      });
    } catch {}
  }

  candidates.sort((a, b) => b.savedAt - a.savedAt);
  const current = candidates[0] || null;
  if (!current?.draftId) throw new Error('VoxelPop could not reconnect this photo to its paid creation. Return to the photo step and continue again.');
  return current;
}

async function prepareReference(imageUrl) {
  const image = new Image();
  image.decoding = 'async';
  image.src = imageUrl;
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = () => reject(new Error('The selected house photo could not be prepared for the VoxelPop render.'));
  });

  const maxEdge = 1536;
  const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth || 1, image.naturalHeight || 1));
  const width = Math.max(1, Math.round((image.naturalWidth || 1) * scale));
  const height = Math.max(1, Math.round((image.naturalHeight || 1) * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This browser cannot prepare the house reference for generation.');
  context.drawImage(image, 0, 0, width, height);

  const qualities = [0.9, 0.82, 0.74, 0.66];
  for (const quality of qualities) {
    const data = canvas.toDataURL('image/jpeg', quality);
    if (data.length <= 4_000_000) return data;
  }
  throw new Error('This house photo is still too large for the 3D picture renderer. Try a screenshot or smaller image.');
}

async function paidGenerationProof(context) {
  const params = new URLSearchParams(window.location.search);
  const stripeSession = clean(params.get('generation_session'));
  if (stripeSession) return stripeSession;
  if (context?.selectedProperty?.voxelpop?.paidCreation === true) return 'saved-property';
  throw new Error('VoxelPop could not verify the paid creation for this 3D picture.');
}

export default function PhotoReliefModelViewer({ imageUrl, onReady }) {
  const callbackRef = useRef(onReady);
  const requestRef = useRef(0);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('loading');
  const [renderUrl, setRenderUrl] = useState('');
  const [provider, setProvider] = useState('');
  callbackRef.current = onReady;

  useEffect(() => {
    if (!imageUrl) return undefined;
    let dead = false;
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setError('');
    setStatus('loading');
    setRenderUrl('');
    setProvider('');
    if (typeof window !== 'undefined') window[GLOBAL_RENDER_KEY] = '';

    (async () => {
      try {
        const [draft, reference, client] = await Promise.all([
          currentDraftContext(imageUrl),
          prepareReference(imageUrl),
          getSupabaseBrowserAsync(),
        ]);
        if (dead || requestRef.current !== requestId) return;
        const { data } = await client.auth.getSession();
        const token = clean(data?.session?.access_token);
        if (!token) throw new Error('Sign in again before generating the VoxelPop 3D picture.');
        const generationSessionId = await paidGenerationProof(draft.context);

        const response = await fetch('/api/property-3d-picture', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            draftId: draft.draftId,
            generationSessionId,
            reference,
          }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload?.ok || !payload?.image) {
          throw new Error(payload?.error || 'The VoxelPop 3D house renderer did not return an image.');
        }
        if (dead || requestRef.current !== requestId) return;
        window[GLOBAL_RENDER_KEY] = payload.image;
        window.dispatchEvent(new CustomEvent('voxelpop-property-render-ready', { detail: { image: payload.image, draftId: draft.draftId } }));
        setRenderUrl(payload.image);
        setProvider(clean(payload.provider));
        setStatus('ready');
        callbackRef.current?.(payload.image);
      } catch (generationError) {
        if (!dead && requestRef.current === requestId) {
          setStatus('error');
          setError(String(generationError?.message || generationError || 'The VoxelPop 3D house picture could not be generated.'));
        }
      }
    })();

    return () => { dead = true; };
  }, [imageUrl]);

  function regenerate() {
    requestRef.current += 1;
    setStatus('loading');
    setRenderUrl('');
    setError('');
    if (typeof window !== 'undefined') window[GLOBAL_RENDER_KEY] = '';
    // Re-mount the generation effect without changing the source image URL.
    const source = imageUrl;
    Promise.resolve().then(async () => {
      try {
        const [draft, reference, client] = await Promise.all([
          currentDraftContext(source),
          prepareReference(source),
          getSupabaseBrowserAsync(),
        ]);
        const { data } = await client.auth.getSession();
        const token = clean(data?.session?.access_token);
        if (!token) throw new Error('Sign in again before regenerating this VoxelPop house.');
        const generationSessionId = await paidGenerationProof(draft.context);
        const response = await fetch('/api/property-3d-picture', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ draftId: draft.draftId, generationSessionId, reference }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload?.ok || !payload?.image) throw new Error(payload?.error || 'Regeneration failed.');
        window[GLOBAL_RENDER_KEY] = payload.image;
        window.dispatchEvent(new CustomEvent('voxelpop-property-render-ready', { detail: { image: payload.image, draftId: draft.draftId } }));
        setRenderUrl(payload.image);
        setProvider(clean(payload.provider));
        setStatus('ready');
        callbackRef.current?.(payload.image);
      } catch (generationError) {
        setStatus('error');
        setError(String(generationError?.message || generationError || 'The VoxelPop house could not be regenerated.'));
      }
    });
  }

  return <div className={`viewerShell ${styles.shell}`} style={{background:'radial-gradient(circle at 50% 18%,#fffdf7 0,#efe8ff 48%,#ded1f7 100%)'}}>
    {renderUrl ? <img src={renderUrl} alt="Generated VoxelPop 3D house render" style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'contain',padding:12}}/> : <img src={imageUrl} alt="Original property reference" style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'contain',opacity:status === 'loading' ? .42 : 1}}/>}
    {status === 'loading' ? <div className={styles.loading}><span>GENERATING VOXELPOP 3D HOUSE…</span></div> : null}
    {status === 'ready' ? <>
      <div className={styles.qualityBadge} aria-hidden="true"><span>VOXELPOP 3D HOUSE</span><b>AI RENDER · PHOTO REFERENCED</b></div>
      <div className={styles.sourceCard}><img src={imageUrl} alt="Original house reference"/><span>ORIGINAL REFERENCE</span></div>
      <button type="button" onClick={regenerate} style={{position:'absolute',right:12,bottom:12,zIndex:8,minHeight:42,padding:'0 13px',borderRadius:999,border:'1px solid rgba(28,18,35,.15)',background:'rgba(255,250,240,.94)',color:'#24162f',fontWeight:900,fontSize:11,cursor:'pointer'}}>Regenerate 3D</button>
      <div className={styles.hint} aria-hidden="true">{provider ? `GENERATED · ${provider.replaceAll('-', ' ').toUpperCase()}` : 'GENERATED FROM YOUR HOUSE PHOTO'}</div>
    </> : null}
    {error ? <div className={styles.error} role="status">
      <img src={imageUrl} alt="Original property reference"/>
      <p>{error}</p>
      <button type="button" onClick={regenerate} style={{minHeight:44,padding:'0 14px',borderRadius:999,border:0,background:'#7138f5',color:'#fff',fontWeight:900}}>Try 3D render again</button>
    </div> : null}
  </div>;
}
