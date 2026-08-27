'use client';

import {useEffect,useMemo,useRef,useState} from 'react';
import {usePathname} from 'next/navigation';

const READY_TEXT='PROFIT FLOOR CLEARED';

function readV6State(){
  const main=document.querySelector('main');
  if(!main)return {ready:false,gap:null,heat:'WAITING',watching:false,scanned:false};
  const text=String(main.innerText||'');
  const ready=text.includes(READY_TEXT);
  const gapMatch=text.match(/Closest route is about\s+([\d,.]+)\s+bps short/i);
  const gap=gapMatch?Number(gapMatch[1].replace(/,/g,'')):ready?0:null;
  const heatMatch=text.match(/\b(COLD|WARM|HOT|ACTIONABLE)\b/i);
  const watching=/PAUSE V6 AUTO WATCH/i.test(text);
  const scanned=/SCAN COMPLETE|AUTO WATCH|routes across|ROUTES QUOTED/i.test(text);
  return {ready,gap:Number.isFinite(gap)?gap:null,heat:ready?'READY':String(heatMatch?.[1]||'WAITING').toUpperCase(),watching,scanned};
}

function findActionButton(){
  return Array.from(document.querySelectorAll('button,a')).find(node=>/SIMULATE\s*\+\s*EXECUTE ATOMICALLY/i.test(String(node.textContent||'')));
}

export default function ProfitReadinessMeter(){
  const pathname=usePathname();
  const [state,setState]=useState({ready:false,gap:null,heat:'WAITING',watching:false,scanned:false});
  const alertedRef=useRef(false);

  useEffect(()=>{
    if(pathname?.includes('/deploy'))return undefined;
    let observer=null;
    let timer=null;
    const update=()=>setState(readV6State());
    const attach=()=>{
      const main=document.querySelector('main');
      if(!main){timer=setTimeout(attach,250);return}
      update();
      observer=new MutationObserver(update);
      observer.observe(main,{subtree:true,childList:true,characterData:true,attributes:true});
    };
    attach();
    window.addEventListener('focus',update);
    document.addEventListener('visibilitychange',update);
    return()=>{
      if(observer)observer.disconnect();
      if(timer)clearTimeout(timer);
      window.removeEventListener('focus',update);
      document.removeEventListener('visibilitychange',update);
    };
  },[pathname]);

  useEffect(()=>{
    if(state.ready&&!alertedRef.current){
      alertedRef.current=true;
      try{navigator.vibrate?.([250,120,250,120,450])}catch{}
      try{document.title='READY TO SIMULATE · Voxel Vault'}catch{}
    }
    if(!state.ready){
      alertedRef.current=false;
      try{document.title='Voxel Vault'}catch{}
    }
  },[state.ready]);

  const display=useMemo(()=>{
    if(state.ready)return {headline:'PROFIT FLOOR CLEARED',sub:'READY TO SIMULATE',detail:'A V6 route is above the scanner profit floor. Run the fresh simulation now.',tone:'ready'};
    if(!state.scanned)return {headline:'V6 IS WATCHING',sub:'WAITING FOR FIRST LIVE SCAN',detail:'The readiness meter will update automatically when V6 produces a route snapshot.',tone:'waiting'};
    const gap=state.gap;
    if(gap===null)return {headline:`MARKET ${state.heat}`,sub:'NO EXECUTABLE PROFIT YET',detail:'V6 is scanning. No route currently clears gas plus your minimum profit target.',tone:'cold'};
    if(gap<=5)return {headline:'VERY CLOSE',sub:`${gap} BPS TO GO`,detail:'The best route is near the floor. V6 should be in its fastest watch cadence.',tone:'hot'};
    if(gap<=25)return {headline:'GETTING CLOSE',sub:`${gap} BPS TO GO`,detail:'The best route is approaching the required gas + profit threshold.',tone:'warm'};
    return {headline:`MARKET ${state.heat}`,sub:`${gap} BPS TO GO`,detail:'The best route is still below the required gas + profit threshold.',tone:'cold'};
  },[state]);

  if(pathname?.includes('/deploy'))return null;

  const ready=display.tone==='ready';
  const hot=display.tone==='hot';
  const warm=display.tone==='warm';
  const background=ready?'#b6ff22':hot?'#e9ff5a':warm?'#d9e85f':'#161b16';
  const foreground=ready||hot||warm?'#0b0d0b':'#f4f5ef';
  const border=ready?'#d8ff85':hot?'#f4ff98':warm?'#eaf59b':'#354034';

  function focusAction(){
    if(!ready)return;
    const action=findActionButton();
    if(action){action.scrollIntoView({behavior:'smooth',block:'center'});try{navigator.vibrate?.(120)}catch{}}
  }

  return <aside id="v6-profit-readiness-meter" role={ready?'alert':'status'} aria-live={ready?'assertive':'polite'} onClick={focusAction} style={{position:'sticky',top:0,zIndex:60,width:'100%',boxSizing:'border-box',padding:'10px 12px 0',background:'#070907'}}>
    <div style={{maxWidth:760,margin:'0 auto',border:`2px solid ${border}`,borderRadius:22,padding:'14px 16px 15px',background,color:foreground,boxShadow:ready?'0 0 0 4px rgba(182,255,34,.18), 0 8px 32px rgba(182,255,34,.22)':'0 8px 28px rgba(0,0,0,.24)',cursor:ready?'pointer':'default'}}>
      <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center'}}>
        <div style={{fontSize:12,fontWeight:900,letterSpacing:'0.16em',opacity:.72}}>V6 PROFIT READINESS</div>
        <div style={{fontSize:12,fontWeight:900,letterSpacing:'0.08em'}}>{state.watching?'AUTO WATCH · ON':'AUTO WATCH · CHECK PAGE'}</div>
      </div>
      <div style={{fontSize:ready?31:24,lineHeight:1.02,fontWeight:950,marginTop:8,letterSpacing:'-0.035em'}}>{display.headline}</div>
      <div style={{fontSize:ready?20:17,fontWeight:900,marginTop:5}}>{display.sub}</div>
      <div style={{fontSize:14,lineHeight:1.45,marginTop:7,opacity:.82}}>{display.detail}</div>
      {state.gap!==null&&!ready&&<div style={{height:8,borderRadius:999,background:'rgba(255,255,255,.12)',overflow:'hidden',marginTop:11}}><div style={{height:'100%',width:`${Math.max(4,Math.min(96,100-(Math.log10(Math.max(1,state.gap))*28)))}%`,borderRadius:999,background:'currentColor',opacity:.75}}/></div>}
      {ready&&<div style={{fontSize:13,fontWeight:950,marginTop:10,letterSpacing:'0.04em'}}>TAP THIS BANNER → JUMP TO SIMULATE + EXECUTE</div>}
    </div>
  </aside>;
}
