'use client';

export default function CJProductCard({ item, index, active, state, ready, sync, onSelect, onOpen, onWarm }) {
  const progress = Math.max(0, Math.min(100, Number(sync?.progress || 0)));
  const hasThumb = Boolean(sync?.thumbnailUrl);
  const visualLabel = state === 'verified' ? 'COLLECTIBLE APPROVED' : state === 'review' ? 'INTERACTIVE PREVIEW READY' : progress > 0 ? `BUILDING · ${Math.round(progress)}%` : 'PREVIEW WARMING';
  const readinessLabel = ready ? 'READY TO BUY' : state === 'verified' ? 'FULFILLMENT CHECK' : 'COMING TO LIFE';
  return <article className={`cj-card ${active ? 'is-active' : ''}`} onMouseEnter={onWarm} onFocusCapture={onWarm} onTouchStart={onWarm}>
    <button className="cj-cardPick" onClick={onSelect} aria-label={`Open ${item.name} in the interactive viewer`}>
      <div className={`cj-cardVisual ${hasThumb ? 'has-thumb' : ''}`} aria-hidden="true">
        {hasThumb && <img className="cj-cardThumb" src={sync.thumbnailUrl} alt="" loading="lazy" />}
        <span className="cj-cardNumber">{String(index + 1).padStart(2, '0')}</span>
        {!hasThumb && <span className={`cj-cardOrb is-${state}`}>◇</span>}
        <span className="cj-cardVisualLabel">{visualLabel}</span>
        {state === 'pending' && progress > 0 && <span className="cj-cardProgress"><i style={{width:`${progress}%`}} /></span>}
      </div>
      <div className="cj-cardSummary">
        <div><small>{item.type}</small><h2>{item.name}</h2></div>
        <strong>${item.customerPriceUsd}</strong>
      </div>
    </button>
    <div className="cj-cardState"><span className="ok">PRODUCT SYNCED</span><span>{state === 'verified' ? 'MATCH APPROVED' : state === 'review' ? 'PREVIEW READY' : progress > 0 ? 'BUILDING' : 'QUEUED'}</span><span>{readinessLabel}</span></div>
    <div className="cj-cardBottom"><span>Physical product + digital collectible</span><button onMouseEnter={onWarm} onFocus={onWarm} onClick={onOpen}>{active ? 'Viewing above' : state === 'review' || state === 'verified' ? 'Open preview' : 'Open product'} ↗</button></div>
  </article>;
}
