"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { initializePaddle, type Paddle } from "@paddle/paddle-js";
import { useAuth } from "@/lib/firebase/useAuth";
import {
  listenToCredits,
  listenToSubscription,
  listenToTransactions,
} from "@/lib/firebase/billing";
import type { Credits, CreditTransaction, Subscription } from "@/types/billing";
import { createCheckout, cancelSubscription, resumeSubscription } from "@/lib/api/billingApi";

const CREDIT_PACKAGES = [
  { id: "credits_200" as const, label: "Starter", credits: 200, price: "$10" },
  { id: "credits_500" as const, label: "Standard", credits: 500, price: "$22" },
  { id: "credits_1000" as const, label: "Pro Pack", credits: 1000, price: "$40" },
];

const TX_TYPE_LABEL: Record<string, string> = {
  subscription_grant: "구독 크레딧 지급",
  purchase: "크레딧 충전",
  usage: "사용",
  refund: "환불",
};

function formatDate(iso: string) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function PlanBadge({ plan, status }: { plan: string; status: string }) {
  const isActive = status === "active";
  const label = plan === "monthly" ? "Pro 월간" : plan === "annual" ? "Pro 연간" : "Free";
  const color = isActive && plan !== "none"
    ? "bg-blue-100 text-blue-700"
    : "bg-zinc-100 text-zinc-500";
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {label}
    </span>
  );
}

export default function BillingPage() {
  const { user } = useAuth();
  const paddleRef = useRef<Paddle | null>(null);

  const [credits, setCredits] = useState<Credits | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);

  const [buyingPackage, setBuyingPackage] = useState<string | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [resumeLoading, setResumeLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const unsubs = [
      listenToCredits(user.uid, setCredits),
      listenToSubscription(user.uid, setSubscription),
      listenToTransactions(user.uid, 20, setTransactions),
    ];

    initializePaddle({
      environment:
        (process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT as "sandbox" | "production") ?? "sandbox",
      token: process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN ?? "",
    }).then((p) => {
      if (p) paddleRef.current = p;
    });

    return () => unsubs.forEach((u) => u());
  }, [user]);

  async function handleBuyCredits(pkg: typeof CREDIT_PACKAGES[number]) {
    if (!user || buyingPackage) return;
    setBuyingPackage(pkg.id);
    setActionError(null);
    try {
      const { transactionId } = await createCheckout({
        productType: "credits",
        creditsProduct: pkg.id,
      });
      paddleRef.current?.Checkout.open({
        transactionId,
        settings: { successUrl: `${window.location.origin}/billing/success` },
      });
    } catch {
      setActionError("결제 세션 생성에 실패했습니다.");
    } finally {
      setBuyingPackage(null);
    }
  }

  async function handleCancel() {
    if (!confirm("구독을 취소하시겠습니까? 현재 청구 기간이 끝날 때까지는 계속 이용할 수 있습니다.")) return;
    setCancelLoading(true);
    setActionError(null);
    try {
      await cancelSubscription();
    } catch {
      setActionError("구독 취소에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setCancelLoading(false);
    }
  }

  async function handleResume() {
    setResumeLoading(true);
    setActionError(null);
    try {
      await resumeSubscription();
    } catch {
      setActionError("구독 재개에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setResumeLoading(false);
    }
  }

  const hasSub = subscription && subscription.plan !== "none" && subscription.status === "active";
  const isScheduledCancel = hasSub && subscription.cancelAtPeriodEnd;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6 overflow-y-auto h-full">
      <h1 className="text-xl font-semibold text-zinc-900">결제 및 크레딧</h1>

      {actionError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {actionError}
        </div>
      )}

      {/* 구독 카드 */}
      <div className="bg-white border border-zinc-200 rounded-xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-zinc-400 font-medium uppercase tracking-wide mb-1">현재 플랜</p>
            <div className="flex items-center gap-2 mb-1">
              <PlanBadge
                plan={subscription?.plan ?? "none"}
                status={subscription?.status ?? ""}
              />
              {isScheduledCancel && (
                <span className="text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
                  기간 만료 후 해지 예정
                </span>
              )}
            </div>
            {hasSub && subscription.currentPeriodEnd && (
              <p className="text-sm text-zinc-500 mt-1">
                다음 갱신일: {formatDate(subscription.currentPeriodEnd)}
              </p>
            )}
          </div>

          <div className="flex gap-2 shrink-0">
            {!hasSub && (
              <Link
                href="/billing/plans"
                className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                업그레이드
              </Link>
            )}
            {hasSub && isScheduledCancel && (
              <button
                type="button"
                onClick={handleResume}
                disabled={resumeLoading}
                className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {resumeLoading ? "처리 중..." : "구독 유지"}
              </button>
            )}
            {hasSub && !isScheduledCancel && (
              <button
                type="button"
                onClick={handleCancel}
                disabled={cancelLoading}
                className="px-3 py-1.5 text-sm font-medium text-zinc-500 border border-zinc-200 rounded-lg hover:bg-zinc-50 disabled:opacity-50 transition-colors"
              >
                {cancelLoading ? "처리 중..." : "구독 취소"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 크레딧 현황 */}
      <div className="bg-white border border-zinc-200 rounded-xl p-5">
        <p className="text-xs text-zinc-400 font-medium uppercase tracking-wide mb-4">크레딧 현황</p>
        <div className="grid grid-cols-3 gap-4 mb-5">
          <div className="text-center">
            <p className="text-2xl font-bold text-zinc-900">
              {(credits?.subscriptionCredits ?? 0).toLocaleString()}
            </p>
            <p className="text-xs text-zinc-400 mt-0.5">구독 크레딧</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-zinc-900">
              {(credits?.purchasedCredits ?? 0).toLocaleString()}
            </p>
            <p className="text-xs text-zinc-400 mt-0.5">충전 크레딧</p>
          </div>
          <div className="text-center border-l border-zinc-100">
            <p className="text-2xl font-bold text-blue-600">
              {(credits?.totalCredits ?? 0).toLocaleString()}
            </p>
            <p className="text-xs text-zinc-400 mt-0.5">총 잔액</p>
          </div>
        </div>

        <p className="text-xs text-zinc-400 font-medium mb-2">크레딧 충전</p>
        <div className="flex gap-2 flex-wrap">
          {CREDIT_PACKAGES.map((pkg) => (
            <button
              key={pkg.id}
              type="button"
              onClick={() => handleBuyCredits(pkg)}
              disabled={buyingPackage !== null}
              className="flex items-center gap-2 px-3 py-2 border border-zinc-200 rounded-lg text-sm hover:bg-zinc-50 disabled:opacity-50 transition-colors"
            >
              <span className="font-medium text-zinc-900">{pkg.credits.toLocaleString()} 크레딧</span>
              <span className="text-zinc-400">{pkg.price}</span>
              {buyingPackage === pkg.id && <span className="text-xs text-zinc-400">처리 중...</span>}
            </button>
          ))}
        </div>
      </div>

      {/* 거래 내역 */}
      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-100">
          <p className="text-sm font-medium text-zinc-900">크레딧 사용 내역</p>
        </div>
        {transactions.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-zinc-400">내역이 없습니다.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-zinc-50 text-xs text-zinc-400 uppercase tracking-wide">
                  <th className="px-5 py-2.5 text-left font-medium">날짜</th>
                  <th className="px-5 py-2.5 text-left font-medium">내용</th>
                  <th className="px-5 py-2.5 text-right font-medium">크레딧</th>
                  <th className="px-5 py-2.5 text-right font-medium">잔액</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {transactions.map((tx) => (
                  <tr key={tx.txId} className="hover:bg-zinc-50">
                    <td className="px-5 py-3 text-zinc-400 whitespace-nowrap">
                      {formatDate(tx.createdAt)}
                    </td>
                    <td className="px-5 py-3 text-zinc-700">
                      <span className="text-xs text-zinc-400 mr-1.5">
                        {TX_TYPE_LABEL[tx.type] ?? tx.type}
                      </span>
                      {tx.description}
                    </td>
                    <td className={`px-5 py-3 text-right font-medium whitespace-nowrap ${tx.amount >= 0 ? "text-green-600" : "text-red-500"}`}>
                      {tx.amount >= 0 ? "+" : ""}{tx.amount.toLocaleString()}
                    </td>
                    <td className="px-5 py-3 text-right text-zinc-500 whitespace-nowrap">
                      {tx.balanceAfter.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
