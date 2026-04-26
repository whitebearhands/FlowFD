import {
  getFirestore,
  doc,
  collection,
  onSnapshot,
  query,
  orderBy,
  limit,
  Unsubscribe,
  Timestamp,
} from "firebase/firestore";
import app from "./firebaseConfig";
import type { Subscription, Credits, CreditTransaction } from "@/types/billing";

const db = getFirestore(app);

function toIso(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === "string") return value;
  return "";
}

function toIsoOrNull(value: unknown): string | null {
  if (!value) return null;
  return toIso(value);
}

function parseSubscription(
  id: string,
  data: Record<string, unknown>
): Subscription {
  return {
    paddleCustomerId: (data.paddle_customer_id as string) ?? "",
    paddleSubscriptionId:
      (data.paddle_subscription_id as string | null) ?? null,
    plan: (data.plan as Subscription["plan"]) ?? "none",
    status: (data.status as Subscription["status"]) ?? "active",
    currentPeriodStart: toIso(data.current_period_start),
    currentPeriodEnd: toIso(data.current_period_end),
    cancelAtPeriodEnd: (data.cancel_at_period_end as boolean) ?? false,
    createdAt: toIso(data.created_at),
    updatedAt: toIso(data.updated_at),
  };
}

function parseCredits(data: Record<string, unknown>): Credits {
  return {
    subscriptionCredits: (data.subscription_credits as number) ?? 0,
    subscriptionCreditsExpiresAt: toIsoOrNull(
      data.subscription_credits_expires_at
    ),
    purchasedCredits: (data.purchased_credits as number) ?? 0,
    totalCredits: (data.total_credits as number) ?? 0,
    updatedAt: toIso(data.updated_at),
  };
}

function parseTransaction(
  id: string,
  data: Record<string, unknown>
): CreditTransaction {
  return {
    txId: id,
    userId: (data.user_id as string) ?? "",
    type: (data.type as CreditTransaction["type"]) ?? "usage",
    amount: (data.amount as number) ?? 0,
    balanceAfter: (data.balance_after as number) ?? 0,
    description: (data.description as string) ?? "",
    jobId: (data.job_id as string | null) ?? null,
    paddleTransactionId:
      (data.paddle_transaction_id as string | null) ?? null,
    createdAt: toIso(data.created_at),
  };
}

export function listenToSubscription(
  userId: string,
  onUpdate: (subscription: Subscription | null) => void
): Unsubscribe {
  const ref = doc(db, "users", userId, "subscription", "current");
  return onSnapshot(ref, (snapshot) => {
    if (!snapshot.exists()) {
      onUpdate(null);
      return;
    }
    onUpdate(parseSubscription(snapshot.id, snapshot.data() as Record<string, unknown>));
  });
}

export function listenToCredits(
  userId: string,
  onUpdate: (credits: Credits | null) => void
): Unsubscribe {
  const ref = doc(db, "users", userId, "credits", "current");
  return onSnapshot(ref, (snapshot) => {
    if (!snapshot.exists()) {
      onUpdate(null);
      return;
    }
    onUpdate(parseCredits(snapshot.data() as Record<string, unknown>));
  });
}

export function listenToTransactions(
  userId: string,
  count: number = 20,
  onUpdate: (transactions: CreditTransaction[]) => void
): Unsubscribe {
  const ref = collection(db, "users", userId, "credit_transactions");
  const q = query(ref, orderBy("created_at", "desc"), limit(count));
  return onSnapshot(q, (snapshot) => {
    onUpdate(
      snapshot.docs.map((d) =>
        parseTransaction(d.id, d.data() as Record<string, unknown>)
      )
    );
  });
}
