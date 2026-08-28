import { stripe } from './stripe-server';

type SellerAccountRow = {
  stripe_account_id?: unknown;
} | null | undefined;

export type MarketplaceSellerPayoutReadiness = {
  ready: boolean;
  destination: string;
  reason: string;
};

function payoutsActivated() {
  return String(process.env.MARKETPLACE_SELLER_PAYOUTS_ENABLED || '').trim().toLowerCase() === 'true';
}

/**
 * Marketplace checkout must not trust browser-writable seller status flags.
 * The Stripe account itself is the authority for whether destination charges
 * and payouts are currently usable. A separate server-only activation switch
 * stays OFF until seller payout rows are server-controlled and Connect onboarding
 * has been reviewed. If any gate cannot be confirmed, checkout fails closed and
 * no customer payment session is created.
 */
export async function verifyMarketplaceSellerPayoutReadiness(
  seller: SellerAccountRow,
): Promise<MarketplaceSellerPayoutReadiness> {
  if (!payoutsActivated()) {
    return {
      ready: false,
      destination: '',
      reason: 'Marketplace seller payouts are not activated on this deployment.',
    };
  }

  const destination = String(seller?.stripe_account_id || '').trim();
  if (!destination.startsWith('acct_')) {
    return {
      ready: false,
      destination: '',
      reason: 'Seller payouts are not configured.',
    };
  }

  try {
    const account = await stripe.accounts.retrieve(destination);
    const ready = account.charges_enabled === true
      && account.payouts_enabled === true
      && account.details_submitted === true;

    return {
      ready,
      destination: ready ? destination : '',
      reason: ready ? '' : 'Seller Stripe onboarding is not fully payout-ready.',
    };
  } catch {
    return {
      ready: false,
      destination: '',
      reason: 'Seller Stripe account could not be verified.',
    };
  }
}
