'use client';

import {useEffect} from 'react';
import styles from './mint-trade.module.css';

export default function LegacyMintTradeRedirect(){
 useEffect(()=>{location.replace(`/voxelflip/mint${location.search||''}`)},[]);
 return <main className={styles.page}><nav className={styles.nav}><a href="/studio"><img src="/voxelpop/voxelpop-logo.png" alt="VoxelPop"/><b>VoxelPop</b></a><em>VOXELFLIP</em></nav><header className={styles.hero}><p>VOXELFLIP UPDATED</p><h1>Opening the<br/><em>Mint page.</em></h1><span>Minting and Autopilot Trading now have separate, focused workspaces.</span></header></main>;
}
