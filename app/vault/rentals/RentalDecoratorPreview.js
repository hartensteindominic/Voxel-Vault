'use client';

import { useEffect, useRef, useState } from 'react';
import BasicRoomDecorator from './BasicRoomDecorator';

const demoItems = [
  { id: 'preview-sofa', name: 'Sofa', modelUrl: '', placedTransform: { position: [-1.15, 0, -.4], rotation: [0, 0, 0], scale: [1.3, 1.3, 1.3] } },
  { id: 'preview-plant', name: 'Plant', modelUrl: '', placedTransform: { position: [1.55, 0, -1.1], rotation: [0, .7, 0], scale: [.7, .7, .7] } },
  { id: 'preview-art', name: 'Art', modelUrl: '', placedTransform: { position: [.45, 0, 1.05], rotation: [0, -.4, 0], scale: [.55, .55, .55] } },
];

export default function RentalDecoratorPreview() {
  const [photoUrl, setPhotoUrl] = useState('');
  const [message, setMessage] = useState('');
  const inputRef = useRef(null);

  useEffect(() => () => {
    if (photoUrl) URL.revokeObjectURL(photoUrl);
  }, [photoUrl]);

  function choosePhoto() {
    inputRef.current?.click();
  }

  function selectPhoto(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!String(file.type || '').startsWith('image/') && !/\.(heic|heif)$/i.test(String(file.name || ''))) {
      setMessage('Choose a room image.');
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setMessage('Choose an image smaller than 12 MB.');
      return;
    }
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoUrl(URL.createObjectURL(file));
    setMessage('Preview photo loaded on this device only. A real renter upload is saved privately after lease verification.');
  }

  return <section className="preview">
    <div className="previewHead">
      <div><span>TRY IT · PREVIEW ONLY</span><h2>See the renter room.</h2></div>
      <b>NO LEASE CREATED</b>
    </div>
    <p className="intro">This lets you inspect the interior flow right now. Nothing here creates tenancy, saves rent, or changes a real property.</p>

    <div className="photo">
      {photoUrl ? <img src={photoUrl} alt="Local room preview"/> : <div><strong>＋ Upload a room image</strong><small>Use a photo or screenshot as your visual reference.</small></div>}
      <span>ROOM REFERENCE · NOT VERIFIED FLOOR PLAN</span>
    </div>
    <input ref={inputRef} className="hidden" type="file" accept="image/*,.heic,.heif" onChange={selectPhoto}/>
    <button className="upload" type="button" onClick={choosePhoto}>{photoUrl ? 'Choose another room image' : 'Upload room image'}</button>

    <BasicRoomDecorator
      items={demoItems}
      editable
      savingId=""
      onSave={() => setMessage('Preview layout looks good. Real renter layouts save privately to that verified lease.')}
    />

    {message ? <div className="msg" role="status">{message}</div> : null}
    <p className="truth">The colored preview blocks stand in for minted VoxelPop GLBs. In a real rental, the renter’s verified minted 3D models are loaded instead.</p>

    <style jsx>{`
      .preview{margin-top:18px;border-radius:34px;padding:18px;background:rgba(255,255,255,.78);border:2px dashed rgba(113,56,245,.2);box-shadow:0 18px 45px rgba(83,54,34,.07)}
      .previewHead{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.previewHead span{font-size:9px;letter-spacing:.15em;font-weight:950;color:#7138f5}.previewHead h2{margin:4px 0 0;font-size:28px;letter-spacing:-.045em}.previewHead b{border-radius:999px;background:#efe9ff;color:#7138f5;padding:8px 10px;font-size:8px;letter-spacing:.08em;white-space:nowrap}.intro{margin:9px 0 14px;color:#79645a;font-size:13px;line-height:1.5;font-weight:650}
      .photo{position:relative;overflow:hidden;border-radius:24px;background:#2e174d;min-height:180px}.photo img{display:block;width:100%;height:220px;object-fit:cover}.photo>div{min-height:190px;display:grid;place-content:center;text-align:center;color:#fffaf0}.photo strong{font-size:21px}.photo small{margin-top:5px;color:#d9cbea}.photo>span{position:absolute;left:10px;bottom:10px;border-radius:999px;background:rgba(255,250,240,.94);color:#614f47;padding:8px 10px;font-size:8px;letter-spacing:.07em;font-weight:950}.hidden{display:none}.upload{width:100%;min-height:50px;margin-top:9px;border:0;border-radius:17px;background:#7138f5;color:white;font-weight:950;font-size:13px}.msg{margin-top:10px;border-radius:16px;padding:11px 13px;background:#3b254e;color:white;font-size:11px;font-weight:750}.truth{margin:10px 3px 0;color:#8a756c;font-size:10px;line-height:1.45;font-weight:650}
      @media(max-width:520px){.preview{padding:13px;border-radius:28px}.previewHead{flex-direction:column;gap:6px}.photo img{height:195px}}
    `}</style>
  </section>;
}
