"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import ProfileSection from "@/components/settings/ProfileSection";
import TeamSection from "@/components/settings/TeamSection";
import LlmSection from "@/components/settings/LlmSection";
import GithubSection from "@/components/settings/GithubSection";
import DisplaySection from "@/components/settings/DisplaySection";
import AutomationSection from "@/components/settings/AutomationSection";

type Section = "profile" | "team" | "llm" | "github" | "automation" | "display";

export default function SettingsPage() {
  const t = useTranslations("settings");
  const [section, setSection] = useState<Section>("profile");

  const navGroups = [
    {
      label: t("nav.account"),
      items: [
        { id: "profile" as Section, label: t("nav.profile") },
        { id: "team" as Section, label: t("nav.team") },
      ],
    },
    {
      label: t("nav.integrations"),
      items: [        
        { id: "github" as Section, label: t("nav.github") },
      ],
    },
    {
      label: t("nav.automation"),
      items: [
        { id: "automation" as Section, label: t("nav.pipeline") },
      ],
    },
    {
      label: t("nav.preferences"),
      items: [
        { id: "display" as Section, label: t("nav.display") },
      ],
    },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Topbar */}
      <div className="bg-white border-b shrink-0 px-6 py-3">
        <h1 className="text-sm font-semibold text-zinc-900">{t("pageTitle")}</h1>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* 좌: 설정 네비 */}
        <nav className="w-44 border-r bg-white shrink-0 overflow-y-auto py-4 px-2">
          {navGroups.map((group) => (
            <div key={group.label} className="mb-4">
              <p className="px-3 text-xs font-medium text-zinc-400 mb-1">{group.label}</p>
              {group.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSection(item.id)}
                  className={`w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors ${
                    section === item.id
                      ? "bg-zinc-100 text-zinc-900 font-medium"
                      : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-800"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </nav>

        {/* 우: 설정 콘텐츠 */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl px-8 py-8">
            {section === "profile"    && <ProfileSection />}
            {section === "team"       && <TeamSection />}            
            {section === "github"     && <GithubSection />}
            {section === "automation" && <AutomationSection />}
            {section === "display"    && <DisplaySection />}
          </div>
        </div>
      </div>
    </div>
  );
}
