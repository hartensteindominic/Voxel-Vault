// Voxel Vault marketplace enhancements - seller onboarding, inventory sync, dispute resolution

export interface SellerProfile {
  id: string;
  email: string;
  storeName: string;
  verified: boolean;
  kycStatus: 'pending' | 'approved' | 'rejected';
  payoutMethod: 'stripe' | 'bank' | 'crypto';
  commissionRate: number;
  createdAt: number;
  totalSales: number;
  ratings: number[];
}

class SellerOnboardingManager {
  async createSellerProfile(data: {
    email: string;
    storeName: string;
    payoutMethod: string;
  }): Promise<SellerProfile> {
    const profile: SellerProfile = {
      id: `seller_${Date.now()}`,
      email: data.email,
      storeName: data.storeName,
      verified: false,
      kycStatus: 'pending',
      payoutMethod: data.payoutMethod as any,
      commissionRate: 0.15,
      createdAt: Date.now(),
      totalSales: 0,
      ratings: [],
    };

    return profile;
  }

  calculateSellerRating(ratings: number[]): number {
    if (ratings.length === 0) return 0;
    const sum = ratings.reduce((a, b) => a + b, 0);
    return Math.round((sum / ratings.length) * 10) / 10;
  }
}

export const sellerOnboarding = new SellerOnboardingManager();