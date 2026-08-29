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
    blurb: 'A simple way to try the house-to-voxel maker.',
    features: ['3 house voxels / month', 'Saved Voxel Vault inventory', 'Mint-ready 3D voxel'],
  },
  {
    id: 'creator',
    name: 'Creator',
    priceCents: 2900,
    monthlyVoxels: 12,
    blurb: 'The sweet spot for creators building a real collection.',
    badge: 'MOST POPULAR',
    features: ['12 house voxels / month', 'Saved Voxel Vault inventory', 'Mint-ready 3D voxel'],
  },
  {
    id: 'pro',
    name: 'Pro',
    priceCents: 5900,
    monthlyVoxels: 30,
    blurb: 'More monthly capacity for larger property collections.',
    features: ['30 house voxels / month', 'Saved Voxel Vault inventory', 'Mint-ready 3D voxel'],
  },
  {
    id: 'studio',
    name: 'Studio',
    priceCents: 9900,
    monthlyVoxels: 60,
    blurb: 'Maximum monthly capacity for serious studios and large collections.',
    badge: 'PREMIUM',
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
