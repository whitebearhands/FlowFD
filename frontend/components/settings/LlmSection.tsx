"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { fetchSettings, updateLlmSettings } from "@/lib/api/settingsApi";
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

type DefaultModels = {
  cpsGeneration: string;
  prdGeneration: string;
  codeGeneration: string;
};

const ALL_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-1.5-pro",
  "gemini-1.5-flash",
  "claude-opus-4-5",
  "claude-sonnet-4-5",
  "claude-haiku-4-5",
  "gpt-4o",
  "gpt-4o-mini",
];

const DEFAULT_MODELS: DefaultModels = {
  cpsGeneration: "gemini-2.5-flash",
  prdGeneration: "gemini-2.5-flash",
  codeGeneration: "gemini-2.5-flash",
};

export default function LlmSection() {
  const t = useTranslations("settings.llm");

  const [defaultModels, setDefaultModels] = useState<DefaultModels>(DEFAULT_MODELS);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchSettings()
      .then((s) => {
        if (s.llm?.defaultModels) {
          setDefaultModels(s.llm.defaultModels);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  async function handleSave() {
    setIsSaving(true);
    try {
      await updateLlmSettings({
        apiKeys: { gemini: null, claude: null, openai: null },
        defaultModels,
      });
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

      {/* 기능별 기본 모델 카드 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">{t("defaultModels")}</CardTitle>
          <p className="text-xs text-zinc-500 mt-0.5">{t("defaultModelsDesc")}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {(
            [
              { field: "cpsGeneration", label: t("cpsGeneration") },
              { field: "prdGeneration", label: t("prdGeneration") },
              { field: "codeGeneration", label: t("codeGeneration") },
            ] as const
          ).map(({ field, label }) => (
            <div key={field} className="flex items-center justify-between gap-4">
              <Label className="text-sm text-zinc-700 shrink-0">{label}</Label>
              <Select
                value={defaultModels[field]}
                onValueChange={(v) =>
                  setDefaultModels((prev) => ({ ...prev, [field]: v }))
                }
              >
                <SelectTrigger className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALL_MODELS.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}

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
