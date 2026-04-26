"use client";

import { useLocale } from "next-intl";
import { useRouter, usePathname } from "next/navigation";

export default function LangToggle() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const switchLocale = (next: string) => {
    const segments = pathname.split("/");
    segments[1] = next;
    router.push(segments.join("/"));
  };

  return (
    <div className="flex rounded-md overflow-hidden border border-white/[0.14]">
      <button
        onClick={() => switchLocale("ko")}
        className={`px-3 py-1.5 text-[12px] transition-colors ${
          locale === "ko"
            ? "bg-white/10 text-white"
            : "text-white/40 hover:text-white/70"
        }`}
      >
        한국어
      </button>
      <button
        onClick={() => switchLocale("en")}
        className={`px-3 py-1.5 text-[12px] transition-colors ${
          locale === "en"
            ? "bg-white/10 text-white"
            : "text-white/40 hover:text-white/70"
        }`}
      >
        English
      </button>
    </div>
  );
}