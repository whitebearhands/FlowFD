"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { LogOut } from "lucide-react";
import { signOutUser } from "@/lib/firebase/auth";
import { useAuth } from "@/lib/firebase/useAuth";
import { useAppData } from "@/lib/firebase/useAppData";

const PLAN_LABEL: Record<number, string> = { 0: "Free", 1: "Basic", 2: "Pro", 3: "Enterprise" };
const PLAN_COLOR: Record<number, string> = {
  0: "bg-zinc-100 text-zinc-500",
  1: "bg-blue-100 text-blue-700",
  2: "bg-violet-100 text-violet-700",
  3: "bg-amber-100 text-amber-700",
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("app.sidebar");
  const { user, groupId, isLoading } = useAuth();
  const { groupName, displayName, recentProjects, sampleProjects, credits, subscriptionPlan } = useAppData();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isLoading) return;
    if (!user) { router.replace("/"); return; }
    if (groupId === null) { router.replace("/register"); }
  }, [user, groupId, isLoading, router]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    }
    if (isUserMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isUserMenuOpen]);

  async function handleSignOut() {
    await signOutUser();
    router.replace("/");
  }

  if (isLoading || !user || groupId === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <div className="w-6 h-6 border-2 border-zinc-300 border-t-zinc-700 rounded-full animate-spin" />
      </div>
    );
  }

  const globalNav = [
    { href: "/dashboard", label: t("dashboard") },
  ];

  const avatarChar = ((displayName || user.email || "?").charAt(0)).toUpperCase();

  return (
    <div className="flex h-screen bg-zinc-50 overflow-hidden">
      {/* 사이드바 — 화면 높이 고정 */}
      <aside className="w-52 shrink-0 border-r bg-white flex flex-col h-screen">
        {/* 로고 */}
        <div className="px-3 py-3 border-b">
          <Image
            src="/ffd-transparent.png"
            alt="FlowFD"
            width={170}
            height={40}
            className="object-contain"
            priority
          />
         
        </div>

        
        {/* 글로벌 네비 */}
        <nav className="px-2 pt-3 pb-1">
          {globalNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                pathname === item.href
                  ? "bg-zinc-100 text-zinc-900"
                  : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800"
              }`}
            >
              {item.label}[{groupName}]
            </Link>
          ))}
        </nav>

        {/* 샘플 프로젝트 */}
        <div className="px-2 pt-4 pb-1">
          {sampleProjects.length > 0 && (
            <>
              <p className="px-3 text-xs font-medium text-zinc-400 mb-1 uppercase tracking-wider">{t("samples")}</p>
              {sampleProjects.map((p) => (
                <Link
                  key={p.projectId}
                  href={`/projects/${p.projectId}`}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${
                    pathname.startsWith(`/projects/${p.projectId}`)
                      ? "bg-zinc-100 text-zinc-900"
                      : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-800"
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  <span className="truncate">{p.name}</span>
                </Link>
              ))}
            </>
          )}
        </div>

        {/* 최근 프로젝트 */}
        <div className="px-2 pt-2 pb-1 flex-1 overflow-y-auto min-h-0">
          {recentProjects.length > 0 && (
            <>
              <p className="px-3 text-xs font-medium text-zinc-400 mb-1 uppercase tracking-wider">{t("recentProjects")}</p>
              {recentProjects.map((p) => (
                <Link
                  key={p.projectId}
                  href={`/projects/${p.projectId}`}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${
                    pathname.startsWith(`/projects/${p.projectId}`)
                      ? "bg-zinc-100 text-zinc-900"
                      : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-800"
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                  <span className="truncate">{p.name}</span>
                </Link>
              ))}
            </>
          )}
        </div>
      </aside>

      {/* 메인 영역 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 상단 바 */}
        <header className="h-11 shrink-0 border-b bg-white flex items-center justify-between px-4 gap-3">
          {/* 데모 배너 */}
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
            <span className="text-xs font-medium text-amber-700">🚧 This is a demo in active development — official launch coming soon!</span>
          </div>

          <div className="flex items-center gap-3 ml-auto">
          {/* 크레딧 */}
          <div className="flex items-center gap-1 text-xs text-zinc-600">
            <span className="text-amber-500">●</span>
            <span className="font-medium">{credits.toLocaleString()}</span>
            <span className="text-zinc-400">credits</span>
          </div>

          {/* 플랜 배지 + 결제 버튼 */}
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${PLAN_COLOR[subscriptionPlan] ?? PLAN_COLOR[0]}`}>
            {PLAN_LABEL[subscriptionPlan] ?? "Free"}
          </span>
          {/*
          <Link
            href="/billing"
            className={`text-xs px-2 py-1 rounded-md transition-colors ${
              pathname.startsWith("/billing")
                ? "text-zinc-900 bg-zinc-100"
                : "text-zinc-500 hover:text-zinc-800 hover:bg-zinc-50"
            }`}
          >
            {t("billing")}
          </Link>
          */}
          <div className="w-px h-4 bg-zinc-200" />

          {/* 설정 */}
          <Link
            href="/settings"
            className={`text-sm px-2 py-1 rounded-md transition-colors ${
              pathname.startsWith("/settings")
                ? "text-zinc-900 bg-zinc-100"
                : "text-zinc-500 hover:text-zinc-800 hover:bg-zinc-50"
            }`}
          >
            {t("settings")}
          </Link>

          {/* 유저 */}
          <div className="relative" ref={userMenuRef}>
            <button
              type="button"
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className={`flex items-center gap-2 px-2 py-1 rounded-md text-sm text-zinc-600 transition-colors ${
                isUserMenuOpen ? "bg-zinc-100 text-zinc-900" : "hover:bg-zinc-50 hover:text-zinc-900"
              }`}
            >
              <span className="w-6 h-6 rounded-full bg-zinc-200 flex items-center justify-center text-xs font-semibold text-zinc-600 shrink-0">
                {avatarChar}
              </span>
              <span className="max-w-[120px] truncate">{displayName ?? user.email}</span>
            </button>

            {isUserMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white border rounded-lg shadow-lg py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-4 py-2 border-b">
                  <p className="text-xs font-medium text-zinc-500 truncate">{displayName ?? user.email}</p>
                </div>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors text-left"
                >
                  <LogOut className="w-4 h-4" />
                  <span>{t("signOut")}</span>
                </button>
              </div>
            )}
          </div>
          </div>
        </header>

        {/* 콘텐츠 */}
        <main className="flex-1 overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
