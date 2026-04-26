"use client";

import { useEffect, useState, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { useTranslations } from "next-intl";
import { Pencil, RefreshCw, X, Check } from "lucide-react";
import AnalysisStatusBadge from "./AnalysisStatusBadge";
import { fetchMeeting, updateMeeting, reanalyzeMeeting, fetchMeetingSummaryText } from "@/lib/api/meetingApi";
import { fetchCpsHistory } from "@/lib/api/cpsApi";
import { Meeting, MeetingSummary } from "@/types/meeting";
import { CpsVersion } from "@/types/cps";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  projectId: string;
  summary: MeetingSummary;
  onMeetingUpdated?: () => void;
};

type DetailTab = "content" | "cps";

export default function MeetingDetail({ projectId, summary, onMeetingUpdated }: Props) {
  const t = useTranslations("meeting.detail");
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [cpsChanges, setCpsChanges] = useState<CpsVersion | null>(null);
  const [tab, setTab] = useState<DetailTab>("content");
  const [isLoading, setIsLoading] = useState(true);

  // 편집 모드
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // 재분석
  const [isReanalyzing, setIsReanalyzing] = useState<"cps" | "cpsPrd" | null>(null);
  const [localStatus, setLocalStatus] = useState(summary.analysisStatus);

  // 요약 폴링
  const [isPollingSummary, setIsPollingSummary] = useState(false);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pollCountRef = useRef(0);
  const isSample = projectId.startsWith("sample-");

  useEffect(() => {
    setLocalStatus(summary.analysisStatus);
  }, [summary.analysisStatus]);

  useEffect(() => {
    let cancelled = false;

    setIsLoading(true);
    setMeeting(null);
    setCpsChanges(null);
    setIsEditing(false);

    Promise.all([
      fetchMeeting(projectId, summary.meetingId),
      fetchCpsHistory(projectId).catch(() => [] as CpsVersion[]),
    ])
      .then(([m, versions]) => {
        if (cancelled) return;
        setMeeting(m);
        setEditContent(m.content);
        const related = versions.find((v) => v.sourceMeetingId === summary.meetingId);
        setCpsChanges(related ?? null);

        if (!m.summary) {
          setIsPollingSummary(true);
          pollCountRef.current = 0;
        } else {
          setIsPollingSummary(false);
        }
      })
      .catch(() => {
        if (!cancelled) setIsLoading(false);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [projectId, summary.meetingId]);

  useEffect(() => {
    if (!isPollingSummary || !meeting) return;

    pollTimerRef.current = setInterval(async () => {
      try {
        pollCountRef.current += 1;
        if (pollCountRef.current > 10) {
          setIsPollingSummary(false);
          clearInterval(pollTimerRef.current!);
          return;
        }

        const res = await fetchMeetingSummaryText(projectId, meeting.meetingId);
        if (res.summary) {
          setMeeting((prev) => prev ? { ...prev, summary: res.summary } : null);
          setIsPollingSummary(false);
          clearInterval(pollTimerRef.current!);
        }
      } catch (e) {
        // 무시
      }
    }, 3000);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [isPollingSummary, meeting?.meetingId, projectId]);

  async function handleSaveEdit() {
    if (!meeting) return;
    setIsSaving(true);
    try {
      const updated = await updateMeeting(projectId, meeting.meetingId, {
        content: editContent,
      });
      setMeeting(updated);
      setIsEditing(false);
      
      if (!updated.summary) {
        setIsPollingSummary(true);
        pollCountRef.current = 0;
      }
      
      onMeetingUpdated?.();
    } finally {
      setIsSaving(false);
    }
  }

  function handleCancelEdit() {
    setEditContent(meeting?.content ?? "");
    setIsEditing(false);
  }

  async function handleReanalyze(mode: "cps" | "cpsPrd") {
    if (!meeting) return;
    setIsReanalyzing(mode);
    try {
      await reanalyzeMeeting(projectId, meeting.meetingId, {
        analyze_cps: true,
        analyze_prd: mode === "cpsPrd",
      });
      setLocalStatus("processing");
      onMeetingUpdated?.();
    } finally {
      setIsReanalyzing(null);
    }
  }

  const canReanalyze = localStatus === "pending" || localStatus === "failed" || localStatus === "completed";

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="px-6 py-4 border-b bg-white shrink-0">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h2 className="text-base font-semibold">
            {summary.title ?? t("untitled")}
          </h2>
          <div className="flex items-center gap-2 shrink-0">
            <AnalysisStatusBadge status={localStatus} />
            {/* 재분석 버튼 */}
            {canReanalyze && !isEditing && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => handleReanalyze("cps")}
                  disabled={isReanalyzing !== null || isSample}
                >
                  <RefreshCw className={`w-3 h-3 ${isReanalyzing === "cps" ? "animate-spin" : ""}`} />
                  {isReanalyzing === "cps" ? t("reanalyzing") : t("analyzeCpsOnly")}
                </Button>
                <Button
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => handleReanalyze("cpsPrd")}
                  disabled={isReanalyzing !== null || isSample}
                >
                  <RefreshCw className={`w-3 h-3 ${isReanalyzing === "cpsPrd" ? "animate-spin" : ""}`} />
                  {isReanalyzing === "cpsPrd" ? t("reanalyzing") : t("analyzeCpsPrd")}
                </Button>
              </>
            )}
            {/* 편집 버튼 */}
            {!isEditing && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => { setIsEditing(true); setTab("content"); }}
                disabled={isSample}
              >
                <Pencil className="w-3 h-3" />
                {t("edit")}
              </Button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-zinc-500">
          <span>{summary.date}</span>
          <span>·</span>
          <span>{summary.participants.join(", ")}</span>
        </div>

        {/* 분석 상태 배너 */}
        {localStatus === "processing" && (
          <div className="mt-3 px-3 py-2 rounded-md bg-blue-50 border border-blue-200 text-xs text-blue-700 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            {t("analyzingBanner")}
          </div>
        )}
        {localStatus === "failed" && (
          <div className="mt-3 px-3 py-2 rounded-md bg-red-50 border border-red-200 text-xs text-red-700">
            {t("failedBanner")}
          </div>
        )}

        {/* 탭 */}
        <div className="flex gap-0 mt-3 -mb-px">
          {(["content", "cps"] as DetailTab[]).map((tb) => (
            <button
              key={tb}
              type="button"
              onClick={() => setTab(tb)}
              className={`px-4 py-1.5 text-xs font-medium border-b-2 transition-colors ${
                tab === tb
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-zinc-500 hover:text-zinc-700"
              }`}
            >
              {tb === "content" ? t("tab.content") : t("tab.cpsUpdate")}
            </button>
          ))}
        </div>
      </div>

      {/* 탭 콘텐츠 */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {isLoading && (
          <div className="flex justify-center py-10">
            <div className="w-5 h-5 border-2 border-zinc-300 border-t-zinc-700 rounded-full animate-spin" />
          </div>
        )}

        {/* 원본 내용 탭 */}
        {!isLoading && tab === "content" && meeting && (
          <>
            {isEditing ? (
              <div className="space-y-3">
                <p className="text-xs text-zinc-500">{t("editHint")}</p>
                <Textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={20}
                  className="font-mono text-sm resize-none"
                />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={handleCancelEdit} disabled={isSaving}>
                    <X className="w-3.5 h-3.5 mr-1" />
                    {t("cancel")}
                  </Button>
                  <Button size="sm" onClick={handleSaveEdit} disabled={isSaving}>
                    <Check className="w-3.5 h-3.5 mr-1" />
                    {isSaving ? t("saving") : t("save")}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                {meeting.summary ? (
                  <div className="rounded-xl bg-zinc-50/80 p-5 border border-zinc-200/60 shadow-sm">
                    <h3 className="text-sm font-semibold text-zinc-800 mb-3 flex items-center gap-1.5">
                      <span className="text-blue-500">✨</span> {t("summary")}
                    </h3>
                    <div className="text-sm text-zinc-700 leading-normal space-y-1.5 [&_li]:text-zinc-700 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:mt-0.5 [&_li_p]:inline [&_p]:mb-1.5 [&_p:last-child]:mb-0">
                      <ReactMarkdown>{meeting.summary}</ReactMarkdown>
                    </div>
                  </div>
                ) : isPollingSummary ? (
                  <div className="rounded-xl bg-zinc-50/80 p-5 border border-zinc-200/60 shadow-sm flex flex-col gap-3">
                    <h3 className="text-sm font-semibold text-zinc-800 flex items-center gap-1.5">
                      <span className="text-blue-500">✨</span> {t("summary")} <span className="text-zinc-400 font-normal ml-2">{t("summarizing")}</span>
                    </h3>
                    <div className="space-y-2.5 animate-pulse mt-1">
                      <div className="h-3 w-3/4 bg-zinc-200 rounded-sm"></div>
                      <div className="h-3 w-1/2 bg-zinc-200 rounded-sm"></div>
                      <div className="h-3 w-5/6 bg-zinc-200 rounded-sm"></div>
                    </div>
                  </div>
                ) : null}
                
                <div className="text-sm text-zinc-800 leading-relaxed [&_h1]:text-xl [&_h1]:font-bold [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-4 [&_h3]:font-semibold [&_h3]:mt-3 [&_ul]:list-disc [&_ul]:ml-5 [&_ol]:list-decimal [&_ol]:ml-5 [&_li]:text-zinc-700 [&_p]:text-zinc-700 [&_p]:leading-relaxed [&_blockquote]:border-l-4 [&_blockquote]:border-zinc-300 [&_blockquote]:pl-4 [&_blockquote]:text-zinc-500 whitespace-pre-wrap">
                  <ReactMarkdown>{meeting.content}</ReactMarkdown>
                </div>
              </div>
            )}
          </>
        )}

        {/* CPS 업데이트 탭 */}
        {!isLoading && tab === "cps" && (
          <div>
            {cpsChanges ? (
              <div>
                <p className="text-xs text-zinc-500 mb-3">
                  {t("cpsUpdate.created")} <span className="font-mono font-medium">v{cpsChanges.version}</span>
                </p>
                {cpsChanges.changedFields?.length > 0 ? (
                  <ul className="space-y-2">
                    {cpsChanges.changedFields.map((field) => (
                      <li key={field} className="flex items-center gap-2 text-sm">
                        <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                        <span className="capitalize">{field}</span>
                        <span className="text-xs text-zinc-400">{t("cpsUpdate.updated")}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-zinc-500">{t("cpsUpdate.noChanges")}</p>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-zinc-400 text-sm">
                {localStatus === "pending" || localStatus === "processing"
                  ? t("cpsUpdate.waiting")
                  : t("cpsUpdate.none")}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
