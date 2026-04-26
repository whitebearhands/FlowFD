"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { fetchProject } from "@/lib/api/projectApi";
import { Project } from "@/types/project";
import JobStatusPanel from "@/components/project/JobStatusPanel";

type Props = {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
};

export default function ProjectLayout({ children, params }: Props) {
  const { projectId } = use(params);
  const pathname = usePathname();
  const t = useTranslations("project");
  const [project, setProject] = useState<Project | null>(null);

  useEffect(() => {
    fetchProject(projectId).then(setProject).catch(() => {});
  }, [projectId]);

  const tabs = [
    { href: `/projects/${projectId}`, label: t("nav.home"), exact: true },
    { href: `/projects/${projectId}/meetings`, label: t("nav.meetings") },
    { href: `/projects/${projectId}/cps`, label: "CPS" },
    { href: `/projects/${projectId}/prd`, label: "PRD" },
    { href: `/projects/${projectId}/plan`, label: t("nav.plan") },
    //{ href: `/projects/${projectId}/code`, label: t("nav.code") },
  ];

  function isActive(tab: { href: string; exact?: boolean }) {
    if (tab.exact) return pathname === tab.href;
    return pathname.startsWith(tab.href);
  }

  return (
    <div className="flex flex-col h-full">
      {/* 프로젝트 헤더 */}
      <div className="bg-white border-b shrink-0">
        {/* 브레드크럼 + 프로젝트명 */}
        <div className="px-6 pt-4 pb-0">
          <div className="flex items-center gap-1.5 text-xs text-zinc-400 mb-1">
            <Link href="/dashboard" className="hover:text-zinc-600">{t("home.breadcrumb.dashboard")}</Link>
            <span>/</span>
            <span className="text-zinc-600 font-medium">
              {project?.name ?? "..."}
            </span>
            {project?.client && (
              <span className="text-zinc-400">— {project.client}</span>
            )}
          </div>
          {/* 탭 */}
          <nav className="-mb-px flex gap-0">
            {tabs.map((tab) => {
              const active = isActive(tab);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    active
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300"
                  }`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* 탭 콘텐츠 */}
      <div className="flex-1 overflow-auto">
        {children}
      </div>
      
      <JobStatusPanel projectId={projectId} />
    </div>
  );
}
