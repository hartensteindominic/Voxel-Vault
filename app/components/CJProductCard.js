'use client';

export default function CJProductCard({ item, index, active, state, ready, onSelect, onOpen, onWarm }) {
  const visualLabel = state === 'verified' ? 'EXACT 3D APPROVED' : state === 'review' ? '3D PREVIEW READY' : '3D PREWARMING';
  const readinessLabel = ready ? 'READY TO BUY' : state === 'verified' ? 'FULFILLMENT CHECK' : 'NOT FOR SALE YET';
  return <article className={`cj-card ${active ? 'is-active' : ''}`} onMouseEnter={onWarm} onFocusCapture={onWarm} onTouchStart={onWarm}>
    <button className="cj-cardPick" onClick={onSelect} aria-label={`Open ${item.name} in the 3D viewer`}>
      <div className="cj-cardVisual" aria-hidden="true">
        <span className="cj-cardNumber">{String(index + 1).padStart(2, '0')}</span>
        <span className={`cj-cardOrb is-${state}`}>◇</span>
        <span className="cj-cardVisualLabel">{visualLabel}</span>
      </div>
      <div className="cj-cardSummary">
        <div><small>{item.type}</small><h2>{item.name}</h2></div>
        <strong>${item.customerPriceUsd}</strong>
      </div>
    </button>
    <div className="cj-cardState"><span className="ok">CJ SYNCED</span><span>{state === 'verified' ? '3D APPROVED' : state === 'review' ? '3D READY' : '3D WARMING'}</span><span>{readinessLabel}</span></div>
    <div className="cj-cardBottom"><span>{item.supplierSku}</span><button onMouseEnter={onWarm} onFocus={onWarm} onClick={onOpen}>{active ? 'Viewing above' : 'Open in 3D'} ↗</button></div>
  </article>;
}
