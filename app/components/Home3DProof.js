'use client';

import { useState } from 'react';
import PhotoReliefModelViewer from '../property/PhotoReliefModelViewer';
import LocalVoxelModelViewer from '../property/LocalVoxelModelViewer';

const SAMPLE = '/voxelpop/demo-house.svg';

export default function Home3DProof() {
  const [stage, setStage] = useState('preview');
  const [voxelReady, setVoxelReady] = useState(false);

  return <section className="vvHomeProof" aria-label="Interactive VoxelPop product preview">
    <div className="vvHomeProofTop">
      <div>
        <small>REAL PRODUCT VIEWER</small>
        <b>{stage === 'preview' ? 'Textured 3D preview' : 'Movable voxel'}</b>
      </div>
      <div className="vvHomeProofTabs" role="tablist" aria-label="VoxelPop preview stage">
        <button type="button" role="tab" aria-selected={stage === 'preview'} onClick={() => setStage('preview')}>3D preview</button>
        <button type="button" role="tab" aria-selected={stage === 'voxel'} onClick={() => setStage('voxel')}>Voxel</button>
      </div>
    </div>
    <div className="vvHomeProofViewer">
      {stage === 'preview'
        ? <PhotoReliefModelViewer imageUrl={SAMPLE}/>
        : <LocalVoxelModelViewer imageUrl={SAMPLE} sourceImageUrl={SAMPLE} onReady={() => setVoxelReady(true)}/>} 
      <span className="vvHomeProofStage">{stage === 'preview' ? '1 · SEE IT FIRST' : voxelReady ? '2 · VOXEL READY' : '2 · BUILDING VOXEL'}</span>
    </div>
    <div className="vvHomeProofBottom">
      <span>{stage === 'preview' ? 'Drag to inspect the same bounded 3D preview used by the creator.' : 'The separate voxel is built locally from the same visible source.'}</span>
      <b>$4.99 <small>one creation</small></b>
    </div>
  </section>;
}
