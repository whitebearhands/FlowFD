"use client";

import { useEffect, useState, use, useCallback } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import CpsViewer from "@/components/cps/CpsViewer";
import { fetchCps, fetchCpsHistory, fetchCpsVersion } from "@/lib/api/cpsApi";
import { fetchPrd, generatePrd } from "@/lib/api/prdApi";
import { listenToLatestPrd, listenToActiveJob } from "@/lib/firebase/firestore";
import { useAuth } from "@/lib/firebase/useAuth";
import { CpsDocument, CpsVersion } from "@/types/cps";

type Props = {
  params: Promise<{ projectId: string }>;
};

const SECTIONS = [
  { key: "context",       label: "Context" },
  { key: "problem",       label: "Problem" },
  { key: "solution",      label: "Solution" },
  { key: "assumptions",   label: "Assumptions" },
  { key: "risks",         label: "Risks" },
  { key: "out-of-scope",  label: "Out of Scope" },
  { key: "pending",       label: "Pending" },
  { key: "decision-log",  label: "Decision Log" },
];

function scrollToSection(key: string) {
  const el = document.getElementById(`cps-section-${key}`);
  el?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function CpsPage({ params }: Props) {
  const { projectId } = use(params);
  const t = useTranslations("cps");
  const { groupId } = useAuth();

  const [cps, setCps] = useState<CpsDocument | null>(null);
  const [versions, setVersions] = useState<CpsVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<string>("");
  const [hasPrd, setHasPrd] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingPrd, setIsGeneratingPrd] = useState(false);
  const [isGeneratingCps, setIsGeneratingCps] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isSample = projectId.startsWith("sample-");

  const load = useCallback(() => {
    Promise.all([
      fetchCps(projectId),
      fetchCpsHistory(projectId),
      fetchPrd(projectId).then(() => true).catch(() => false),
    ])
      .then(([cpsData, historyData, prdExists]) => {
        setCps(cpsData);
        setVersions(historyData);
        setSelectedVersion(cpsData.meta.version);
        setHasPrd(prdExists);
      })
      .catch(() => setError(t("noData")))
      .finally(() => setIsLoading(false));
  }, [projectId, t]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!groupId) return;
    return listenToActiveJob(groupId, projectId, "cps_analysis", (isActive) => {
      setIsGeneratingCps(isActive);
      if (!isActive) load();
    });
  }, [groupId, projectId, load]);

  async function handleGeneratePrd() {
    if (!groupId) return;
    setIsGeneratingPrd(true);
    try {
      const before = hasPrd
        ? (await fetchPrd(projectId).catch(() => null))?.version ?? null
        : null;
      await generatePrd(projectId);
      const unsub = listenToLatestPrd(groupId, projectId, (version) => {
        if (version !== null && version !== before) {
          unsub();
          setHasPrd(true);
          setIsGeneratingPrd(false);
          load();
        }
      });
    } catch {
      setIsGeneratingPrd(false);
    }
  }

  async function handleVersionSelect(version: string) {
    if (version === selectedVersion) return;
    setSelectedVersion(version);
    const data = await fetchCpsVersion(projectId, version);
    setCps(data);
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-6 h-6 border-2 border-zinc-300 border-t-zinc-700 rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !cps) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-500 gap-3">
        <p>{error ?? t("noData")}</p>
        <p className="text-sm">{t("noDataHint")}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── 좌: CPS 네비 (180px) ── */}
      <aside className="w-[180px] shrink-0 border-r bg-white overflow-y-auto py-4 flex flex-col">
        {/* 섹션 빠른 이동 */}
        <div className="px-3 mb-4">
          <p className="text-xs font-medium text-zinc-400 px-2 mb-1">{t("nav.section")}</p>
          {SECTIONS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => scrollToSection(s.key)}
              className="w-full text-left px-2 py-1.5 text-xs text-zinc-600 hover:bg-zinc-100 rounded transition-colors"
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* 버전 선택 */}
        {versions.length > 1 && (
          <div className="px-3 border-t pt-3">
            <p className="text-xs font-medium text-zinc-400 px-2 mb-1">{t("nav.version")}</p>
            {versions.map((v) => (
              <button
                key={v.version}
                type="button"
                onClick={() => handleVersionSelect(v.version)}
                className={`w-full text-left px-2 py-1.5 text-xs rounded transition-colors ${
                  v.version === selectedVersion
                    ? "bg-zinc-900 text-white"
                    : "text-zinc-600 hover:bg-zinc-100"
                }`}
              >
                v{v.version}
              </button>
            ))}
          </div>
        )}
      </aside>

      {/* ── 중앙: CPS 섹션 카드들 ── */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {/* 상단 바: 버전 + 토픽바 버튼 */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded">
              v{cps.meta.version}
            </span>
            <span className="text-sm text-zinc-400">{cps.meta.client}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              cps.meta.changeType === "auto"
                ? "bg-green-100 text-green-700"
                : "bg-zinc-100 text-zinc-500"
            }`}>
              {cps.meta.changeType === "auto" ? t("history.auto") : t("history.manual")}
            </span>
          </div>
          <div className="flex gap-2">
            {hasPrd && (
              <Link href={`/projects/${projectId}/prd`}>
                <Button size="sm" variant="outline">{t("toolbar.viewPrd")}</Button>
              </Link>
            )}
            <Button
              size="sm"
              onClick={handleGeneratePrd}
              disabled={isGeneratingPrd || isGeneratingCps || isSample}
            >
              {isGeneratingPrd ? t("toolbar.generatingPrd") : isGeneratingCps ? t("toolbar.analyzingCps", { defaultMessage: "분석 중..." }) : hasPrd ? t("toolbar.regeneratePrd") : t("toolbar.createPrd")}
            </Button>
          </div>
        </div>

        <div className="w-full">
          <CpsViewer
            key={selectedVersion}
            cps={cps}
            projectId={projectId}
            onUpdated={load}
            isSample={isSample}
          />
        </div>
      </div>

      {/* ── 우: 버전 히스토리 패널 (220px) ── */}
      <aside className="w-[220px] shrink-0 border-l bg-white overflow-y-auto py-4">
        <p className="text-xs font-medium text-zinc-400 px-4 mb-2">{t("history.title")}</p>
        <div className="space-y-0.5 px-2">
          {versions.map((v) => (
            <button
              key={v.version}
              type="button"
              onClick={() => handleVersionSelect(v.version)}
              className={`w-full text-left px-3 py-2.5 rounded-md transition-colors ${
                v.version === selectedVersion
                  ? "bg-zinc-900 text-white"
                  : "hover:bg-zinc-100 text-zinc-700"
              }`}
            >
              <div className="flex items-center justify-between gap-1 mb-0.5">
                <span className="font-mono text-xs font-medium">v{v.version}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                  v.version === selectedVersion
                    ? "bg-white/20 text-white"
                    : v.changeType === "manual_edit"
                    ? "bg-zinc-100 text-zinc-500"
                    : "bg-green-100 text-green-700"
                }`}>
                  {v.changeType === "manual_edit" ? t("history.manual") : t("history.auto")}
                </span>
              </div>
              {v.changedFields?.length > 0 && (
                <p className={`text-xs truncate ${v.version === selectedVersion ? "text-zinc-300" : "text-zinc-400"}`}>
                  {v.changedFields.join(", ")}
                </p>
              )}
              <p className={`text-xs ${v.version === selectedVersion ? "text-zinc-400" : "text-zinc-400"}`}>
                {new Date(v.createdAt).toLocaleDateString()}
              </p>
            </button>
          ))}
        </div>

        {/* 메타 정보 */}
        {cps && (
          <div className="mt-4 px-4 pt-4 border-t space-y-1.5">
            <p className="text-xs font-medium text-zinc-400 mb-2">{t("meta.title")}</p>
            <MetaRow label={t("meta.version")} value={`v${cps.meta.version}`} />
            <MetaRow label={t("meta.meetings")} value={String(cps.meta.sourceMeetings?.length ?? 0)} />
            <MetaRow
              label={t("meta.lastUpdated")}
              value={new Date(cps.meta.lastUpdated).toLocaleDateString()}
            />
            <MetaRow
              label={t("meta.updateMethod")}
              value={cps.meta.changeType === "auto" ? t("meta.auto") : t("meta.manual")}
            />
          </div>
        )}
      </aside>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-zinc-400">{label}</span>
      <span className="font-medium text-zinc-600">{value}</span>
    </div>
  );
}
