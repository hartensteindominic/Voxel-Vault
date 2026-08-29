'use client';

import styles from './PhotoReliefModelViewer.module.css';

export default function VoxelPopHouseRenderPreview({ generatedImage, referenceImage = '', provider = '', onRegenerate = null, sample = false }) {
  if (!generatedImage) return null;
  const providerLabel = String(provider || '').trim().replaceAll('-', ' ').toUpperCase();
  return <div className={`viewerShell ${styles.shell}`} style={{background:'radial-gradient(circle at 50% 18%,#fffdf7 0,#efe8ff 48%,#ded1f7 100%)'}}>
    <img src={generatedImage} alt={sample ? 'Sample VoxelPop 3D house render' : 'Generated VoxelPop 3D house render'} style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'contain',padding:12}}/>
    <div className={styles.qualityBadge} aria-hidden="true"><span>VOXELPOP 3D HOUSE</span><b>{sample ? 'GENERATED HOUSE PREVIEW' : 'AI RENDER · PHOTO REFERENCED'}</b></div>
    {referenceImage ? <div className={styles.sourceCard}><img src={referenceImage} alt="Original house reference"/><span>ORIGINAL REFERENCE</span></div> : null}
    {onRegenerate ? <button type="button" onClick={onRegenerate} style={{position:'absolute',right:12,bottom:12,zIndex:8,minHeight:42,padding:'0 13px',borderRadius:999,border:'1px solid rgba(28,18,35,.15)',background:'rgba(255,250,240,.94)',color:'#24162f',fontWeight:900,fontSize:11,cursor:'pointer'}}>Regenerate 3D</button> : null}
    <div className={styles.hint} aria-hidden="true">{providerLabel ? `GENERATED · ${providerLabel}` : sample ? 'SAMPLE OF THE GENERATED HOUSE STAGE' : 'GENERATED FROM YOUR HOUSE PHOTO'}</div>
  </div>;
}
