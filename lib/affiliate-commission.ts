// Voxel Vault affiliate & referral commission tracking

export interface AffiliateConfig {
  partnerId: string;
  commissionRate: number; // 0.05 = 5%
  tierLevel: 'basic' | 'silver' | 'gold' | 'platinum';
  paymentMethod: 'wallet' | 'stripe' | 'bank_transfer';
}

export interface CommissionRecord {
  id: string;
  referralSource: string; // 'temu' | 'amazon' | 'referral' | 'influencer'
  itemId: string;
  purchaseAmount: number;
  commissionAmount: number;
  status: 'pending' | 'approved' | 'paid' | 'disputed';
  createdAt: number;
  paidAt?: number;
}

// Commission tiers
const TIER_RATES: Record<string, number> = {
  basic: 0.02,
  silver: 0.05,
  gold: 0.08,
  platinum: 0.12,
};

export function calculateCommission(
  purchaseAmount: number,
  tierLevel: 'basic' | 'silver' | 'gold' | 'platinum'
): number {
  const rate = TIER_RATES[tierLevel] || TIER_RATES.basic;
  return Math.round(purchaseAmount * rate);
}

// Referral tracking with validation
export async function trackReferral(
  referrerCode: string,
  itemId: string,
  purchaseAmount: number
): Promise<CommissionRecord | null> {
  try {
    // Validate referrer code format
    if (!referrerCode.match(/^[A-Z0-9]{8,}$/)) {
      return null;
    }

    // Get affiliate config from database
    const affiliate = await getAffiliateByCode(referrerCode);
    if (!affiliate) return null;

    const commission = calculateCommission(purchaseAmount, affiliate.tierLevel);

    const record: CommissionRecord = {
      id: `comm_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      referralSource: 'referral',
      itemId,
      purchaseAmount,
      commissionAmount: commission,
      status: 'pending',
      createdAt: Date.now(),
    };

    // Store in database
    await saveCommissionRecord(record);
    return record;
  } catch (error) {
    console.error('Referral tracking failed:', error);
    return null;
  }
}

// Placeholder - implement with your DB
async function getAffiliateByCode(code: string): Promise<AffiliateConfig | null> {
  // Query database
  return null;
}

async function saveCommissionRecord(record: CommissionRecord): Promise<void> {
  // Save to database
}
