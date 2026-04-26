"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import ProjectStatusBadge from "@/components/project/ProjectStatusBadge";
import AnalysisStatusBadge from "@/components/meeting/AnalysisStatusBadge";
import EditProjectModal from "@/components/project/EditProjectModal";
import { fetchProject, updateProject } from "@/lib/api/projectApi";
import { fetchCps } from "@/lib/api/cpsApi";
import { fetchMeetings } from "@/lib/api/meetingApi";
import { fetchPrd } from "@/lib/api/prdApi";
import { fetchDesign, Design } from "@/lib/api/designApi";
import { Project, UpdateProjectRequest } from "@/types/project";
import { CpsDocument } from "@/types/cps";
import { MeetingSummary } from "@/types/meeting";
import { Prd } from "@/types/prd";

type Props = {
  params: Promise<{ projectId: string }>;
};

export default function ProjectHomePage({ params }: Props) {
  const { projectId } = use(params);
  const t = useTranslations("project");

  const [project, setProject] = useState<Project | null>(null);
  const [cps, setCps] = useState<CpsDocument | null>(null);
  const [meetings, setMeetings] = useState<MeetingSummary[]>([]);
  const [prd, setPrd] = useState<Prd | null>(null);
  const [design, setDesign] = useState<Design | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const isSample = projectId.startsWith("sample-");

  useEffect(() => {
    Promise.all([
      fetchProject(projectId),
      fetchCps(projectId).catch(() => null),
      fetchMeetings(projectId).catch(() => []),
      fetchPrd(projectId).catch(() => null),
      fetchDesign(projectId).catch(() => null),
    ])
      .then(([proj, cpsData, meetingData, prdData, designData]) => {
        setProject(proj);
        setCps(cpsData);
        const sorted = [...meetingData].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setMeetings(sorted.slice(0, 3));
        setPrd(prdData);
        setDesign(designData);
      })
      .finally(() => setIsLoading(false));
  }, [projectId]);

  async function handleSaveEdit(data: UpdateProjectRequest) {
    await updateProject(projectId, data);
    const updated = await fetchProject(projectId);
    setProject(updated);
  }

  async function handleArchive() {
    if (!project) return;
    const nextStatus = project.status === "active" ? "archived" : "active";
    await updateProject(projectId, { status: nextStatus });
    setProject({ ...project, status: nextStatus });
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-6 h-6 border-2 border-zinc-300 border-t-zinc-700 rounded-full animate-spin" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-8 text-center text-zinc-500">
        <p>{t("notFound")}</p>
      </div>
    );
  }

  const pipelineSteps = [
    { key: "meetings", label: t("nav.meetings"), href: "meetings", done: !!project.lastMeetingAt },
    { key: "cps",      label: t("nav.cps"),      href: "cps",      done: !!cps },
    { key: "prd",      label: t("nav.prd"),       href: "prd",      done: !!prd },
    { key: "plan",     label: t("nav.plan"),      href: "plan",     done: !!(design?.plan || design?.architecture) },
    // { key: "code",     label: t("nav.code"),      href: "code",     done: false },
    { key: "sync",     label: t("nav.sync"),      href: "sync",     done: false },
  ];

  return (
    <div className="flex flex-col h-full">
      {isEditing && project && (
        <EditProjectModal
          project={project}
          onSave={handleSaveEdit}
          onClose={() => setIsEditing(false)}
        />
      )}

      {/* Topbar */}
      <div className="bg-white border-b shrink-0">
        <div className="px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-zinc-400">
            <Link href="/dashboard" className="hover:text-zinc-600">{t("home.breadcrumb.dashboard")}</Link>
            <span>/</span>
            <span className="text-zinc-600 font-medium">{project.name}</span>
          </div>
          <div className="flex items-center gap-2">
            {project.githubRepo && (
              <Link href={isSample ? "#" : `/projects/${projectId}/sync`}>
                <Button size="sm" variant="outline" disabled={isSample}>{t("home.syncBtn")}</Button>
              </Link>
            )}
            <Button size="sm" variant="outline" onClick={() => setIsEditing(true)} disabled={isSample}>
              {t("home.editBtn")}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 좌 (2/3): CPS 요약 + 최근 미팅 */}
        <div className="lg:col-span-2 space-y-4">
          {/* CPS 요약 */}
          <div className="bg-white rounded-lg border">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <h2 className="text-sm font-semibold">{t("home.cpsSummary")}</h2>
              {cps && (
                <Link
                  href={`/projects/${projectId}/cps`}
                  className="text-xs text-blue-600 hover:underline"
                >
                  {t("home.viewAll")}
                </Link>
              )}
            </div>
            {cps ? (
              <div className="px-4 py-4 space-y-4">
                <CpsSummarySection
                  color="bg-green-500"
                  label="CONTEXT"
                  content={cps.context?.background ?? cps.context?.environment ?? null}
                  noContentLabel={t("home.noContent")}
                />
                <CpsSummarySection
                  color="bg-orange-500"
                  label="PROBLEM"
                  content={cps.problem?.businessProblem ?? cps.problem?.technicalProblem ?? null}
                  noContentLabel={t("home.noContent")}
                />
                <CpsSummarySection
                  color="bg-purple-500"
                  label="SOLUTION"
                  content={cps.solution?.hypothesis?.content ?? cps.solution?.proposedByClient ?? null}
                  badge={cps.solution?.hypothesis?.confidence ?? null}
                  noContentLabel={t("home.noContent")}
                />
              </div>
            ) : (
              <div className="px-4 py-8 text-center text-zinc-400 text-sm">
                <p>{t("home.noCps")}</p>
                <Link href={isSample ? "#" : `/projects/${projectId}/meetings`}>
                  <Button variant="outline" size="sm" className="mt-3" disabled={isSample}>
                    {t("home.addMeeting")}
                  </Button>
                </Link>
              </div>
            )}
          </div>

          {/* 최근 미팅 */}
          <div className="bg-white rounded-lg border">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <h2 className="text-sm font-semibold">{t("home.recentMeetings")}</h2>
              <Link
                href={`/projects/${projectId}/meetings`}
                className="text-xs text-blue-600 hover:underline"
              >
                {t("home.viewAll")}
              </Link>
            </div>
            {meetings.length > 0 ? (
              <ul className="divide-y">
                {meetings.map((m) => (
                  <li key={m.meetingId}>
                    <Link
                      href={`/projects/${projectId}/meetings`}
                      className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-zinc-50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {m.title ?? m.date}
                        </p>
                        <p className="text-xs text-zinc-400 mt-0.5">
                          {m.participants.length > 0
                            ? m.participants.join(", ")
                            : t("home.noParticipants")}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
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
                {t("home.noMeetings")}
              </div>
            )}
          </div>
        </div>

        {/* 우 (1/3): 프로젝트 정보 + 파이프라인 */}
        <div className="space-y-4">
          {/* 프로젝트 정보 */}
          <div className="bg-white rounded-lg border">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <h2 className="text-sm font-semibold">{t("home.projectInfo")}</h2>
              <ProjectStatusBadge status={project.status} />
            </div>
            <div className="px-4 py-3 space-y-2 text-sm">
              <InfoRow label={t("home.client")} value={project.client} />
              <InfoRow
                label={t("home.startDate")}
                value={new Date(project.createdAt).toLocaleDateString()}
              />
              {cps && (
                <InfoRow label={t("home.cpsVersion")} value={`v${cps.meta.version}`} />
              )}
              {project.description && (
                <p className="text-xs text-zinc-500 pt-1">{project.description}</p>
              )}
            </div>
            <div className="px-4 py-3 border-t">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={handleArchive}
                disabled={isSample}
              >
                {project.status === "active" ? t("archive") : t("unarchive")}
              </Button>
            </div>
          </div>

          {/* 파이프라인 진행 단계 */}
          <div className="bg-white rounded-lg border">
            <div className="px-4 py-3 border-b">
              <h2 className="text-sm font-semibold">{t("home.pipeline")}</h2>
            </div>
            <div className="px-4 py-3 space-y-2">
              {pipelineSteps.map((step, i) => (
                <Link
                  key={step.key}
                  href={`/projects/${projectId}/${step.href}`}
                  className="flex items-center gap-3 py-1 hover:text-blue-600 transition-colors group"
                >
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs shrink-0 ${
                    step.done
                      ? "bg-green-500 text-white"
                      : "bg-zinc-100 text-zinc-400 group-hover:bg-blue-50"
                  }`}>
                    {step.done ? "✓" : i + 1}
                  </div>
                  <span className="text-sm">{step.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}

function CpsSummarySection({
  color, label, content, badge, noContentLabel,
}: {
  color: string;
  label: string;
  content: string | null;
  badge?: string | null;
  noContentLabel: string;
}) {
  return (
    <div className="flex gap-3">
      <div className={`w-1 rounded-full ${color} shrink-0 mt-0.5`} />
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-xs font-bold ${color.replace("bg-", "text-")}`}>
            {label}
          </span>
          {badge && (
            <span className="text-xs bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded-full">
              {badge}
            </span>
          )}
        </div>
        {content ? (
          <p className="text-sm text-zinc-700 line-clamp-2">{content}</p>
        ) : (
          <p className="text-xs text-zinc-400 italic">{noContentLabel}</p>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-xs text-zinc-500">{label}</span>
      <span className="text-xs font-medium text-zinc-700">{value}</span>
    </div>
  );
}
