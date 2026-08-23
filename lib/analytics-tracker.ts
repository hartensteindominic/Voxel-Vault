// Voxel Vault analytics - revenue tracking, conversion funnels, user LTV metrics

export interface AnalyticsEvent {
  userId: string;
  eventType: string;
  timestamp: number;
  properties?: Record<string, any>;
  sessionId?: string;
}

export interface ConversionMetrics {
  visitors: number;
  cartCreated: number;
  checkoutStarted: number;
  checkoutCompleted: number;
  conversionRate: number;
  averageOrderValue: number;
  totalRevenue: number;
}

class AnalyticsTracker {
  private events: AnalyticsEvent[] = [];
  private batchSize = 50;
  private flushInterval = 30000; // 30 seconds

  constructor() {
    this.startBatchFlush();
  }

  track(event: AnalyticsEvent) {
    this.events.push(event);
    if (this.events.length >= this.batchSize) {
      this.flush();
    }
  }

  private startBatchFlush() {
    setInterval(() => this.flush(), this.flushInterval);
  }

  private async flush() {
    if (this.events.length === 0) return;

    const batch = this.events.splice(0, this.batchSize);
    try {
      await fetch('/api/analytics/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: batch }),
      });
    } catch (error) {
      console.error('Analytics flush failed:', error);
      // Re-queue failed events
      this.events.unshift(...batch);
    }
  }
}

export const tracker = new AnalyticsTracker();

// Revenue tracking events
export const analyticsEvents = {
  VIEW_PRODUCT: 'view_product',
  ADD_TO_CART: 'add_to_cart',
  REMOVE_FROM_CART: 'remove_from_cart',
  CHECKOUT_START: 'checkout_start',
  CHECKOUT_COMPLETE: 'checkout_complete',
  PURCHASE_COMPLETE: 'purchase_complete',
  NFT_MINTED: 'nft_minted',
  REFERRAL_CLICK: 'referral_click',
  REFERRAL_CONVERSION: 'referral_conversion',
};

// Track purchase with all metadata
export function trackPurchase(
  userId: string,
  amount: number,
  items: Array<{ id: string; price: number; name: string }>,
  sessionId?: string
) {
  tracker.track({
    userId,
    eventType: analyticsEvents.PURCHASE_COMPLETE,
    timestamp: Date.now(),
    sessionId,
    properties: {
      amount,
      itemCount: items.length,
      items,
      currency: 'USD',
    },
  });
}

// Calculate LTV (Lifetime Value)
export function calculateLTV(totalRevenue: number, totalCustomers: number): number {
  return totalRevenue / Math.max(totalCustomers, 1);
}
