"use client";

import { useState } from "react";
import Link from "next/link";

type Lang = "ko" | "en";

const t = {
  ko: {
    nav: "홈으로",
    langKo: "한국어",
    langEn: "English",
    hero: "미팅에서 코드까지, 하나의 요금제로",
    heroSub: "팀의 규모에 맞게 선택하세요. 언제든 플랜을 변경할 수 있습니다.",
    free: "Free",
    freeDesc: "가입 시 자동",
    proMonthly: "Pro 월간",
    proAnnual: "Pro 연간",
    recommended: "추천",
    save: "17% 할인",
    topup: "크레딧 충전",
    topupDesc: "구독 외 추가 구매 가능",
    credits: "크레딧",
    price: "가격",
    savings: "할인",
    action: "작업별 크레딧 소모",
    actionCol: "작업",
    creditsCol: "크레딧",
    faq: "FAQ",
    footer: "지금 바로 시작하세요",
    footerBtn: "무료로 시작하기",
    legalLinks: ["이용약관", "개인정보처리방침", "환불정책"],
    freeItems: ["100 크레딧 (체험용)" , "프로젝트 무제한",
      "GitHub 연동",],
    proMonthlyPrice: "$29/월",
    proMonthlyItems: [
      "매월 1,000 크레딧 지급",
      "미사용 크레딧 최대 2,000까지 이월",
      "프로젝트 무제한",
      "GitHub 연동",      
    ],
    proAnnualPrice: "$290/년",
    proAnnualSub: "월 $24.2 (월간 대비 17% 절약)",
    proAnnualItems: ["12,000 크레딧/년 (월 1,000)", "Pro 월간 전체 기능 포함"],
    packages: [
      { name: "Starter", credits: "200", price: "$10", savings: "—" },
      { name: "Standard", credits: "500", price: "$22", savings: "12%" },
      { name: "Pro Pack", credits: "1,000", price: "$40", savings: "20%" },
    ],
    actions: [
      { name: "미팅 추가 + CPS 스마트 분석", credits: "5" },
      { name: "미팅 추가 + CPS 전체 재분석", credits: "8" },
      { name: "PRD 생성", credits: "10" },
      { name: "설계 문서 생성", credits: "15" },
      { name: "전체 파이프라인", credits: "30" },
    ],
    faqs: [
      {
        q: "크레딧이 만료되나요?",
        a: "충전 크레딧은 만료 없음. 구독 크레딧은 구독 해지 후 30일 뒤 만료.",
      },
      {
        q: "구독과 크레딧 충전을 같이 쓸 수 있나요?",
        a: "네. 구독 크레딧 소진 후 자동으로 충전 크레딧에서 차감됩니다.",
      },
      {
        q: "팀원이 쓴 크레딧은 어떻게 되나요?",
        a: "그룹 단위로 크레딧을 공유합니다. 팀원의 사용량이 공동 잔액에서 차감됩니다.",
      },
      {
        q: "언제든 해지할 수 있나요?",
        a: "네. 해지해도 남은 구독 기간까지 서비스 이용 가능합니다.",
      },
      {
        q: "연간 구독 환불이 가능한가요?",
        a: "14일 이내 크레딧 100 미만 사용 시 전액 환불, 이후에는 잔여 기간 비례 환불됩니다.",
      },
    ],
  },
  en: {
    nav: "Home",
    langKo: "한국어",
    langEn: "English",
    hero: "From meeting to code, one simple plan.",
    heroSub: "Choose the plan that fits your team. Change or cancel anytime.",
    free: "Free",
    freeDesc: "automatically granted on sign-up",
    proMonthly: "Pro Monthly",
    proAnnual: "Pro Annual",
    recommended: "Recommended",
    save: "Save 17%",
    topup: "Credit Top-ups",
    topupDesc: "available anytime, separate from subscription",
    credits: "Credits",
    price: "Price",
    savings: "Savings",
    action: "Credits per action",
    actionCol: "Action",
    creditsCol: "Credits",
    faq: "FAQ",
    footer: "Start building today",
    footerBtn: "Get started for free",
    legalLinks: ["Terms of Service", "Privacy Policy", "Refund Policy"],
    freeItems: ["100 credits (trial)",  "Unlimited projects",
      "GitHub integration",      ],
    proMonthlyPrice: "$29/month",
    proMonthlyItems: [
      "1,000 credits per month",
      "Unused credits roll over (up to 2,000 max)",
      "Unlimited projects",
      "GitHub integration",      
    ],
    proAnnualPrice: "$290/year",
    proAnnualSub: "$24.2/month (save 17% vs monthly)",
    proAnnualItems: [
      "12,000 credits/year (1,000/month)",
      "All Pro Monthly features included",
    ],
    packages: [
      { name: "Starter", credits: "200", price: "$10", savings: "—" },
      { name: "Standard", credits: "500", price: "$22", savings: "12%" },
      { name: "Pro Pack", credits: "1,000", price: "$40", savings: "20%" },
    ],
    actions: [
      { name: "Add meeting + CPS smart analysis", credits: "5" },
      { name: "Add meeting + CPS full reanalysis", credits: "8" },
      { name: "Generate PRD", credits: "10" },
      { name: "Generate design document", credits: "15" },
      { name: "Full pipeline (all at once)", credits: "30" },
    ],
    faqs: [
      {
        q: "Do credits expire?",
        a: "Purchased credits never expire. Subscription credits expire 30 days after cancellation.",
      },
      {
        q: "Can I use both subscription and purchased credits?",
        a: "Yes. Subscription credits are used first. When they run out, purchased credits are used automatically.",
      },
      {
        q: "What happens when a team member uses credits?",
        a: "Credits are shared within your group. Usage by any team member is deducted from the shared balance.",
      },
      {
        q: "Can I cancel anytime?",
        a: "Yes. After canceling, service and credits remain available until the end of the billing period.",
      },
      {
        q: "Can I get a refund on an annual plan?",
        a: "Full refund within 14 days if fewer than 100 credits used. After that, prorated refund for unused months.",
      },
    ],
  },
};

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "";

export default function PricingPage() {
  const [lang, setLang] = useState<Lang>("ko");
  const tx = t[lang];

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-gray-100 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="text-lg font-semibold tracking-tight text-gray-900 hover:opacity-70 transition-opacity"
          >
            FlowFD
          </Link>
          <div className="flex items-center gap-4">
            <div className="flex rounded-md overflow-hidden border border-gray-200">
              <button
                onClick={() => setLang("ko")}
                className={`px-3 py-1.5 text-[12px] font-medium transition-colors ${
                  lang === "ko"
                    ? "bg-gray-900 text-white"
                    : "text-gray-500 hover:text-gray-900"
                }`}
              >
                한국어
              </button>
              <button
                onClick={() => setLang("en")}
                className={`px-3 py-1.5 text-[12px] font-medium transition-colors ${
                  lang === "en"
                    ? "bg-gray-900 text-white"
                    : "text-gray-500 hover:text-gray-900"
                }`}
              >
                English
              </button>
            </div>
            <Link
              href={APP_URL}
              className="rounded-md bg-[#185FA5] px-4 py-2 text-sm font-medium text-white hover:bg-[#1451894] transition-colors"
            >
              {tx.footerBtn}
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 py-16 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
          {tx.hero}
        </h1>
        <p className="mt-4 text-lg text-gray-500">{tx.heroSub}</p>
      </section>

      {/* Pricing Cards */}
      <section className="mx-auto max-w-5xl px-6 pb-16">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* Free */}
          <div className="flex flex-col rounded-xl border border-gray-200 p-6">
            <div className="mb-1 text-sm text-gray-400">{tx.freeDesc}</div>
            <div className="text-xl font-bold text-gray-900">{tx.free}</div>
            <div className="my-4 text-3xl font-bold text-gray-900">$0</div>
            <ul className="flex-1 space-y-2 text-sm text-gray-600">
              {tx.freeItems.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-0.5 text-gray-400">✓</span>
                  {item}
                </li>
              ))}
            </ul>
            <Link
              href={APP_URL}
              className="mt-6 block rounded-md border border-gray-300 py-2 text-center text-sm font-medium text-gray-700 hover:border-gray-400 transition-colors"
            >
              {tx.footerBtn}
            </Link>
          </div>

          {/* Pro Monthly */}
          <div className="flex flex-col rounded-xl border border-gray-200 p-6">
            <div className="mb-1 text-sm text-gray-400">&nbsp;</div>
            <div className="text-xl font-bold text-gray-900">{tx.proMonthly}</div>
            <div className="my-4 text-3xl font-bold text-gray-900">
              {tx.proMonthlyPrice}
            </div>
            <ul className="flex-1 space-y-2 text-sm text-gray-600">
              {tx.proMonthlyItems.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-0.5 text-blue-500">✓</span>
                  {item}
                </li>
              ))}
            </ul>
            <Link
              href={APP_URL}
              className="mt-6 block rounded-md bg-[#185FA5] py-2 text-center text-sm font-medium text-white hover:bg-[#145189] transition-colors"
            >
              {tx.footerBtn}
            </Link>
          </div>

          {/* Pro Annual */}
          <div className="flex flex-col rounded-xl border-2 border-[#185FA5] p-6 relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="whitespace-nowrap rounded-full bg-[#185FA5] px-3 py-0.5 text-xs font-medium text-white">
                {tx.recommended} · {tx.save}
              </span>
            </div>
            <div className="mb-1 text-sm text-gray-400">&nbsp;</div>
            <div className="text-xl font-bold text-gray-900">{tx.proAnnual}</div>
            <div className="my-4 text-3xl font-bold text-gray-900">
              {tx.proAnnualPrice}
            </div>
            <p className="mb-3 text-sm text-gray-500">{tx.proAnnualSub}</p>
            <ul className="flex-1 space-y-2 text-sm text-gray-600">
              {tx.proAnnualItems.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-0.5 text-blue-500">✓</span>
                  {item}
                </li>
              ))}
            </ul>
            <Link
              href={APP_URL}
              className="mt-6 block rounded-md bg-[#185FA5] py-2 text-center text-sm font-medium text-white hover:bg-[#145189] transition-colors"
            >
              {tx.footerBtn}
            </Link>
          </div>
        </div>
      </section>

      {/* Credit Top-ups */}
      <section className="border-t border-gray-100 py-16">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-2xl font-bold text-gray-900">{tx.topup}</h2>
          <p className="mt-1 text-sm text-gray-500">{tx.topupDesc}</p>
          <div className="mt-6 overflow-hidden rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left text-gray-500">
                  <th className="px-4 py-3 font-medium">Package</th>
                  <th className="px-4 py-3 font-medium">{tx.credits}</th>
                  <th className="px-4 py-3 font-medium">{tx.price}</th>
                  <th className="px-4 py-3 font-medium">{tx.savings}</th>
                </tr>
              </thead>
              <tbody>
                {tx.packages.map((pkg, i) => (
                  <tr
                    key={pkg.name}
                    className={
                      i < tx.packages.length - 1
                        ? "border-b border-gray-100"
                        : ""
                    }
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {pkg.name}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{pkg.credits}</td>
                    <td className="px-4 py-3 text-gray-600">{pkg.price}</td>
                    <td className="px-4 py-3 text-gray-500">{pkg.savings}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>     

      {/* FAQ */}
      <section className="border-t border-gray-100 py-16">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="text-2xl font-bold text-gray-900">{tx.faq}</h2>
          <div className="mt-8 space-y-6">
            {tx.faqs.map((item) => (
              <div key={item.q}>
                <p className="font-medium text-gray-900">Q. {item.q}</p>
                <p className="mt-1 text-sm text-gray-600">A. {item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="bg-gray-50 py-16 text-center">
        <h2 className="text-2xl font-bold text-gray-900">{tx.footer}</h2>
        <Link
          href={APP_URL}
          className="mt-6 inline-block rounded-md bg-[#185FA5] px-8 py-3 text-sm font-medium text-white hover:bg-[#145189] transition-colors"
        >
          {tx.footerBtn}
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8">
        <div className="mx-auto max-w-5xl px-6">
          <nav className="flex flex-wrap gap-x-6 gap-y-2">
            {(
              [
                ["/terms", tx.legalLinks[0]],
                ["/privacy", tx.legalLinks[1]],
                ["/refund", tx.legalLinks[2]],
              ] as [string, string][]
            ).map(([href, label]) => (
              <Link
                key={href}
                href={href}
                className="text-sm text-gray-400 hover:text-gray-700 transition-colors"
              >
                {label}
              </Link>
            ))}
          </nav>
          <p className="mt-4 text-xs text-gray-300">
            © 2026 FlowFD. · wb.hands.dev@gmail.com
          </p>
        </div>
      </footer>
    </div>
  );
}
