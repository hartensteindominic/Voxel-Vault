import { ImageResponse } from 'next/og';
import { getCatalogItem } from '../../../lib/catalog';

export const runtime = 'edge';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const id = Number(searchParams.get('asset'));
  const item = Number.isInteger(id) && id > 0 ? getCatalogItem(id - 1) : null;

  const title = item?.name || 'Voxel Vault';
  const subtitle = item
    ? `${item.rarity} · ${item.realityBasis} · ${item.material}`
    : 'Real products with verified 3D collectibles included';
  const price = item?.priceUsd ? `$${item.priceUsd}` : 'USD FIRST';

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '70px', background: '#05060b', color: '#f7f8ff', fontFamily: 'sans-serif', position: 'relative' }}>
        <div style={{ position: 'absolute', width: 520, height: 520, borderRadius: 260, background: 'rgba(114,73,255,.22)', filter: 'blur(80px)', right: -100, top: -100 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, position: 'relative' }}>
          <div style={{ display: 'flex', fontSize: 22, letterSpacing: 8, color: '#9b84ff', fontWeight: 800 }}>VOXEL VAULT</div>
          <div style={{ display: 'flex', fontSize: 72, lineHeight: 1, fontWeight: 900, letterSpacing: -4, maxWidth: 980 }}>{title}</div>
          <div style={{ display: 'flex', fontSize: 28, color: '#aeb2c2', maxWidth: 980 }}>{subtitle}</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', position: 'relative' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 18, color: '#73798b' }}>PHYSICAL PRODUCT · VERIFIED 3D COLLECTIBLE · QR IDENTITY</div>
            <div style={{ fontSize: 24, color: '#fff' }}>Buy normally. Receive the real object. Keep the verified 3D collectible.</div>
          </div>
          <div style={{ display: 'flex', fontSize: 30, fontWeight: 800 }}>{price}</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
