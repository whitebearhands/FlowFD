"use client";

import { useEffect, useRef, useState, use, useCallback } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { fetchPrd, fetchPrdHistory, fetchPrdVersion, exportPrd } from "@/lib/api/prdApi";
import {
  Prd, PrdVersion, PrdContent, PrdFeature, PrdGoals,
  PrdNonFunctional, PrdRisk, PrdScope, FrPriority,
} from "@/types/prd";
import { listenToActiveJob } from "@/lib/firebase/firestore";
import { useAuth } from "@/lib/firebase/useAuth";
import { X, Download } from "lucide-react";

type Props = { params: Promise<{ projectId: string }> };
type ViewMode = "document" | "kanban";
type NavSection =
  | "overview" | "goals" | "users" | "features"
  | "nonfunctional" | "openquestions";

// ─── 우선순위 스타일 ──────────────────────────────────────────
const PRIORITY_CFG: Record<FrPriority, { label: string; cls: string }> = {
  Must:   { label: "Must",   cls: "bg-red-100 text-red-700" },
  Should: { label: "Should", cls: "bg-orange-100 text-orange-700" },
  Could:  { label: "Could",  cls: "bg-blue-100 text-blue-600" },
};

const COL_STYLE: Record<FrPriority, { header: string; bg: string; border: string; badge: string }> = {
  Must:   { header: "bg-red-50 text-red-800",       bg: "bg-red-50/50",    border: "border-red-200",    badge: "bg-red-100 text-red-700" },
  Should: { header: "bg-orange-50 text-orange-800", bg: "bg-orange-50/50", border: "border-orange-200", badge: "bg-orange-100 text-orange-700" },
  Could:  { header: "bg-blue-50 text-blue-800",     bg: "bg-blue-50/50",   border: "border-blue-200",   badge: "bg-blue-100 text-blue-600" },
};

// ─── 섹션 컴포넌트 ────────────────────────────────────────────
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-base font-semibold text-zinc-800 mb-3 pb-2 border-b">{children}</h2>;
}

function GoalsSection({ goals }: { goals: PrdGoals }) {
  const t = useTranslations("prd");
  return (
    <div className="space-y-5">
      {goals.businessGoals?.length > 0 && (
        <div>
          <SectionTitle>{t("goals.title")}</SectionTitle>
          <ul className="space-y-1.5">
            {goals.businessGoals.map((g, i) => (
              <li key={i} className="flex gap-2 text-sm text-zinc-700">
                <span className="text-zinc-400 shrink-0">•</span>
                <span>{g}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {goals.successMetrics?.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-zinc-600 mb-2">{t("goals.successMetrics")}</h3>
          <div className="overflow-x-auto rounded-lg border border-zinc-200">
            <table className="w-full text-sm text-left">
              <thead className="bg-zinc-50 text-xs text-zinc-500 uppercase">
                <tr>
                  <th className="px-4 py-2.5 font-semibold text-zinc-600">{t("goals.metric")}</th>
                  <th className="px-4 py-2.5 font-semibold text-zinc-600">{t("goals.asis")}</th>
                  <th className="px-4 py-2.5 font-semibold text-zinc-600">{t("goals.tobe")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {goals.successMetrics.map((m, i) => (
                  <tr key={i} className="hover:bg-zinc-50">
                    <td className="px-4 py-2.5 text-zinc-700 font-medium">{m.metric}</td>
                    <td className="px-4 py-2.5 text-zinc-500">{m.before}</td>
                    <td className="px-4 py-2.5 text-green-700">{m.after}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function UsersSection({ users }: { users: PrdContent["users"] }) {
  const t = useTranslations("prd");
  const freqColor = (f: string) => {
    if (f === "높음") return "bg-red-100 text-red-700";
    if (f === "중간") return "bg-orange-100 text-orange-700";
    return "bg-zinc-100 text-zinc-600";
  };
  return (
    <div>
      <SectionTitle>{t("users.title")}</SectionTitle>
      <div className="space-y-3">
        {(users ?? []).map((u, i) => (
          <div key={i} className="border rounded-lg p-4 bg-white">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-zinc-800">{u.type}</span>
              {u.frequency && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${freqColor(u.frequency)}`}>
                  {u.frequency}
                </span>
              )}
            </div>
            {u.goal && <p className="text-xs text-zinc-600 mb-1"><span className="font-medium">{t("users.goal")}</span> {u.goal}</p>}
            {u.pain && <p className="text-xs text-zinc-500"><span className="font-medium">{t("users.pain")}</span> {u.pain}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

function RisksSection({ risks }: { risks: PrdRisk[] }) {
  const t = useTranslations("prd");
  return (
    <div>
      <SectionTitle>{t("risks.title")}</SectionTitle>
      <div className="space-y-2">
        {risks.map((r, i) => (
          <div key={i} className="flex gap-3 p-3 rounded-lg border border-red-100 bg-red-50/40">
            <span className="w-2 h-2 rounded-full bg-red-400 shrink-0 mt-1.5" />
            <div>
              <p className="text-sm text-zinc-700">{r.description}</p>
              {r.frIds?.length > 0 && (
                <div className="mt-1 flex gap-1 flex-wrap">
                  {r.frIds.map((id) => (
                    <span key={id} className="font-mono text-xs px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-500">{id}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function OpenQuestionsSection({ questions }: { questions: string[] }) {
  const t = useTranslations("prd");
  return (
    <div>
      <SectionTitle>{t("openQuestions.title")}</SectionTitle>
      <div className="space-y-2">
        {questions.map((q, i) => (
          <div key={i} className="flex gap-3 p-3 rounded-lg border border-zinc-200 bg-zinc-50">
            <span className="w-2 h-2 rounded-full bg-orange-400 shrink-0 mt-1.5" />
            <p className="text-sm text-zinc-700">{q}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function OutOfScopeSection({ scope }: { scope: PrdScope | undefined }) {
  const t = useTranslations("prd");
  const items = scope?.outOfScope ?? [];
  if (!items.length) return null;
  return (
    <div>
      <SectionTitle>{t("outOfScope.title")}</SectionTitle>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2 text-sm text-zinc-500">
            <span className="shrink-0">—</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function NonFunctionalSection({ items }: { items: PrdNonFunctional[] }) {
  const t = useTranslations("prd");
  if (!items.length) return null;
  return (
    <div>
      <SectionTitle>{t("nonFunctional.title")}</SectionTitle>
      <div className="overflow-x-auto rounded-lg border border-zinc-200">
        <table className="w-full text-sm text-left">
          <thead className="bg-zinc-50 text-xs text-zinc-500 uppercase">
            <tr>
              <th className="px-4 py-2.5 font-semibold text-zinc-600">{t("nonFunctional.category")}</th>
              <th className="px-4 py-2.5 font-semibold text-zinc-600">{t("nonFunctional.requirement")}</th>
              <th className="px-4 py-2.5 font-semibold text-zinc-600">{t("nonFunctional.metric")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {items.map((item, i) => (
              <tr key={i} className="hover:bg-zinc-50">
                <td className="px-4 py-2.5">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 font-medium">
                    {item.category}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-zinc-700">{item.requirement}</td>
                <td className="px-4 py-2.5 text-zinc-500 font-mono text-xs">{item.metric}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── 메인 ─────────────────────────────────────────────────────
export default function PrdPage({ params }: Props) {
  const { projectId } = use(params);
  const t = useTranslations("prd");
  const { groupId } = useAuth();

  const [prd, setPrd] = useState<Prd | null>(null);
  const [prdData, setPrdData] = useState<PrdContent | null>(null);
  const [versions, setVersions] = useState<PrdVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const wasGeneratingRef = useRef(false);
  const isSample = projectId.startsWith("sample-");

  const [viewMode, setViewMode] = useState<ViewMode>("kanban");
  const [navSection, setNavSection] = useState<NavSection>("overview");
  const [selectedFr, setSelectedFr] = useState<PrdFeature | null>(null);

  const applyPrd = (data: Prd) => {
    setPrd(data);
    setPrdData(data.content ?? null);
  };

  const load = useCallback(() => {
    Promise.all([fetchPrd(projectId), fetchPrdHistory(projectId)])
      .then(([prdData, historyData]) => {
        applyPrd(prdData);
        setVersions(historyData);
        setSelectedVersion(prdData.version);
      })
      .catch(() => setError(t("noData")))
      .finally(() => setIsLoading(false));
  }, [projectId, t]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!groupId) return;
    const unsub = listenToActiveJob(groupId, projectId, "prd_generation", (isActive) => {
      if (!isActive && wasGeneratingRef.current) {
        load();
      }
      wasGeneratingRef.current = isActive;
      setIsGenerating(isActive);
    });
    return unsub;
  }, [groupId, projectId, load]);

  async function handleVersionSelect(version: string) {
    if (version === selectedVersion) return;
    setSelectedVersion(version);
    const data = await fetchPrdVersion(projectId, version);
    applyPrd(data);
    setSelectedFr(null);
  }

  const NAV_ITEMS: { id: NavSection; label: string }[] = [
    { id: "overview",       label: t("nav.overview") },
    { id: "goals",          label: t("nav.goals") },
    { id: "users",          label: t("nav.users") },
    { id: "features",       label: t("nav.features") },
    { id: "nonfunctional",  label: t("nav.nonFunctional") },
    { id: "openquestions",  label: t("nav.openQuestions") },
  ];

  const features = prdData?.features ?? [];
  const mustCards   = features.filter((c) => c.priority === "Must");
  const shouldCards = features.filter((c) => c.priority === "Should");
  const couldCards  = features.filter((c) => c.priority === "Could");

  if (isLoading) return (
    <div className="flex justify-center py-16">
      <div className="w-6 h-6 border-2 border-zinc-300 border-t-zinc-700 rounded-full animate-spin" />
    </div>
  );
  if ((error || !prd) && isGenerating) return (
    <div className="flex flex-col items-center justify-center h-full text-zinc-500 gap-3">
      <div className="w-6 h-6 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />
      <p className="text-sm text-blue-600">{t("generating")}</p>
    </div>
  );
  if (error || !prd) return (
    <div className="flex flex-col items-center justify-center h-full text-zinc-500 gap-3">
      <p>{error ?? t("noData")}</p>
      <p className="text-sm">{t("noDataHint")}</p>
    </div>
  );

  const isKanban = navSection === "features" && viewMode === "kanban";

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── 좌: 섹션 네비 ── */}
      <aside className="w-40 shrink-0 border-r bg-white overflow-y-auto py-4 flex flex-col">
        <div className="px-3 mb-4">
          <p className="text-xs font-medium text-zinc-400 px-2 mb-1">{t("nav.section")}</p>
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setNavSection(item.id);
                if (item.id === "features") setViewMode("kanban");
                else setViewMode("document");
                setSelectedFr(null);
              }}
              className={`w-full text-left px-2 py-1.5 text-xs rounded transition-colors ${
                navSection === item.id
                  ? "bg-zinc-100 text-zinc-900 font-medium"
                  : "text-zinc-600 hover:bg-zinc-50"
              }`}
            >
              {item.label}
              {item.id === "features" && features.length > 0 && (
                <span className="ml-1 text-zinc-400">({features.length})</span>
              )}
            </button>
          ))}
        </div>

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

      {/* ── 중앙: 콘텐츠 ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 상단 툴바 */}
        <div className="bg-white border-b px-6 py-2.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            {navSection === "features" && (
              <div className="flex rounded-md border overflow-hidden">
                {(["document", "kanban"] as ViewMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setViewMode(mode)}
                    className={`px-3 py-1 text-xs font-medium transition-colors ${
                      viewMode === mode
                        ? "bg-zinc-900 text-white"
                        : "text-zinc-600 hover:bg-zinc-50"
                    }`}
                  >
                    {mode === "document" ? t("view.document") : t("view.kanban")}
                  </button>
                ))}
              </div>
            )}
            <Link
              href={`/projects/${projectId}/cps`}
              className="text-xs text-blue-600 hover:underline"
            >
              {t("toolbar.cpsBase", { version: prd.sourceCpsVersion })}
            </Link>
          </div>
          <div className="flex gap-2 items-center">
            {navSection === "features" && (
              <span className="text-xs text-zinc-500">{t("toolbar.totalFr", { count: features.length })}</span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportPrd(projectId)}
              className="flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              {t("toolbar.export")}
            </Button>
            <Button variant="outline" size="sm" disabled={isSample}>{t("toolbar.edit")}</Button>
          </div>
        </div>

        {/* 콘텐츠 본문 */}
        <div className="flex-1 overflow-hidden flex">
          <div className="flex-1 overflow-y-auto px-6 py-5">

            {/* 칸반 뷰 (기능 요구사항) */}
            {isKanban ? (
              <div className="flex gap-4 h-full pb-4">
                {(["Must", "Should", "Could"] as FrPriority[]).map((priority) => {
                  const cards = priority === "Must" ? mustCards : priority === "Should" ? shouldCards : couldCards;
                  const style = COL_STYLE[priority];
                  return (
                    <div key={priority} className={`flex-1 min-w-56 rounded-xl border ${style.border} flex flex-col overflow-hidden`}>
                      <div className={`px-4 py-2.5 ${style.header} flex items-center justify-between`}>
                        <span className="text-sm font-semibold">{priority}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${style.badge}`}>{cards.length}</span>
                      </div>
                      <div className={`flex-1 overflow-y-auto p-2 space-y-2 ${style.bg}`}>
                        {cards.map((card) => (
                          <button
                            key={card.id}
                            type="button"
                            onClick={() => setSelectedFr(card)}
                            className={`w-full text-left p-3 rounded-lg bg-white border transition-all shadow-sm hover:shadow-md ${
                              selectedFr?.id === card.id ? "border-blue-400 ring-1 ring-blue-400" : "border-zinc-200"
                            }`}
                          >
                            <p className="font-mono text-xs text-zinc-400 mb-1">{card.id}</p>
                            <p className="text-sm font-medium text-zinc-800 leading-snug">{card.title}</p>
                            {card.description && (
                              <p className="text-xs text-zinc-500 mt-1.5 line-clamp-2 leading-relaxed">
                                {card.description.slice(0, 120)}
                              </p>
                            )}
                          </button>
                        ))}
                        {cards.length === 0 && (
                          <div className="text-center py-8 text-xs text-zinc-400">{t("kanban.empty")}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : navSection === "features" && viewMode === "document" ? (
              /* 기능 요구사항 문서 뷰 */
              <div className="space-y-3">
                <SectionTitle>{t("features.title")}</SectionTitle>
                {features.map((f) => {
                  const p = PRIORITY_CFG[f.priority] ?? PRIORITY_CFG["Could"];
                  return (
                    <div key={f.id} className="border rounded-lg p-4 bg-white shadow-sm">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-zinc-400">{f.id}</span>
                          <span className="text-sm font-semibold text-zinc-800">{f.title}</span>
                        </div>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${p.cls}`}>{p.label}</span>
                      </div>
                      {f.description && <p className="text-sm text-zinc-600 leading-relaxed">{f.description}</p>}
                    </div>
                  );
                })}
              </div>
            ) : navSection === "goals" && prdData?.goals ? (
              <GoalsSection goals={prdData.goals} />
            ) : navSection === "users" && prdData?.users?.length ? (
              <UsersSection users={prdData.users} />
            ) : navSection === "nonfunctional" ? (
              <NonFunctionalSection items={prdData?.nonFunctional ?? []} />
            ) : navSection === "openquestions" ? (
              <div className="space-y-6">
                {(prdData?.openQuestions?.length ?? 0) > 0 && (
                  <OpenQuestionsSection questions={prdData!.openQuestions!} />
                )}
                {(prdData?.scope?.outOfScope?.length ?? 0) > 0 && (
                  <OutOfScopeSection scope={prdData!.scope} />
                )}
                {(prdData?.risks?.length ?? 0) > 0 && (
                  <RisksSection risks={prdData!.risks!} />
                )}
              </div>
            ) : navSection === "overview" && prdData ? (
              <div className="space-y-5">
                <SectionTitle>{t("overview.title")}</SectionTitle>
                {prdData.overview && (
                  <p className="text-sm text-zinc-600 leading-relaxed">{prdData.overview}</p>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div className="border rounded-lg p-4 bg-white">
                    <p className="text-xs text-zinc-400 mb-1">{t("overview.version")}</p>
                    <p className="text-sm font-semibold text-zinc-800">v{prd.version}</p>
                  </div>
                  <div className="border rounded-lg p-4 bg-white">
                    <p className="text-xs text-zinc-400 mb-1">{t("overview.baseCps")}</p>
                    <p className="text-sm font-semibold text-zinc-800">v{prd.sourceCpsVersion}</p>
                  </div>
                  <div className="border rounded-lg p-4 bg-white">
                    <p className="text-xs text-zinc-400 mb-1">{t("overview.totalFr")}</p>
                    <p className="text-sm font-semibold text-zinc-800">{features.length}</p>
                  </div>
                  <div className="border rounded-lg p-4 bg-white">
                    <p className="text-xs text-zinc-400 mb-1">{t("overview.openQuestions")}</p>
                    <p className="text-sm font-semibold text-zinc-800">{prdData.openQuestions?.length ?? 0}</p>
                  </div>
                </div>
                {(prdData.risks?.length ?? 0) > 0 && <RisksSection risks={prdData.risks!} />}
              </div>
            ) : (
              <div className="text-center py-12 text-zinc-400 text-sm">{t("sectionEmpty")}</div>
            )}
          </div>

          {/* 우측 FR 상세 패널 (칸반 뷰에서만) */}
          {isKanban && (
            <aside className={`border-l bg-white overflow-y-auto transition-all ${selectedFr ? "w-72 px-4 py-4" : "w-56 flex items-center justify-center"}`}>
              {selectedFr ? (
                <div>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-mono text-xs text-zinc-400">{selectedFr.id}</p>
                      <p className="text-sm font-semibold text-zinc-900 mt-0.5 leading-snug">{selectedFr.title}</p>
                    </div>
                    <button type="button" onClick={() => setSelectedFr(null)} className="text-zinc-400 hover:text-zinc-600 shrink-0 ml-2">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${COL_STYLE[selectedFr.priority]?.badge ?? ""}`}>
                    {selectedFr.priority}
                  </span>
                  {selectedFr.description && (
                    <div className="mt-3">
                      <p className="text-xs font-medium text-zinc-400 mb-1">{t("kanban.description")}</p>
                      <p className="text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap">{selectedFr.description}</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-zinc-400 text-center">{t("kanban.selectCard")}</p>
              )}
            </aside>
          )}
        </div>
      </div>

      {/* ── 우: 버전 히스토리 패널 ── */}
      <aside className="w-[220px] shrink-0 border-l bg-white overflow-y-auto py-4">
        <p className="text-xs font-medium text-zinc-400 px-4 mb-2">{t("history.title")}</p>
        <div className="space-y-0.5 px-2">
          {versions.map((v) => (
            <button
              key={v.version}
              type="button"
              onClick={() => handleVersionSelect(v.version)}
              className={`w-full text-left px-3 py-2.5 rounded-md transition-colors ${
                v.version === selectedVersion ? "bg-zinc-900 text-white" : "hover:bg-zinc-100 text-zinc-700"
              }`}
            >
              <div className="flex items-center justify-between gap-1 mb-0.5">
                <span className="font-mono text-xs font-medium">v{v.version}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                  v.version === selectedVersion ? "bg-white/20 text-white"
                    : v.changeType === "manual_edit" ? "bg-zinc-100 text-zinc-500"
                    : "bg-green-100 text-green-700"
                }`}>
                  {v.changeType === "manual_edit" ? t("history.manual") : t("history.auto")}
                </span>
              </div>
              <p className="text-xs text-zinc-400">CPS v{v.sourceCpsVersion}</p>
              <p className="text-xs text-zinc-400">{new Date(v.createdAt).toLocaleDateString()}</p>
            </button>
          ))}
        </div>
        <div className="mt-4 px-4 pt-4 border-t space-y-1.5">
          <p className="text-xs font-medium text-zinc-400 mb-2">{t("meta.title")}</p>
          <MetaRow label={t("meta.version")} value={`v${prd.version}`} />
          <MetaRow label={t("meta.baseCps")} value={`v${prd.sourceCpsVersion}`} />
          <MetaRow label={t("meta.frCount")} value={String(features.length)} />
          <MetaRow label={t("meta.updateMethod")} value={prd.changeType === "auto" ? t("meta.auto") : t("meta.manual")} />
          <MetaRow label={t("meta.updated")} value={new Date(prd.createdAt).toLocaleDateString()} />
        </div>
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
