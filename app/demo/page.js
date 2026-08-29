'use client';

import Link from 'next/link';
import { useState } from 'react';
import LocalVoxelModelViewer from '../property/LocalVoxelModelViewer';

const DEMO_IMAGE = '/demo/property-house.svg';

export default function PublicDemoPage() {
  const [ready, setReady] = useState(false);

  return <main className="page">
    <div className="shell">
      <nav className="top"><Link href="/" className="brand"><span>V</span><b>VOXEL VAULT</b></Link><div><Link href="/property">Create</Link><Link href="/world">World</Link><Link href="/about">About</Link></div></nav>

      <header className="hero">
        <small>PUBLIC DEMO · NO LOGIN</small>
        <h1>See the idea<br/><em>before you pay.</em></h1>
        <p>This synthetic house is here only to demonstrate the VoxelPop interaction. Drag the 3D, pinch to zoom on mobile, then start your own $4.99 creation when you are ready.</p>
      </header>

      <section className="compare">
        <article className="card source">
          <div className="cardHead"><span>1</span><div><small>SAMPLE SOURCE</small><h2>House image</h2></div></div>
          <div className="media"><img src={DEMO_IMAGE} alt="Synthetic red brick house used for the public VoxelPop demo"/></div>
          <p>This is synthetic sample art—not a customer upload and not a real property.</p>
        </article>

        <div className="arrow">→</div>

        <article className="card model">
          <div className="cardHead"><span>2</span><div><small>INTERACTIVE RESULT</small><h2>{ready ? 'Movable voxel 3D' : 'Building voxel 3D…'}</h2></div></div>
          <div className="media viewer"><LocalVoxelModelViewer imageUrl={DEMO_IMAGE} sourceImageUrl={DEMO_IMAGE} onReady={() => setReady(true)}/></div>
          <p>{ready ? 'Drag it. Zoom it. This sample runs directly in your browser.' : 'The sample image stays visible until the interactive 3D is actually ready.'}</p>
        </article>
      </section>

      <section className="next">
        <div><small>YOUR REAL FLOW</small><h2>Photo → $4.99 → 3D preview → approve → voxel → optional mint</h2><p>Your source photo stays on your device during the normal property creation flow. One photo can guide the visible front; it cannot prove unseen sides, exact dimensions, title, ownership, or property value.</p></div>
        <Link href="/property">CREATE MINE · $4.99 →</Link>
      </section>

      <footer><span>Demo content is synthetic. A VoxelPop model or NFT is a digital creation, not a deed or ownership of physical property.</span><nav><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/about">About + Support</Link></nav></footer>
    </div>

    <style jsx>{`
      :global(body){margin:0;background:#fffaf0;color:#1f1723;font-family:Inter,ui-rounded,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.page{min-height:100vh;padding:12px 14px calc(94px + env(safe-area-inset-bottom));background:radial-gradient(circle at 7% 7%,#efffb6 0,transparent 25%),radial-gradient(circle at 93% 10%,#eee5ff 0,transparent 28%),#fffaf0}.shell{width:min(1050px,100%);margin:auto}.top{min-height:58px;display:flex;align-items:center;justify-content:space-between;gap:12px}.brand{display:flex;align-items:center;gap:9px;color:#211923;text-decoration:none;font-size:10px;letter-spacing:.12em}.brand span{width:38px;height:38px;border-radius:13px;background:#7138f5;color:#fff;display:grid;place-items:center;font-size:19px;font-weight:1000;box-shadow:0 6px 0 #4d1bc5}.top>div{display:flex;gap:5px}.top>div a{padding:10px 12px;border-radius:999px;border:1px solid #e2dce6;background:#ffffffc7;color:#5e5362;text-decoration:none;font-size:9px;font-weight:950}.hero{text-align:center;padding:70px 0 35px}.hero small,.next small,.cardHead small{color:#7138f5;font-size:9px;font-weight:1000;letter-spacing:.15em}.hero h1{margin:11px 0 16px;font-size:clamp(54px,9vw,92px);line-height:.88;letter-spacing:-.07em}.hero h1 em{font-style:normal;color:#7138f5}.hero p{max-width:720px;margin:auto;color:#756c77;font-size:15px;line-height:1.6}.compare{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:16px}.card{padding:16px;border:1px solid #e6dfe8;border-radius:29px;background:#ffffffd8;box-shadow:0 20px 52px #6f51a115}.cardHead{display:flex;align-items:center;gap:12px;margin-bottom:13px}.cardHead>span{width:38px;height:38px;border-radius:13px;background:#c9ff54;display:grid;place-items:center;font-weight:1000;color:#36500e}.cardHead h2{margin:2px 0 0;font-size:23px;letter-spacing:-.04em}.media{position:relative;aspect-ratio:1/1;overflow:hidden;border-radius:22px;background:#24172e}.media>img{width:100%;height:100%;display:block;object-fit:cover}.viewer :global(.localViewerShell){position:absolute!important;inset:0!important;min-height:100%!important}.card>p{min-height:40px;margin:12px 2px 0;color:#7f7582;font-size:10px;line-height:1.5}.arrow{font-size:38px;color:#7138f5;font-weight:1000}.next{margin-top:18px;padding:25px;border-radius:28px;background:#22162f;color:#fff;display:grid;grid-template-columns:1fr auto;align-items:center;gap:22px;box-shadow:0 20px 50px #3b225b22}.next h2{margin:5px 0 8px;font-size:29px;letter-spacing:-.045em}.next p{margin:0;max-width:720px;color:#c8bdcf;font-size:11px;line-height:1.6}.next a{min-height:58px;padding:0 22px;border-radius:18px;background:#c9ff54;color:#25350d;text-decoration:none;font-size:11px;font-weight:1000;display:flex;align-items:center;justify-content:center;white-space:nowrap;box-shadow:0 9px 0 #9dcc35}footer{display:flex;justify-content:space-between;gap:20px;margin-top:22px;padding:20px 4px;border-top:1px solid #e5ddd4;color:#8a808b;font-size:9px;line-height:1.55}footer span{max-width:700px}footer nav{display:flex;gap:12px;flex-wrap:wrap;justify-content:flex-end}footer a{color:#6938dd;text-decoration:none;font-weight:900}@media(max-width:760px){.hero{padding-top:48px}.compare{grid-template-columns:1fr}.arrow{transform:rotate(90deg);text-align:center}.next{grid-template-columns:1fr}.next a{width:100%}}@media(max-width:520px){.page{padding:9px 10px calc(86px + env(safe-area-inset-bottom))}.top>div a:nth-child(2){display:none}.hero{padding:36px 0 24px}.hero h1{font-size:52px}.hero p{font-size:13px}.card{padding:12px;border-radius:24px}.media{border-radius:19px}.next{padding:19px;border-radius:23px}.next h2{font-size:25px}footer{flex-direction:column}footer nav{justify-content:flex-start}}
    `}</style>
  </main>;
}
