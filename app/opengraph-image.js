import { ImageResponse } from 'next/og';

export const alt = 'Voxel Vault · Photo to 3D preview to voxel';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'72px 78px',background:'linear-gradient(135deg,#fffaf0 0%,#f5ffe2 48%,#eee5ff 100%)',color:'#1e1721',fontFamily:'Arial, sans-serif'}}>
      <div style={{display:'flex',flexDirection:'column',width:'650px'}}>
        <div style={{display:'flex',fontSize:22,fontWeight:800,letterSpacing:3,color:'#7138f5'}}>VOXEL VAULT · VOXELPOP PROPERTY</div>
        <div style={{display:'flex',flexDirection:'column',fontSize:68,fontWeight:900,lineHeight:.96,letterSpacing:-4,marginTop:24}}>
          <span>See your house in 3D.</span>
          <span style={{color:'#7138f5'}}>Then make the voxel.</span>
        </div>
        <div style={{display:'flex',marginTop:30,fontSize:26,color:'#6e6571'}}>Photo → $4.99 → 3D preview → voxel → optional mint</div>
        <div style={{display:'flex',marginTop:26,padding:'14px 18px',borderRadius:18,background:'#22162f',color:'#c9ff54',fontSize:18,fontWeight:800,width:'fit-content'}}>TRY THE PUBLIC 3D DEMO</div>
      </div>
      <div style={{position:'relative',display:'flex',width:350,height:390,alignItems:'flex-end',justifyContent:'center'}}>
        <div style={{position:'absolute',bottom:0,width:330,height:62,borderRadius:'50%',background:'#9aca56'}}/>
        <div style={{position:'absolute',bottom:45,width:245,height:190,borderRadius:12,background:'#8e4838',boxShadow:'18px 18px 0 #6d352b'}}/>
        <div style={{position:'absolute',bottom:215,width:300,height:140,background:'#4d3945',clipPath:'polygon(50% 0,100% 72%,82% 100%,18% 100%,0 72%)'}}/>
        <div style={{position:'absolute',bottom:105,left:92,width:54,height:66,border:'10px solid #f0ddc1',background:'#34454d'}}/>
        <div style={{position:'absolute',bottom:105,right:92,width:54,height:66,border:'10px solid #f0ddc1',background:'#34454d'}}/>
        <div style={{position:'absolute',bottom:45,width:54,height:108,background:'#342723'}}/>
        <div style={{position:'absolute',right:-8,top:8,display:'flex',flexDirection:'column',padding:'16px 18px',borderRadius:22,background:'#ffffffee',boxShadow:'0 18px 40px #5f447522',fontSize:15,color:'#756a79'}}><span>ONE CREATION</span><b style={{fontSize:38,color:'#7138f5'}}>$4.99</b></div>
      </div>
    </div>,
    size,
  );
}
