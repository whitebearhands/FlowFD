"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { initializePaddle, type Paddle } from "@paddle/paddle-js";
import { useAuth } from "@/lib/firebase/useAuth";
import { createCheckout } from "@/lib/api/billingApi";

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    period: "",
    credits: "100 크레딧 (가입 시 1회)",
    features: ["프로젝트 무제한", "GitHub 연동"],
    highlight: false,
    cta: "현재 플랜",
    disabled: true,
  },
  {
    id: "monthly",
    name: "Pro 월간",
    price: "$29",
    period: "/ 월",
    credits: "1,000 크레딧 / 월",
    features: ["미사용 크레딧 최대 2,000까지 이월", "프로젝트 무제한", "GitHub 연동"],
    highlight: false,
    cta: "월간 구독 시작",
    disabled: false,
  },
  {
    id: "annual",
    name: "Pro 연간",
    price: "$290",
    period: "/ 년",
    credits: "12,000 크레딧 / 년",
    features: ["월간 대비 17% 절약 (월 $24.2)", "미사용 크레딧 최대 2,000까지 이월", "프로젝트 무제한", "GitHub 연동"],
    highlight: true,
    cta: "연간 구독 시작",
    disabled: false,
  },
] as const;

type PlanId = "monthly" | "annual";

export default function PlansPage() {
  const { user } = useAuth();
  const router = useRouter();
  const paddleRef = useRef<Paddle | null>(null);
  const [loading, setLoading] = useState<PlanId | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    initializePaddle({
      environment:
        (process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT as "sandbox" | "production") ?? "sandbox",
      token: process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN ?? "",
    }).then((p) => {
      if (p) paddleRef.current = p;
    });
  }, [user]);

  async function handleSubscribe(plan: PlanId) {
    if (!user || loading) return;
    setLoading(plan);
    setError(null);
    try {
      const { transactionId } = await createCheckout({
        productType: "subscription",
        plan,
      });
      paddleRef.current?.Checkout.open({
        transactionId,
        settings: {
          successUrl: `${window.location.origin}/billing/success`,
        },
      });
    } catch {
      setError("결제 세션 생성에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <button
        type="button"
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800 mb-6"
      >
        ← 뒤로
      </button>

      <h1 className="text-2xl font-semibold text-zinc-900 mb-1">구독 플랜</h1>
      <p className="text-zinc-500 text-sm mb-8">언제든 플랜을 변경하거나 해지할 수 있습니다.</p>

      {error && (
        <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            className={`relative rounded-xl border p-5 flex flex-col gap-4 ${
              plan.highlight
                ? "border-blue-500 shadow-md"
                : "border-zinc-200"
            }`}
          >
            {plan.highlight && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-blue-600 text-white text-xs font-medium rounded-full whitespace-nowrap">
                추천 · 17% 할인
              </span>
            )}

            <div>
              <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-1">{plan.name}</p>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold text-zinc-900">{plan.price}</span>
                <span className="text-zinc-400 text-sm">{plan.period}</span>
              </div>
              <p className="text-sm text-zinc-500 mt-1">{plan.credits}</p>
            </div>

            <ul className="space-y-1.5 flex-1">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-zinc-600">
                  <svg className="w-4 h-4 text-green-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>

            <button
              type="button"
              disabled={plan.disabled || loading !== null}
              onClick={() => !plan.disabled && handleSubscribe(plan.id as PlanId)}
              className={`w-full py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                plan.disabled
                  ? "bg-zinc-100 text-zinc-400 cursor-default"
                  : plan.highlight
                  ? "bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                  : "bg-zinc-900 text-white hover:bg-zinc-700 disabled:opacity-50"
              }`}
            >
              {loading === plan.id ? "처리 중..." : plan.cta}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
