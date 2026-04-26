export type SubscriptionPlan = "none" | "monthly" | "annual";

export type SubscriptionStatus = "active" | "canceled" | "past_due" | "paused";

export type CreditTransactionType =
  | "subscription_grant"
  | "purchase"
  | "usage"
  | "refund";

export type Subscription = {
  paddleCustomerId: string;
  paddleSubscriptionId: string | null;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Credits = {
  subscriptionCredits: number;
  subscriptionCreditsExpiresAt: string | null;
  purchasedCredits: number;
  totalCredits: number;
  updatedAt: string;
};

export type CreditTransaction = {
  txId: string;
  userId: string;
  type: CreditTransactionType;
  amount: number;
  balanceAfter: number;
  description: string;
  jobId: string | null;
  paddleTransactionId: string | null;
  createdAt: string;
};

export type BillingCreditsResponse = {
  subscriptionCredits: number;
  purchasedCredits: number;
  totalCredits: number;
  subscription: {
    plan: SubscriptionPlan;
    status: SubscriptionStatus;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
  } | null;
};
