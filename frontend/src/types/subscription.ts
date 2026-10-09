export type SubscriptionInterval = 'month' | 'year';

export interface SubscriptionOffer {
  key: 'pro_monthly' | 'pro_yearly';
  name: string;
  interval: SubscriptionInterval;
  currency: string;
  amount: number;
  productName: string;
}

export interface SubscriptionSummary {
  plan: 'free' | 'pro';
  status: string;
  billingInterval: SubscriptionInterval | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  canManage: boolean;
  hasBillingAccount: boolean;
  configured: boolean;
  offers: SubscriptionOffer[];
  features: {
    inventoryVariantLimit: number | null;
    lowStockAlerts: boolean;
    detailedSalesAndProfitReports: boolean;
  };
}
