"use client";

import { useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface LegalContent {
  ko: string;
  en: string;
}

interface LegalLink {
  href: string;
  ko: string;
  en: string;
}

const legalLinks: LegalLink[] = [
  { href: "/terms", ko: "이용약관", en: "Terms of Service" },
  { href: "/privacy", ko: "개인정보처리방침", en: "Privacy Policy" },
  { href: "/refund", ko: "환불정책", en: "Refund Policy" },
];

interface Props {
  content: LegalContent;
  lastUpdated?: string;
  currentHref: string;
}

export default function LegalPageLayout({
  content,
  lastUpdated = "April 2026",
  currentHref,
}: Props) {
  const [lang, setLang] = useState<"ko" | "en">("en");

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-gray-100 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="text-lg font-semibold tracking-tight text-gray-900 hover:opacity-70 transition-opacity"
          >
            FlowFD
          </Link>
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
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="mb-8 text-sm text-gray-400">
          {lang === "ko" ? "최종 수정:" : "Last Updated:"} {lastUpdated}
        </p>
        <div className="prose prose-gray max-w-none prose-headings:font-semibold prose-h1:text-2xl prose-h2:text-lg prose-h2:mt-8 prose-h3:text-base prose-a:text-blue-600 prose-strong:text-gray-900">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {content[lang]}
          </ReactMarkdown>
        </div>
      </main>

      {/* Footer nav */}
      <footer className="border-t border-gray-100 py-8">
        <div className="mx-auto max-w-3xl px-6">
          <nav className="flex flex-wrap gap-x-6 gap-y-2">
            {legalLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm transition-colors ${
                  currentHref === link.href
                    ? "text-gray-900 font-medium"
                    : "text-gray-400 hover:text-gray-700"
                }`}
              >
                {lang === "ko" ? link.ko : link.en}
              </Link>
            ))}
            <Link
              href="/"
              className="text-sm text-gray-400 hover:text-gray-700 transition-colors"
            >
              {lang === "ko" ? "홈으로" : "Home"}
            </Link>
          </nav>
          <p className="mt-4 text-xs text-gray-300">
            © 2026 FlowFD Inc. · wb.hands.dev@gmail.com
          </p>
        </div>
      </footer>
    </div>
  );
}
