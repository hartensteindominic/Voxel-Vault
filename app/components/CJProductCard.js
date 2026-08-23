'use client';

export default function CJProductCard({ item, index, active, state, ready, onSelect, onOpen }) {
  return <article className={`cj-card ${active ? 'is-active' : ''}`}>
    <button className="cj-cardPick" onClick={onSelect} aria-label={`Preview ${item.name}`}>
      <div className="cj-cardVisual" aria-hidden="true">
        <span className="cj-cardNumber">{String(index + 1).padStart(2, '0')}</span>
        <span className={`cj-cardOrb is-${state}`}>◇</span>
        <span className="cj-cardVisualLabel">{state === 'verified' ? 'INTERACTIVE 3D' : state === 'review' ? '3D UNDER REVIEW' : '3D COMING SOON'}</span>
      </div>
      <div className="cj-cardSummary">
        <div><small>{item.type}</small><h2>{item.name}</h2></div>
        <strong>${item.customerPriceUsd}</strong>
      </div>
    </button>
    <div className="cj-cardState"><span className="ok">CJ MAPPED</span><span>{state === 'verified' ? '3D VERIFIED' : state === 'review' ? '3D REVIEW' : '3D PENDING'}</span><span>{ready ? 'BUY READY' : 'PREVIEW'}</span></div>
    <div className="cj-cardBottom"><span>{item.supplierSku}</span><button onClick={onOpen}>{active ? 'Viewing above' : 'Inspect object'} ↗</button></div>
  </article>;
}
