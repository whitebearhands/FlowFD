import Link from "next/link";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ProjectStatusBadge from "./ProjectStatusBadge";
import { Project } from "@/types/project";

type Props = {
  project: Project;
  meetingCount?: number;
  cpsVersion?: string | null;
  prdVersion?: string | null;
  designVersion?: string | null;
};

export default function ProjectCard({ project, meetingCount, cpsVersion, prdVersion, designVersion }: Props) {
  const t = useTranslations("project");

  return (
    <Link href={`/projects/${project.projectId}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base leading-tight">{project.name}</CardTitle>
            <ProjectStatusBadge status={project.status} />
          </div>
          <p className="text-sm text-zinc-500">{project.client}</p>
        </CardHeader>
        <CardContent className="pt-0 space-y-2">
          {project.description && (
            <p className="text-sm text-zinc-600 line-clamp-2">{project.description}</p>
          )}

          {/* 버전 배지 */}
          {(cpsVersion || prdVersion || designVersion) && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {cpsVersion && (
                <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-medium">
                  CPS {cpsVersion}
                </span>
              )}
              {prdVersion && (
                <span className="text-xs bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded font-medium">
                  PRD {prdVersion}
                </span>
              )}
              {designVersion && (
                <span className="text-xs bg-violet-50 text-violet-600 px-1.5 py-0.5 rounded font-medium">
                  Design {designVersion}
                </span>
              )}
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-zinc-400">
            {meetingCount !== undefined && (
              <span>{meetingCount}개 미팅</span>
            )}
            <span>
              {project.lastMeetingAt
                ? `${t("lastMeeting")}: ${new Date(project.lastMeetingAt).toLocaleDateString()}`
                : t("noMeetingYet")}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
