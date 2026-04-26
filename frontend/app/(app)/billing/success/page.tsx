"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function BillingSuccessPage() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => router.push("/billing"), 5000);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="min-h-full flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-2xl font-semibold text-zinc-900 mb-2">결제가 완료됐습니다</h1>
        <p className="text-zinc-500 mb-6">크레딧이 곧 계정에 반영됩니다. 5초 후 자동으로 이동합니다.</p>
        <Link
          href="/billing"
          className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white text-sm font-medium rounded-lg hover:bg-zinc-700 transition-colors"
        >
          결제 내역 보기
        </Link>
      </div>
    </div>
  );
}
