export type VoxelMakerPlanId = 'starter' | 'creator' | 'pro' | 'studio';

export type VoxelMakerPlan = {
  id: VoxelMakerPlanId;
  name: string;
  priceCents: number;
  monthlyVoxels: number;
  blurb: string;
  badge?: string;
  features: string[];
};

export const VOXEL_MAKER_PLANS: readonly VoxelMakerPlan[] = Object.freeze([
  {
    id: 'starter',
    name: 'Starter',
    priceCents: 900,
    monthlyVoxels: 3,
    blurb: 'For trying the house-to-voxel maker.',
    features: ['3 house voxels / month', 'Saved Voxel Vault inventory', 'Mint-ready 3D voxel'],
  },
  {
    id: 'creator',
    name: 'Creator',
    priceCents: 2900,
    monthlyVoxels: 12,
    blurb: 'For regular creators and collectors.',
    badge: 'MOST POPULAR',
    features: ['12 house voxels / month', 'Saved Voxel Vault inventory', 'Mint-ready 3D voxel'],
  },
  {
    id: 'pro',
    name: 'Pro',
    priceCents: 5900,
    monthlyVoxels: 30,
    blurb: 'For high-volume property collections.',
    features: ['30 house voxels / month', 'Saved Voxel Vault inventory', 'Mint-ready 3D voxel'],
  },
  {
    id: 'studio',
    name: 'Studio',
    priceCents: 9900,
    monthlyVoxels: 60,
    blurb: 'For studios building large voxel collections.',
    badge: 'MAX',
    features: ['60 house voxels / month', 'Saved Voxel Vault inventory', 'Mint-ready 3D voxel'],
  },
]);

export function voxelMakerPlan(planId: unknown): VoxelMakerPlan | null {
  const normalized = String(planId || '').trim().toLowerCase();
  return VOXEL_MAKER_PLANS.find((plan) => plan.id === normalized) || null;
}

export function formatVoxelMakerPrice(priceCents: number) {
  return `$${Math.max(0, Math.round(priceCents / 100))}`;
}
