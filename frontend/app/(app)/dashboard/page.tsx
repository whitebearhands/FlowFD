"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import ProjectStatusBadge from "@/components/project/ProjectStatusBadge";
import AnalysisStatusBadge from "@/components/meeting/AnalysisStatusBadge";
import { fetchCps } from "@/lib/api/cpsApi";
import { fetchPrd } from "@/lib/api/prdApi";
import { fetchDesign } from "@/lib/api/designApi";
import { fetchSyncHistory } from "@/lib/api/githubApi";
import { listenToProjects, listenToMeetings } from "@/lib/firebase/firestore";
import { useAuth } from "@/lib/firebase/useAuth";
import { Project, ProjectColor, ProjectStatus } from "@/types/project";
import { CpsDocument } from "@/types/cps";
import { Prd } from "@/types/prd";
import { AnalysisStatus, MeetingSummary } from "@/types/meeting";

type RecentMeeting = MeetingSummary & { projectId: string; projectName: string };
type PendingItem = { projectId: string; projectName: string; content: string };

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

function toProject(raw: Record<string, unknown>): Project {
  return {
    projectId: raw.id as string,
    name: raw.name as string,
    client: raw.client as string,
    color: (raw.color as ProjectColor) ?? "blue",
    description: (raw.description as string | null) ?? null,
    tags: (raw.tags as string[]) ?? [],
    status: (raw.status as ProjectStatus) ?? "active",
    githubRepo: (raw.github_repo as string | null) ?? null,
    githubAutoCommit: (raw.github_auto_commit as boolean) ?? false,
    createdAt: toIsoString(raw.created_at) ?? "",
    lastMeetingAt: toIsoString(raw.last_meeting_at),
  };
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

export default function DashboardPage() {
  const t = useTranslations("project");
  const td = useTranslations("dashboard");
  const { groupId } = useAuth();

  const [projects, setProjects] = useState<Project[]>([]);
  const [meetingsPerProject, setMeetingsPerProject] = useState<Record<string, MeetingSummary[]>>({});
  const [cpsMap, setCpsMap] = useState<Record<string, CpsDocument | null>>({});
  const [prdMap, setPrdMap] = useState<Record<string, Prd | null>>({});
  const [hasDesignMap, setHasDesignMap] = useState<Record<string, boolean>>({});
  const [hasSyncMap, setHasSyncMap] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);

  // 프로젝트 실시간 리스닝
  useEffect(() => {
    if (!groupId) return;
    const unsub = listenToProjects(groupId, (raw) => {
      setProjects(raw.map(toProject));
      setIsLoading(false);
    });
    return unsub;
  }, [groupId]);

  // 활성 프로젝트의 미팅 실시간 리스닝 (프로젝트 목록 변경 시 재구독)
  const activeProjectIds = useMemo(
    () => projects.filter((p) => p.status === "active").map((p) => p.projectId).sort().join(","),
    [projects]
  );

  useEffect(() => {
    if (!groupId || !activeProjectIds) return;
    const activeIds = activeProjectIds.split(",").filter(Boolean);

    const unsubs = activeIds.map((pid) =>
      listenToMeetings(groupId, pid, (raw) => {
        setMeetingsPerProject((prev) => ({ ...prev, [pid]: raw.map(toMeetingSummary) }));
      })
    );

    return () => unsubs.forEach((u) => u());
  }, [groupId, activeProjectIds]);

  // CPS + PRD + Design + Sync 조회 (활성 프로젝트 변경 시)
  useEffect(() => {
    if (!activeProjectIds) return;
    const activeIds = activeProjectIds.split(",").filter(Boolean);
    Promise.all([
      Promise.all(activeIds.map((pid) => fetchCps(pid).catch(() => null))),
      Promise.all(activeIds.map((pid) => fetchPrd(pid).catch(() => null))),
      Promise.all(activeIds.map((pid) => fetchDesign(pid).catch(() => null))),
      Promise.all(activeIds.map((pid) => fetchSyncHistory(pid).catch(() => []))),
    ]).then(([cpsResults, prdResults, designResults, syncResults]) => {
      const newCpsMap: Record<string, CpsDocument | null> = {};
      const newPrdMap: Record<string, Prd | null> = {};
      const newHasDesignMap: Record<string, boolean> = {};
      const newHasSyncMap: Record<string, boolean> = {};
      activeIds.forEach((pid, i) => {
        newCpsMap[pid] = cpsResults[i];
        newPrdMap[pid] = prdResults[i];
        const d = designResults[i];
        newHasDesignMap[pid] = !!(d?.plan || d?.architecture);
        newHasSyncMap[pid] = Array.isArray(syncResults[i]) && (syncResults[i] as unknown[]).length > 0;
      });
      setCpsMap(newCpsMap);
      setPrdMap(newPrdMap);
      setHasDesignMap(newHasDesignMap);
      setHasSyncMap(newHasSyncMap);
    });
  }, [activeProjectIds]);

  const recentMeetings = useMemo<RecentMeeting[]>(() => {
    return projects
      .filter((p) => p.status === "active")
      .flatMap((p) =>
        (meetingsPerProject[p.projectId] ?? []).map((m) => ({
          ...m,
          projectId: p.projectId,
          projectName: p.name,
        }))
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);
  }, [projects, meetingsPerProject]);

  const pendingItems = useMemo<PendingItem[]>(() => {
    return projects
      .filter((p) => p.status === "active")
      .flatMap((p) => {
        const cps = cpsMap[p.projectId];
        if (!cps?.pending) return [];
        return [
          ...(cps.pending.questions ?? []).map((q) => ({ projectId: p.projectId, projectName: p.name, content: q })),
          ...(cps.pending.insights ?? []).map((ins) => ({ projectId: p.projectId, projectName: p.name, content: ins })),
        ];
      })
      .slice(0, 5);
  }, [projects, cpsMap]);

  const activeProjects = projects.filter((p) => p.status === "active");

  function getPipelineStage(project: Project): number {
    if (!project.lastMeetingAt) return 0;
    if (!cpsMap[project.projectId]) return 1;
    if (!prdMap[project.projectId]) return 2;
    if (!hasDesignMap[project.projectId]) return 3;
    if (!hasSyncMap[project.projectId]) return 4;
    return 5;
  }

  const pipelineStages = [
    td("pipeline.meeting"),
    td("pipeline.cps"),
    td("pipeline.prd"),
    td("pipeline.design"),
    // td("pipeline.code"),
    td("pipeline.sync"),
  ];

  return (
    <div className="p-6">
      {/* 상단 지표 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label={td("stat.activeProjects")} value={activeProjects.length} />
        <StatCard label={td("stat.totalProjects")} value={projects.length} />
        <StatCard label={td("stat.archived")} value={projects.filter((p) => p.status === "archived").length} />
        <div className="rounded-lg border bg-white p-4 flex flex-col justify-between">
          <p className="text-xs text-zinc-500 font-medium">{td("stat.quickAction")}</p>
          <Link href="/projects/new">
            <Button size="sm" className="w-full mt-2">{t("dashboard.newProject")}</Button>
          </Link>
        </div>
      </div>

      {/* 2열 레이아웃 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 좌: 프로젝트 현황 패널 (2/3) */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg border">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <h2 className="text-sm font-semibold">{td("projectPanel.title")}</h2>
              <Link href="/projects/new" className="text-xs text-blue-600 hover:underline">
                + {t("dashboard.newProject")}
              </Link>
            </div>

            {isLoading && (
              <div className="flex justify-center py-10">
                <div className="w-5 h-5 border-2 border-zinc-300 border-t-zinc-700 rounded-full animate-spin" />
              </div>
            )}

            {!isLoading && projects.length === 0 && (
              <div className="text-center py-12 text-zinc-400 text-sm">
                <p>{t("dashboard.empty")}</p>
              </div>
            )}

            {!isLoading && projects.length > 0 && (
              <ul className="divide-y">
                {projects.map((project) => {
                  const stage = getPipelineStage(project);
                  return (
                    <li key={project.projectId}>
                      <Link
                        href={`/projects/${project.projectId}`}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 transition-colors"
                      >
                        <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-medium truncate">{project.name}</p>
                            <ProjectStatusBadge status={project.status} />
                          </div>
                          <p className="text-xs text-zinc-400">{project.client}</p>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            {(meetingsPerProject[project.projectId]?.length ?? 0) > 0 && (
                              <span className="text-xs text-zinc-400">
                                {td("projectPanel.meetingCount", { count: meetingsPerProject[project.projectId].length })}
                              </span>
                            )}
                            {cpsMap[project.projectId] && (
                              <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-medium">
                                CPS {cpsMap[project.projectId]!.meta.version}
                              </span>
                            )}
                            {prdMap[project.projectId] && (
                              <span className="text-xs bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded font-medium">
                                PRD {prdMap[project.projectId]!.version}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 mt-1">
                            {pipelineStages.map((s, i) => (
                              <div
                                key={s}
                                title={s}
                                className={`h-1 flex-1 rounded-full ${
                                  i < stage ? "bg-blue-500" : i === stage ? "bg-blue-200" : "bg-zinc-100"
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                        <p className="text-xs text-zinc-400 shrink-0">
                          {project.lastMeetingAt
                            ? new Date(project.lastMeetingAt).toLocaleDateString()
                            : "—"}
                        </p>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* 우: 최근 미팅 + 미결 항목 패널 */}
        <div className="space-y-4">
          {/* 최근 미팅 */}
          <div className="bg-white rounded-lg border">
            <div className="px-4 py-3 border-b">
              <h2 className="text-sm font-semibold">{td("recentPanel.title")}</h2>
            </div>
            {isLoading ? (
              <div className="flex justify-center py-6">
                <div className="w-4 h-4 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin" />
              </div>
            ) : recentMeetings.length > 0 ? (
              <ul className="divide-y">
                {recentMeetings.map((m) => (
                  <li key={`${m.projectId}-${m.meetingId}`}>
                    <Link
                      href={`/projects/${m.projectId}/meetings`}
                      className="flex items-start gap-2 px-4 py-3 hover:bg-zinc-50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{m.title ?? m.date}</p>
                        <p className="text-xs text-zinc-400 truncate">{m.projectName}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <AnalysisStatusBadge status={m.analysisStatus} />
                        <span className="text-xs text-zinc-400">
                          {new Date(m.date).toLocaleDateString()}
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-4 py-6 text-center text-zinc-400 text-xs">
                <p>{td("recentPanel.empty")}</p>
              </div>
            )}
          </div>

          {/* 미결 항목 */}
          <div className="bg-white rounded-lg border">
            <div className="px-4 py-3 border-b">
              <h2 className="text-sm font-semibold">{td("pendingPanel.title")}</h2>
            </div>
            {isLoading ? (
              <div className="flex justify-center py-6">
                <div className="w-4 h-4 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin" />
              </div>
            ) : pendingItems.length > 0 ? (
              <ul className="divide-y">
                {pendingItems.map((item, idx) => (
                  <li key={idx}>
                    <Link
                      href={`/projects/${item.projectId}/cps`}
                      className="flex items-start gap-2 px-4 py-3 hover:bg-zinc-50 transition-colors"
                    >
                      <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-zinc-700 line-clamp-2">{item.content}</p>
                        <p className="text-xs text-zinc-400 mt-0.5">{item.projectName}</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-4 py-6 text-center text-zinc-400 text-xs">
                <p>{td("pendingPanel.empty")}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <p className="text-xs text-zinc-500 font-medium">{label}</p>
      <p className="text-2xl font-bold text-zinc-900 mt-1">{value}</p>
    </div>
  );
}
