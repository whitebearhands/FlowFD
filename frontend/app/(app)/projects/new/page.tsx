"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import ProjectForm from "@/components/project/ProjectForm";
import { createProject } from "@/lib/api/projectApi";
import { CreateProjectRequest } from "@/types/project";

export default function NewProjectPage() {
  const t = useTranslations("project");
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(data: CreateProjectRequest, addFirstMeeting: boolean) {
    setIsLoading(true);
    try {
      const result = await createProject(data);
      if (addFirstMeeting) {
        router.push(`/projects/${result.projectId}/meetings/new`);
      } else {
        router.push(`/projects/${result.projectId}`);
      }
    } finally {
      setIsLoading(false);
    }
  }

  function handleCancel() {
    router.push("/dashboard");
  }

  return (
    <div className="flex flex-col h-full">
      {/* Topbar */}
      <div className="bg-white border-b shrink-0">
        <div className="px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-zinc-400">
            <Link href="/dashboard" className="hover:text-zinc-600">
              {t("dashboard.title")}
            </Link>
            <span>/</span>
            <span className="text-zinc-600 font-medium">{t("form.pageTitle")}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleCancel} disabled={isLoading}>
              {t("form.cancel")}
            </Button>
            <Button size="sm" form="project-form" type="submit" disabled={isLoading}>
              {isLoading ? t("form.submitting") : t("form.submit")}
            </Button>
          </div>
        </div>
      </div>

      {/* 콘텐츠 */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-2xl mx-auto px-6 py-8">
          <Card>
            <CardHeader>
              <CardTitle>{t("form.pageTitle")}</CardTitle>
              <CardDescription>{t("form.subtitle")}</CardDescription>
            </CardHeader>
            <CardContent>
              <ProjectForm
                onSubmit={handleSubmit}
                onCancel={handleCancel}
                isLoading={isLoading}
                formId="project-form"
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
