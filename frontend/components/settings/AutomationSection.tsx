"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import apiClient from "@/lib/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";

type AutomationSettings = {
  defaultAnalysisMode : "smart" | "full";
  autoAnalyze: boolean;
  autoAnalyzeCps: boolean;
  autoAnalyzePrd: boolean;
};

const DEFAULT: AutomationSettings = {
  defaultAnalysisMode: "smart",
  autoAnalyze: false,
  autoAnalyzeCps: false,
  autoAnalyzePrd: false,
};

export default function AutomationSection() {
  const t = useTranslations("settings.automation");
  const [settings, setSettings] = useState<AutomationSettings>(DEFAULT);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get<{ automation: AutomationSettings }>("/settings")
      .then((res) => setSettings({ ...DEFAULT, ...res.data.automation }))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  async function handleSave() {
    setIsSaving(true);
    try {
      await apiClient.patch("/settings/automation", settings);
      console.log(settings)
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return <div className="h-32 flex items-center justify-center text-sm text-zinc-400">{t("loading")}</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-zinc-900">{t("title")}</h2>
        <p className="text-sm text-zinc-500 mt-0.5">{t("subtitle")}</p>
      </div>

      {/* 카드 1. 미팅 분석 기본값 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">{t("analysisMode.title")}</CardTitle>
          <p className="text-xs text-zinc-500 mt-0.5">{t("analysisMode.desc")}</p>
        </CardHeader>
        <CardContent className="space-y-2">
          {(["smart", "full"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setSettings((s) => ({ ...s, defaultAnalysisMode: mode }))}
              className={`w-full text-left rounded-lg border px-4 py-3 transition-colors ${
                settings.defaultAnalysisMode === mode
                  ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500"
                  : "border-zinc-200 hover:border-zinc-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-zinc-900">{t(`analysisMode.${mode}.label`)}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{t(`analysisMode.${mode}.desc`)}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  mode === "smart" ? "bg-zinc-100 text-zinc-600" : "bg-orange-100 text-orange-700"
                }`}>
                  {mode === "smart" ? "5코인" : "8코인"}
                </span>
              </div>
            </button>
          ))}
        </CardContent>
      </Card>

      {/* 카드 2. 미팅 저장 후 자동 분석 
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">{t("autoAnalyze.title")}</CardTitle>
          <p className="text-xs text-zinc-500 mt-0.5">{t("autoAnalyze.desc")}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-zinc-900">{t("autoAnalyze.toggle")}</p>
            <Switch
              checked={settings.autoAnalyze}
              onCheckedChange={(v) =>
                setSettings((s) => ({ ...s, autoAnalyze: v }))
              }
            />
          </div>

          {settings.autoAnalyze && (
            <div className="space-y-3 pl-1 border-l-2 border-zinc-100 ml-1">
              <label className="flex items-center gap-3 cursor-pointer">
                <Checkbox
                  checked={settings.autoAnalyzeCps}
                  onCheckedChange={(v: boolean) =>
                    setSettings((s) => ({ ...s, autoAnalyzeCps: v }))
                  }
                />
                <span className="text-sm text-zinc-700">{t("autoAnalyze.cps")}</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <Checkbox
                  checked={settings.autoAnalyzePrd}
                  onCheckedChange={(v: boolean) =>
                    setSettings((s) => ({ ...s, autoAnalyzePrd: v }))
                  }
                />
                <span className="text-sm text-zinc-700">{t("autoAnalyze.prd")}</span>
              </label>
            </div>
          )}
        </CardContent>
      </Card>
      */}
      {/* 저장 버튼 */}
      <div className="flex justify-end">
        <Button size="sm" onClick={handleSave} disabled={isSaving}>
          {saved ? t("saved") : isSaving ? t("saving") : t("save")}
        </Button>
      </div>
    </div>
  );
}
