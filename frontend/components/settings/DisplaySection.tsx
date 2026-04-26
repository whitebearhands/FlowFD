"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateDisplaySettings } from "@/lib/api/settingsApi";
import apiClient from "@/lib/api/client";

const TIMEZONES = [
  "Asia/Seoul",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "America/New_York",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "UTC",
];

const DATE_FORMATS = [
  "YYYY.MM.DD",
  "YYYY-MM-DD",
  "MM/DD/YYYY",
  "DD/MM/YYYY",
];

type DisplaySettings = {
  language: "ko" | "en";
  timezone: string;
  dateFormat: string;  
};

const DEFAULT: DisplaySettings = {
  language: "ko",
  timezone: "Asia/Seoul",
  dateFormat: "YYYY.MM.DD",
};

export default function DisplaySection() {
  const t = useTranslations("settings.display");
  const router = useRouter();
  const [settings, setSettings] = useState<DisplaySettings>(DEFAULT);
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get<{ display: DisplaySettings }>("/settings")
      .then((res) => setSettings({ ...DEFAULT, ...res.data.display }))
      .catch(() => {})
      .finally(() => setIsLoading(false));

      console.debug("Fetched display settings:", settings);
  }, []);

  async function handleSave() {    
    setIsSaving(true);
    try {
          await updateDisplaySettings(settings);
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
        } finally {
          setIsSaving(false);
        }
      document.cookie = `locale=${settings.language}; path=/; max-age=31536000; SameSite=Lax`;
      router.refresh();
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

      {/* 언어 카드 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">{t("language")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {(["ko", "en"] as const).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => setSettings((s) => ({ ...s, language: lang }))}
                className={`flex items-center gap-3 rounded-lg border p-4 text-left transition-colors ${
                  settings.language === lang
                    ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500"
                    : "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50"
                }`}
              >
                <span className="text-2xl">{lang === "ko" ? "🇰🇷" : "🇺🇸"}</span>
                <div>
                  <p className="text-sm font-medium text-zinc-900">
                    {lang === "ko" ? "한국어" : "English"}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {lang === "ko" ? "Korean" : "영어"}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 시간대 · 날짜 형식 카드 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">{t("datetimeSettings")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <Label className="text-sm text-zinc-700 shrink-0">{t("timezone")}</Label>
            <Select value={settings.timezone} onValueChange={(value) => setSettings((s) => ({ ...s, timezone: value }))}>
              <SelectTrigger className="w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label className="text-sm text-zinc-700 shrink-0">{t("dateFormat")}</Label>
            <Select value={settings.dateFormat} onValueChange={(value) => setSettings((s) => ({ ...s, dateFormat: value }))}>
              <SelectTrigger className="w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATE_FORMATS.map((fmt) => (
                  <SelectItem key={fmt} value={fmt}>{fmt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end pt-2">
            <Button size="sm" onClick={handleSave} disabled={isSaving}>
            {saved ? t("saved") : isSaving ? t("saving") : t("save")}
          </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
