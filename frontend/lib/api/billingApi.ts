import apiClient from "./client";
import type { BillingCreditsResponse } from "@/types/billing";

export type CheckoutRequest = {
  productType: "subscription" | "credits";
  plan?: "monthly" | "annual";
  creditsProduct?: "credits_200" | "credits_500" | "credits_1000";
};

export type CheckoutResponse = {
  checkoutUrl: string;
  transactionId: string;
};

export async function createCheckout(
  body: CheckoutRequest
): Promise<CheckoutResponse> {
  const { data } = await apiClient.post<CheckoutResponse>(
    "/billing/checkout",
    body
  );
  return data;
}

export async function getBillingCredits(): Promise<BillingCreditsResponse> {
  const { data } =
    await apiClient.get<BillingCreditsResponse>("/billing/credits");
  return data;
}

export async function cancelSubscription(): Promise<void> {
  await apiClient.post("/billing/subscription/cancel");
}

export async function resumeSubscription(): Promise<void> {
  await apiClient.post("/billing/subscription/resume");
}
