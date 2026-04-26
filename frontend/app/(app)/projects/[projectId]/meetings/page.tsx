"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import AnalysisStatusBadge from "@/components/meeting/AnalysisStatusBadge";
import MeetingDetail from "@/components/meeting/MeetingDetail";
import { listenToMeetings } from "@/lib/firebase/firestore";
import { useAuth } from "@/lib/firebase/useAuth";
import { analyzeProject } from "@/lib/api/meetingApi";
import { AnalysisStatus, MeetingSummary } from "@/types/meeting";

type Props = {
  params: Promise<{ projectId: string }>;
};

function toIsoString(val: unknown): string | null {
  if (!val) return null;
  if (typeof val === "string") return val;
  if (typeof val === "object" && val !== null) {
    if ("toDate" in val && typeof (val as { toDate: unknown }).toDate === "function") {
      return (val as { toDate: () => Date }).toDate().toISOString();
    }
    if ("seconds" in val) {
      return new Date((val as { seconds: number }).seconds * 1000).toISOString();
    }
  }
  return null;
}

function toMeetingSummary(raw: Record<string, unknown>): MeetingSummary {
  return {
    meetingId: raw.id as string,
    title: (raw.title as string | null) ?? null,
    date: raw.date as string,
    participants: (raw.participants as string[]) ?? [],
    analysisStatus: (raw.analysis_status as AnalysisStatus) ?? "pending",
    createdAt: toIsoString(raw.created_at) ?? "",
  };
}

export default function MeetingsPage({ params }: Props) {
  const { projectId } = use(params);
  const t = useTranslations("meeting");
  const { groupId, isLoading: authLoading } = useAuth();

  const [meetings, setMeetings] = useState<MeetingSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selected, setSelected] = useState<MeetingSummary | null>(null);
  const [search, setSearch] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState<"cps" | "cpsPrd" | null>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const isSample = projectId.startsWith("sample-");

  // Firestore 실시간 리스닝
  useEffect(() => {
    if (authLoading || !groupId) return;
    const unsubscribe = listenToMeetings(groupId, projectId, (raw) => {
      const list = raw.map(toMeetingSummary);
      setMeetings(list);
      // 첫 로드 시 첫 번째 항목 자동 선택
      setSelected((prev) => {
        if (prev) return list.find((m) => m.meetingId === prev.meetingId) ?? prev;
        return list[0] ?? null;
      });
      setIsLoading(false);
    });
    return unsubscribe;
  }, [groupId, projectId, authLoading]);

  const pendingCount = meetings.filter((m) => m.analysisStatus === "pending").length;

  async function handleAnalyze(mode: "cps" | "cpsPrd") {
    setIsAnalyzing(mode);
    setAnalyzeError(null);
    try {
      await analyzeProject(projectId, {
        analyze_cps: true,
        analyze_prd: mode === "cpsPrd",
      });
    } catch {
      setAnalyzeError(t("detail.analyzeError"));
    } finally {
      setIsAnalyzing(null);
    }
  }

  const filtered = meetings.filter((m) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (m.title ?? "").toLowerCase().includes(q) ||
      m.participants.some((p) => p.toLowerCase().includes(q)) ||
      m.date.includes(q)
    );
  });

  return (
    <div className="flex h-full overflow-hidden">
      {/* 좌: 미팅 목록 (340px 고정) */}
      <div className="w-[340px] shrink-0 border-r bg-white flex flex-col">
        {/* 검색 + 추가 버튼 */}
        <div className="px-3 py-3 border-b space-y-2">
          <Input
            placeholder={t("searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-sm"
          />
          <Link href={isSample ? "#" : `/projects/${projectId}/meetings/new`}>
            <Button size="sm" className="w-full" disabled={isSample}>{t("addMeeting")}</Button>
          </Link>
        </div>

        {/* pending 미팅 분석 배너 */}
        {pendingCount > 0 && (
          <div className="px-3 py-2 border-b bg-amber-50 space-y-1.5">
            {analyzeError && (
              <p className="text-xs text-red-600">{analyzeError}</p>
            )}
            <div className="flex gap-1.5">
              <Button
                size="sm"
                variant="outline"
                className="flex-1 bg-white"
                onClick={() => handleAnalyze("cps")}
                disabled={isAnalyzing !== null || isSample}
              >
                {isAnalyzing === "cps" ? t("detail.analyzing") : t("detail.analyzeCpsOnly")}
              </Button>
              <Button
                size="sm"
                className="flex-1"
                onClick={() => handleAnalyze("cpsPrd")}
                disabled={isAnalyzing !== null || isSample}
              >
                {isAnalyzing === "cpsPrd" ? t("detail.analyzing") : t("detail.analyzeCpsPrd")}
              </Button>
            </div>
          </div>
        )}

        {/* 미팅 목록 */}
        <div className="flex-1 overflow-y-auto">
          {isLoading && (
            <div className="flex justify-center py-10">
              <div className="w-5 h-5 border-2 border-zinc-300 border-t-zinc-700 rounded-full animate-spin" />
            </div>
          )}

          {!isLoading && filtered.length === 0 && (
            <div className="text-center py-10 text-zinc-400 text-sm px-4">
              {search ? t("noSearchResult") : t("empty")}
            </div>
          )}

          {!isLoading && filtered.map((meeting) => {
            const isActive = selected?.meetingId === meeting.meetingId;
            return (
              <button
                key={meeting.meetingId}
                type="button"
                onClick={() => setSelected(meeting)}
                className={`w-full text-left px-4 py-3 border-b transition-colors ${
                  isActive ? "bg-blue-50 border-l-2 border-l-blue-500" : "hover:bg-zinc-50 border-l-2 border-l-transparent"
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className={`text-sm font-medium truncate ${isActive ? "text-blue-700" : "text-zinc-800"}`}>
                    {meeting.title ?? t("untitled")}
                  </p>
                  <AnalysisStatusBadge status={meeting.analysisStatus} />
                </div>
                <p className="text-xs text-zinc-500 mb-1">{meeting.date} · {meeting.participants.join(", ")}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* 우: 미팅 상세 */}
      <div className="flex-1 overflow-hidden">
        {selected ? (
          <MeetingDetail
            key={selected.meetingId}
            projectId={projectId}
            summary={selected}
            onMeetingUpdated={() => {
              // Firestore 실시간 리스닝이 자동 갱신
            }}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-zinc-400 text-sm">
            {isLoading ? "" : t("selectPrompt")}
          </div>
        )}
      </div>
    </div>
  );
}
