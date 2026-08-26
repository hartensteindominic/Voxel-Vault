'use client';

import {useEffect,useMemo,useState} from 'react';
import {getAddress,isAddress} from 'ethers';
import {discoverMetaMaskProvider} from '../../../lib/wallet-connect';

const DEFAULT_TEST_FORGE='0x8A853C34Dba507f69c3CF802DC9c713a8116201A';
const EXPLORER='https://sepolia.basescan.org';
const challenges=[
  'THEME RUN · Pick three parents that look like they belong in the same world.',
  'CHAOS RUN · Pick the three most different-looking parents you own.',
  'TOKEN RUN · Use three verified NFTs with different token numbers.',
  'LEGACY RUN · Include a legacy VoxelFlip parent if one appears in your wallet.',
  'COLOR RUN · Build a trio around one dominant color family.',
  'SILHOUETTE RUN · Choose three parents with clearly different shapes.',
];

function badgeState(count){
  return [
    {name:'FIRST SPARK',need:1,icon:'✦'},
    {name:'TRIPLE THREAT',need:3,icon:'III'},
    {name:'FORGE FIVE',need:5,icon:'V'},
    {name:'DOZEN CLUB',need:12,icon:'XII'},
    {name:'MASTER SMITH',need:25,icon:'◆'},
  ].map(item=>({...item,unlocked:count>=item.need}));
}

function short(value){return value?`${String(value).slice(0,6)}…${String(value).slice(-4)}`:'—'}

export default function ForgePassport(){
  const [wallet,setWallet]=useState('');
  const [forge,setForge]=useState(DEFAULT_TEST_FORGE);
  const [stats,setStats]=useState(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');

  const badges=useMemo(()=>badgeState(Number(stats?.confirmedForges||0)),[stats?.confirmedForges]);
  const challenge=challenges[Number(stats?.confirmedForges||0)%challenges.length];
  const nextBadge=badges.find(badge=>!badge.unlocked)||null;

  async function detectWallet(){
    try{
      const queryForge=new URLSearchParams(window.location.search).get('clone')||'';
      if(isAddress(queryForge))setForge(getAddress(queryForge));
      const injected=await discoverMetaMaskProvider();
      if(!injected)return '';
      const accounts=await injected.request({method:'eth_accounts'});
      const address=accounts?.[0]?getAddress(accounts[0]):'';
      setWallet(address);
      return address;
    }catch{return ''}
  }

  async function refresh(explicitWallet=''){
    setBusy(true);setError('');
    try{
      const address=explicitWallet||wallet||await detectWallet();
      if(!address)throw new Error('Connect MetaMask in the Forge above, then refresh your Passport.');
      const response=await fetch(`/api/forge/passport?${new URLSearchParams({wallet:address,forge})}`,{cache:'no-store'});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||'Could not read Forge history.');
      setStats(data);
    }catch(e){setError(e instanceof Error?e.message:'Could not refresh Forge Passport.')}finally{setBusy(false)}
  }

  useEffect(()=>{
    let active=true;
    detectWallet().then(address=>{if(active&&address)refresh(address)});
    return()=>{active=false};
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  return <section style={{background:'#070809',color:'#f7f7f3',padding:'8px 16px 54px',fontFamily:'Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif'}}>
    <div style={{maxWidth:940,margin:'0 auto',border:'1px solid rgba(200,255,84,.18)',borderRadius:26,background:'radial-gradient(600px 260px at 0% 0%,rgba(156,131,255,.16),transparent 65%),linear-gradient(180deg,#121318,#0d0e12)',padding:'clamp(18px,4vw,28px)',boxShadow:'0 28px 70px rgba(0,0,0,.35)'}}>
      <div style={{display:'flex',justifyContent:'space-between',gap:18,alignItems:'flex-start',flexWrap:'wrap'}}>
        <div>
          <small style={{display:'block',color:'#c8ff54',fontWeight:950,letterSpacing:'.16em',fontSize:10}}>FORGE ARCADE · ON-CHAIN PASSPORT</small>
          <h2 style={{margin:'8px 0 8px',fontSize:'clamp(30px,7vw,54px)',lineHeight:1,letterSpacing:'-.05em'}}>Keep forging.<br/><em style={{fontStyle:'normal',color:'#9c83ff'}}>Build your lineage.</em></h2>
          <p style={{margin:0,maxWidth:650,color:'#8d8f98',fontSize:13,lineHeight:1.6}}>This reads confirmed <b style={{color:'#d4d4d8'}}>Forged</b> events from your Base Sepolia test Forge and turns them into cosmetic progress. No extra wallet signature is needed to view it.</p>
        </div>
        <button onClick={()=>refresh()} disabled={busy} style={{border:'1px solid rgba(255,255,255,.12)',borderRadius:13,background:'rgba(255,255,255,.05)',color:'#f7f7f3',padding:'12px 15px',fontWeight:900,fontSize:10,letterSpacing:'.08em'}}>{busy?'SYNCING…':'↻ REFRESH PASSPORT'}</button>
      </div>

      {stats?<>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:10,marginTop:22}}>
          <article style={statCard}><small style={statLabel}>CONFIRMED FORGES</small><b style={statBig}>{stats.confirmedForges}</b><span style={statSub}>real testnet events</span></article>
          <article style={statCard}><small style={statLabel}>FORGE XP</small><b style={statBig}>{stats.forgeXp}</b><span style={statSub}>100 cosmetic XP / forge</span></article>
          <article style={statCard}><small style={statLabel}>LATEST RARE</small><b style={statBig}>{stats.latest?`#${stats.latest.tokenId}`:'—'}</b><span style={statSub}>{stats.latest?`${short(stats.latest.txHash)} tx`:'forge one to unlock'}</span></article>
          <article style={statCard}><small style={statLabel}>NEXT BADGE</small><b style={{...statBig,fontSize:18}}>{nextBadge?nextBadge.name:'ALL CURRENT BADGES'}</b><span style={statSub}>{nextBadge?`${Math.max(0,nextBadge.need-stats.confirmedForges)} forge${nextBadge.need-stats.confirmedForges===1?'':'s'} to go`:'legend status'}</span></article>
        </div>

        <div style={{marginTop:20}}>
          <small style={sectionLabel}>BADGE WALL</small>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(145px,1fr))',gap:9,marginTop:9}}>{badges.map(badge=><article key={badge.name} style={{border:`1px solid ${badge.unlocked?'rgba(200,255,84,.30)':'rgba(255,255,255,.08)'}`,borderRadius:15,padding:13,background:badge.unlocked?'rgba(200,255,84,.07)':'rgba(255,255,255,.025)',opacity:badge.unlocked?1:.5}}><b style={{display:'block',color:badge.unlocked?'#c8ff54':'#777983',fontSize:18}}>{badge.icon}</b><strong style={{display:'block',marginTop:8,fontSize:11}}>{badge.name}</strong><span style={{display:'block',marginTop:4,color:'#777983',fontSize:9}}>{badge.unlocked?'UNLOCKED':`${badge.need} confirmed forges`}</span></article>)}</div>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:12,marginTop:20}}>
          <article style={wideCard}>
            <small style={sectionLabel}>TODAY'S OPTIONAL CHALLENGE</small>
            <h3 style={{margin:'8px 0 6px',fontSize:18}}>{challenge.split(' · ')[0]}</h3>
            <p style={{margin:0,color:'#8d8f98',fontSize:11,lineHeight:1.55}}>{challenge.split(' · ')[1]}</p>
          </article>
          <article style={wideCard}>
            <small style={sectionLabel}>RECENT RARE CABINET</small>
            {stats.rareTokenIds?.length?<div style={{display:'flex',gap:7,flexWrap:'wrap',marginTop:11}}>{stats.rareTokenIds.map(id=><span key={id} style={{border:'1px solid rgba(156,131,255,.25)',borderRadius:999,padding:'7px 9px',background:'rgba(156,131,255,.07)',fontSize:10,fontWeight:900,color:'#c4b5fd'}}>RARE #{id}</span>)}</div>:<p style={{color:'#777983',fontSize:11}}>No confirmed Rares found in the scanned window yet.</p>}
          </article>
        </div>

        <div style={{display:'flex',gap:10,flexWrap:'wrap',marginTop:18}}>
          <a href="/forge/real" style={{flex:'1 1 220px',textAlign:'center',textDecoration:'none',padding:'14px 16px',borderRadius:14,fontWeight:950,fontSize:11,letterSpacing:'.06em',background:'#c8ff54',color:'#101207'}}>⚒ FORGE AGAIN</a>
          {stats.latest?.txHash&&<a href={`${EXPLORER}/tx/${stats.latest.txHash}`} target="_blank" rel="noreferrer" style={{flex:'1 1 220px',textAlign:'center',textDecoration:'none',padding:'14px 16px',borderRadius:14,fontWeight:900,fontSize:11,letterSpacing:'.05em',border:'1px solid rgba(255,255,255,.12)',color:'#f7f7f3'}}>VIEW LATEST ON BASESCAN ↗</a>}
        </div>
        <p style={{margin:'13px 0 0',color:'#60626a',fontSize:9,lineHeight:1.5}}>Forge XP, challenges, and badges are cosmetic testnet progression only. They do not represent rarity pricing, investment value, or guaranteed resale value.</p>
      </>:<div style={{marginTop:20,border:'1px dashed rgba(156,131,255,.25)',borderRadius:16,padding:18,color:'#8d8f98',fontSize:11,lineHeight:1.55}}>{busy?'Reading your confirmed Forge history from Base Sepolia…':wallet?'Tap REFRESH PASSPORT to load your Forge history.':'Connect MetaMask in the Forge above and your Passport will appear here automatically.'}</div>}

      {error&&<div style={{marginTop:12,border:'1px solid rgba(255,142,142,.18)',borderRadius:13,background:'rgba(255,142,142,.06)',padding:12,color:'#e4a5a5',fontSize:11}}>{error}</div>}
    </div>
  </section>;
}

const statCard={border:'1px solid rgba(255,255,255,.08)',borderRadius:16,background:'#090a0d',padding:15};
const statLabel={display:'block',color:'#777983',fontSize:8,fontWeight:950,letterSpacing:'.13em'};
const statBig={display:'block',marginTop:7,fontSize:28,lineHeight:1,color:'#f7f7f3'};
const statSub={display:'block',marginTop:6,color:'#6d6f78',fontSize:9};
const sectionLabel={display:'block',color:'#9c83ff',fontSize:8,fontWeight:950,letterSpacing:'.14em'};
const wideCard={border:'1px solid rgba(255,255,255,.08)',borderRadius:17,background:'#090a0d',padding:16};
