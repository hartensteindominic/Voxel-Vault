// Voxel Vault dynamic pricing engine - demand-based, seasonal, A/B testing

export interface PricingRule {
  id: string;
  condition: 'demand' | 'seasonal' | 'inventory' | 'ab_test';
  itemId?: string;
  modifier: number; // 1.0 = no change, 1.2 = +20%
  startDate?: number;
  endDate?: number;
  active: boolean;
}

class DynamicPricingEngine {
  private basePrice: Record<string, number> = {};
  private rules: PricingRule[] = [];
  private demandMetrics: Record<string, { views: number; purchases: number }> = {};

  addRule(rule: PricingRule): void {
    this.rules.push(rule);
  }

  removeRule(ruleId: string): void {
    this.rules = this.rules.filter((r) => r.id !== ruleId);
  }

  trackViews(itemId: string): void {
    if (!this.demandMetrics[itemId]) {
      this.demandMetrics[itemId] = { views: 0, purchases: 0 };
    }
    this.demandMetrics[itemId].views++;
  }

  trackPurchase(itemId: string): void {
    if (!this.demandMetrics[itemId]) {
      this.demandMetrics[itemId] = { views: 0, purchases: 0 };
    }
    this.demandMetrics[itemId].purchases++;
  }

  calculatePrice(itemId: string, basePrice: number): number {
    let finalPrice = basePrice;
    const now = Date.now();

    for (const rule of this.rules) {
      if (!rule.active) continue;
      if (rule.itemId && rule.itemId !== itemId) continue;
      if (rule.startDate && now < rule.startDate) continue;
      if (rule.endDate && now > rule.endDate) continue;

      if (rule.condition === 'demand') {
        const metric = this.demandMetrics[itemId];
        if (metric) {
          const conversionRate = metric.purchases / Math.max(metric.views, 1);
          // Increase price if conversion is high (high demand)
          if (conversionRate > 0.05) {
            finalPrice = Math.round(finalPrice * rule.modifier);
          }
        }
      } else if (rule.condition === 'seasonal') {
        finalPrice = Math.round(finalPrice * rule.modifier);
      }
    }

    // Cap price changes to ±50%
    return Math.max(Math.round(basePrice * 0.5), Math.min(finalPrice, Math.round(basePrice * 1.5)));
  }
}

export const pricingEngine = new DynamicPricingEngine();
