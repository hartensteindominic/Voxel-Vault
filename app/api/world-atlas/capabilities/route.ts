import { NextResponse } from 'next/server';
import { WORLD_ATLAS_DATA_RELEASE, WORLD_ATLAS_MESH_POLICY } from '../../../../lib/world-atlas.js';
import { KARTAVIEW_LICENSE, KARTAVIEW_TERMS_URL } from '../../../../lib/open-street-imagery.js';

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
    openStreetReality: {
      configured: true,
      provider: 'KartaView',
      requiresPaidKey: false,
      license: KARTAVIEW_LICENSE,
      termsUrl: KARTAVIEW_TERMS_URL,
      usage: 'public street-level reference imagery; proximity does not itself verify the selected parcel',
    },
    googleReality: {
      configured: false,
      required: false,
      product: 'Optional external Google Maps reference only',
      usage: 'No Google billing or browser key is required by the Voxel Vault World Atlas.',
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
