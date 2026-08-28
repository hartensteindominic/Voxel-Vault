import { NextResponse } from 'next/server';
import { WORLD_ATLAS_DATA_RELEASE, WORLD_ATLAS_MESH_POLICY } from '../../../../lib/world-atlas.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    ok: true,
    worldAtlas: {
      configured: true,
      primary: 'Overture Maps Foundation PMTiles',
      fallback: 'OpenStreetMap / Overpass',
      release: WORLD_ATLAS_DATA_RELEASE,
    },
    googleReality: {
      configured: Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY?.trim()),
      product: 'Google Maps JavaScript API · Photorealistic 3D',
      mode: 'HYBRID',
      usage: 'live visualization only; no extraction, scraping, ML reconstruction, or offline cache',
    },
    meshy: {
      configured: Boolean(process.env.MESHY_API_KEY?.trim()),
      provider: WORLD_ATLAS_MESH_POLICY.provider,
      aiModel: WORLD_ATLAS_MESH_POLICY.aiModel,
      targetPolycount: WORLD_ATLAS_MESH_POLICY.targetPolycount,
      textureResolution: WORLD_ATLAS_MESH_POLICY.textureResolution,
      automaticGeneration: false,
    },
    licensedMarketMedia: {
      bridgeConfigured: Boolean(process.env.BRIDGE_DATASET_ID?.trim() && process.env.BRIDGE_ACCESS_TOKEN?.trim()),
      domainConfigured: Boolean(process.env.DOMAIN_CLIENT_ID?.trim() && process.env.DOMAIN_CLIENT_SECRET?.trim()),
      derivativeUseRule: 'Listing-display rights do not imply AI derivative-generation rights.',
    },
  }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
}
