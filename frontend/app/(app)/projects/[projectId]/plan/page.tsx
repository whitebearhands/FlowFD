"use client";

import { useEffect, useRef, useState, use, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  fetchDesign, generateDesign, exportDesign,
  type Design, type SystemArchitecture, type DataModel, type ApiSpec,
  type FrontendArch, type BackendArch, type SecurityDesign,
  type PerformanceDesign, type DevelopmentPlan, type ApiEndpoint,
} from "@/lib/api/designApi";
import { listenToActiveJob } from "@/lib/firebase/firestore";
import { useAuth } from "@/lib/firebase/useAuth";
import { Download } from "lucide-react";

type Props = { params: Promise<{ projectId: string }> };

type DesignTab =
  | "plan" | "architecture" | "datamodel" | "api" | "frontend" | "backend" | "security" | "performance";

const DESIGN_TAB_IDS: DesignTab[] = [
  "plan", "architecture", "datamodel", "api", "frontend", "backend", "security", "performance",
];

// ─── 공통 헬퍼 ───────────────────────────────────────────────
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white rounded-lg border p-4 ${className}`}>{children}</div>;
}

function CardTitle({ children }: { children: React.ReactNode }) {
  return <p className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-3">{children}</p>;
}

function EmptySection() {
  const t = useTranslations("plan");
  return (
    <div className="flex items-center justify-center py-16 text-zinc-400 text-sm">
      {t("empty")}
    </div>
  );
}

const METHOD_STYLE: Record<string, string> = {
  GET:    "bg-green-100 text-green-700",
  POST:   "bg-blue-100 text-blue-700",
  PATCH:  "bg-orange-100 text-orange-700",
  PUT:    "bg-orange-100 text-orange-700",
  DELETE: "bg-red-100 text-red-700",
};

function ApiTable({ endpoints }: { endpoints: ApiEndpoint[] }) {
  const t = useTranslations("plan");
  return (
    <div className="rounded-lg border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-xs text-zinc-500 uppercase">
          <tr>
            <th className="px-4 py-2.5 font-semibold text-left w-20">{t("table.method")}</th>
            <th className="px-4 py-2.5 font-semibold text-left">{t("table.endpoint")}</th>
            <th className="px-4 py-2.5 font-semibold text-left">{t("table.description")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 bg-white">
          {endpoints.map((ep, i) => (
            <tr key={i} className="hover:bg-zinc-50">
              <td className="px-4 py-2.5">
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${METHOD_STYLE[ep.method?.toUpperCase()] ?? "bg-zinc-100 text-zinc-600"}`}>
                  {ep.method?.toUpperCase()}
                </span>
              </td>
              <td className="px-4 py-2.5 font-mono text-sm text-zinc-700">{ep.path}</td>
              <td className="px-4 py-2.5 text-zinc-600 text-sm">{ep.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── 탭 0: 개발 계획 ─────────────────────────────────────────
function PlanSection({ data }: { data: DevelopmentPlan | null | undefined }) {
  const t = useTranslations("plan");
  if (!data) return <EmptySection />;
  const hasContent = (data.phases?.length ?? 0) + (data.milestones?.length ?? 0) + (data.criticalPath?.length ?? 0) > 0;
  if (!hasContent) return <EmptySection />;

  return (
    <div className="space-y-6">
      {data.phases?.length > 0 && (
        <div className="space-y-4">
          <p className="text-sm font-semibold text-zinc-500 uppercase tracking-wide">{t("section.phases")}</p>
          {data.phases.map((phase, pi) => (
            <Card key={pi}>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                  {pi + 1}
                </span>
                <CardTitle>{phase.phaseName}</CardTitle>
              </div>
              {phase.description && (
                <p className="text-sm text-zinc-600 mb-3">{phase.description}</p>
              )}
              {phase.tasks?.length > 0 && (
                <div className="space-y-2">
                  {phase.tasks.map((task, ti) => (
                    <div key={ti} className="flex gap-3 p-3 rounded-lg bg-zinc-50 border border-zinc-100">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-zinc-800">{task.taskName}</p>
                        {task.description && (
                          <p className="text-sm text-zinc-500 mt-0.5">{task.description}</p>
                        )}
                      </div>
                      {task.dependencies?.length > 0 && (
                        <div className="flex gap-1 flex-wrap shrink-0">
                          {task.dependencies.map((dep, di) => (
                            <span key={di} className="text-xs px-1.5 py-0.5 rounded bg-zinc-200 text-zinc-500 font-mono">
                              {dep}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {data.milestones?.length > 0 && (
          <Card>
            <CardTitle>{t("section.milestones")}</CardTitle>
            <div className="space-y-3">
              {data.milestones.map((m, i) => (
                <div key={i} className="flex gap-3">
                  <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-1.5" />
                  <div>
                    <p className="text-sm font-semibold text-zinc-800">{m.title}</p>
                    {m.description && (
                      <p className="text-sm text-zinc-500 mt-0.5">{m.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {data.criticalPath?.length > 0 && (
          <Card>
            <CardTitle>{t("section.criticalPath")}</CardTitle>
            <ol className="space-y-1.5">
              {data.criticalPath.map((step, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-zinc-600">
                  <span className="text-zinc-400 shrink-0 font-mono text-xs mt-0.5">{i + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </Card>
        )}
      </div>

      {data.notes && (
        <Card>
          <CardTitle>{t("section.notes")}</CardTitle>
          <p className="text-sm text-zinc-600 whitespace-pre-wrap">{data.notes}</p>
        </Card>
      )}
    </div>
  );
}

// ─── 탭 1: 시스템 아키텍처 ──────────────────────────────────
function typeBadgeClass(type: string) {
  const t = type.toLowerCase();
  if (t.includes("frontend") || t.includes("client"))
    return "bg-blue-100 text-blue-800 border border-blue-200";
  if (t.includes("backend") || t.includes("server") || t.includes("api"))
    return "bg-purple-100 text-purple-800 border border-purple-200";
  if (t.includes("database") || t.includes("db") || t.includes("store"))
    return "bg-green-100 text-green-800 border border-green-200";
  if (t.includes("auth")) return "bg-orange-100 text-orange-800 border border-orange-200";
  return "bg-zinc-100 text-zinc-700 border border-zinc-200";
}

function ArchitectureSection({ data }: { data: SystemArchitecture | undefined }) {
  const t = useTranslations("plan");
  if (!data) return <EmptySection />;

  return (
    <div className="space-y-4">
      {data.dataFlow && (
        <Card>
          <CardTitle>{t("section.dataFlow")}</CardTitle>
          <p className="text-sm text-zinc-600 whitespace-pre-wrap">{data.dataFlow}</p>
        </Card>
      )}

      {data.components?.length > 0 && (
        <Card className="p-0 overflow-hidden">
          <div className="px-4 py-3">
            <CardTitle>{t("section.components")}</CardTitle>
          </div>
          <table className="w-full text-sm border-t border-zinc-100">
            <thead className="bg-zinc-50">
              <tr>
                <th className="text-left px-4 py-2 text-xs font-semibold text-zinc-500 w-1/4">{t("table.name")}</th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-zinc-500 w-1/4">{t("table.type")}</th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-zinc-500">{t("table.roleDesc")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {data.components.map((c, i) => (
                <tr key={i} className="hover:bg-zinc-50">
                  <td className="px-4 py-2.5 font-medium text-zinc-800">{c.name}</td>
                  <td className="px-4 py-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeBadgeClass(c.type ?? "")}`}>
                      {c.type}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-zinc-600">{c.description ?? c.responsibility}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4">
        {data.techStack && Object.keys(data.techStack).length > 0 && (
          <Card className="p-0 overflow-hidden">
            <div className="px-4 py-3">
              <CardTitle>{t("section.techStack")}</CardTitle>
            </div>
            <table className="w-full text-sm border-t border-zinc-100">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-zinc-500 w-2/5">{t("table.area")}</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-zinc-500">{t("table.tech")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {Object.entries(data.techStack).map(([k, v]) => (
                  <tr key={k} className="hover:bg-zinc-50">
                    <td className="px-4 py-2 text-zinc-500 text-sm font-medium">{k}</td>
                    <td className="px-4 py-2 text-zinc-800">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
        {data.deployment && Object.keys(data.deployment).length > 0 && (
          <Card className="p-0 overflow-hidden">
            <div className="px-4 py-3">
              <CardTitle>{t("section.deployment")}</CardTitle>
            </div>
            <table className="w-full text-sm border-t border-zinc-100">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-zinc-500 w-2/5">{t("table.area")}</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-zinc-500">{t("table.value")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {Object.entries(data.deployment).map(([k, v]) => (
                  <tr key={k} className="hover:bg-zinc-50">
                    <td className="px-4 py-2 text-zinc-500 text-sm font-medium">{k}</td>
                    <td className="px-4 py-2 text-zinc-800">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>

      {data.designDecisions?.length > 0 && (
        <Card>
          <CardTitle>{t("section.designDecisions")}</CardTitle>
          <div className="divide-y divide-zinc-100">
            {data.designDecisions.map((dec, i) => (
              <div key={i} className="py-3 first:pt-0 last:pb-0">
                <p className="text-sm font-semibold text-blue-700 mb-1">{dec.decision}</p>
                {dec.reason && <p className="text-sm text-zinc-600">{dec.reason}</p>}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── 탭 2: 데이터 모델 ──────────────────────────────────────
function DataModelSection({ data }: { data: DataModel | undefined }) {
  const t = useTranslations("plan");
  if (!data) return <EmptySection />;

  return (
    <div className="space-y-4">
      {data.collections?.length > 0 && (
        <div className="overflow-x-auto">
          <div className="flex gap-4 pb-2 min-w-max">
            {data.collections.map((col, ci) => (
              <div key={ci} className="w-72 rounded-lg border overflow-hidden shrink-0">
                <div className="bg-blue-600 px-3 py-2">
                  <p className="text-sm font-bold text-white font-mono">{col.tableName}</p>
                </div>
                <div className="divide-y divide-zinc-100 bg-white">
                  {(col.columns ?? []).map((f, fi) => {
                    const isPk = f.constraints?.toUpperCase().includes("PRIMARY KEY");
                    const isFk = f.constraints?.toUpperCase().includes("REFERENCES");
                    return (
                      <div key={fi} className="flex items-center gap-1.5 px-3 py-1.5">
                        <span className="font-mono text-sm text-zinc-700 flex-1 truncate">{f.name}</span>
                        <div className="flex gap-1 shrink-0">
                          {isPk && <span className="text-xs px-1 py-0.5 rounded bg-yellow-100 text-yellow-700 font-medium">PK</span>}
                          {isFk && <span className="text-xs px-1 py-0.5 rounded bg-blue-100 text-blue-700 font-medium">FK</span>}
                          {f.type && <span className="text-xs text-zinc-400">{f.type}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {data.relationships?.length > 0 && (
          <Card>
            <CardTitle>{t("table.relations")}</CardTitle>
            <ul className="space-y-1.5">
              {data.relationships.map((r, i) => (
                <li key={i} className="flex items-center gap-1.5 text-sm font-mono text-zinc-600">
                  <span className="text-zinc-700">{r.from ?? "?"}</span>
                  <span className="text-zinc-400">→</span>
                  <span className="text-zinc-700">{r.to ?? "?"}</span>
                  {r.type && (
                    <span className="px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-500 text-xs font-sans ml-1">
                      {r.type}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        )}
        {data.indexes?.length > 0 && (
          <Card>
            <CardTitle>{t("table.indexes")}</CardTitle>
            <ul className="space-y-2">
              {data.indexes.map((idx, i) => (
                <li key={i} className="text-sm text-zinc-600">
                  <span className="font-mono font-medium text-zinc-700">{idx.name}</span>
                  {idx.table && <span className="text-zinc-400"> on {idx.table}</span>}
                  {idx.columns?.length > 0 && (
                    <span className="text-zinc-500"> ({idx.columns.join(", ")})</span>
                  )}
                  {idx.type && (
                    <span className="ml-1 px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-500">{idx.type}</span>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      {data.designNotes && (
        <Card>
          <CardTitle>{t("section.designNotes")}</CardTitle>
          <p className="text-sm text-zinc-600 whitespace-pre-wrap">{data.designNotes}</p>
        </Card>
      )}
    </div>
  );
}

// ─── 탭 3: API 명세 ─────────────────────────────────────────
function ApiSection({ data }: { data: ApiSpec | undefined }) {
  const t = useTranslations("plan");
  const [domainFilter, setDomainFilter] = useState(t("filter.all"));
  if (!data) return <EmptySection />;

  const allLabel = t("filter.all");
  const domains = [allLabel, ...Array.from(new Set((data.endpoints ?? []).map((e) => e.domain ?? "기타").filter(Boolean)))];
  const filtered = (data.endpoints ?? []).filter(
    (e) => domainFilter === allLabel || (e.domain ?? "기타") === domainFilter
  );

  return (
    <div className="space-y-4">
      {data.auth && (
        <Card>
          <CardTitle>{t("section.auth")}</CardTitle>
          <p className="text-sm text-zinc-600">{data.auth}</p>
        </Card>
      )}
      {domains.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {domains.map((dom) => (
            <button
              key={dom}
              type="button"
              onClick={() => setDomainFilter(dom)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                domainFilter === dom
                  ? "bg-zinc-900 text-white border-zinc-900"
                  : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400"
              }`}
            >
              {dom}
            </button>
          ))}
        </div>
      )}
      {filtered.length > 0 && <ApiTable endpoints={filtered} />}
    </div>
  );
}

// ─── 탭 4: 프론트엔드 ───────────────────────────────────────
function FrontendSection({ data }: { data: FrontendArch | undefined }) {
  const t = useTranslations("plan");
  if (!data) return <EmptySection />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {(data.routing?.length > 0 || data.components?.length > 0) && (
          <Card>
            <CardTitle>{t("section.routingComponents")}</CardTitle>
            <div className="space-y-4">
              {data.routing?.length > 0 && (
                <div>
                  <p className="text-xs text-zinc-400 mb-2">{t("section.routing")}</p>
                  <div className="space-y-1">
                    {data.routing.map((r, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="font-mono text-sm text-blue-700 shrink-0">{r.path}</span>
                        <span className="text-sm text-zinc-500">→ {r.component}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {data.components?.length > 0 && (
                <div>
                  <p className="text-xs text-zinc-400 mb-2">{t("section.componentsList")}</p>
                  <div className="space-y-1">
                    {data.components.map((c, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="font-mono text-sm text-zinc-700 shrink-0">{c.name}</span>
                        {c.description && <span className="text-sm text-zinc-500">{c.description}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>
        )}
        {data.stateManagement && (
          <Card>
            <CardTitle>{t("section.stateManagement")}</CardTitle>
            <p className="text-sm text-zinc-600 whitespace-pre-wrap">{data.stateManagement}</p>
          </Card>
        )}
      </div>
      {data.apiDependencies?.length > 0 && (
        <Card>
          <CardTitle>{t("section.apiDeps")}</CardTitle>
          <div className="space-y-1.5">
            {data.apiDependencies.map((dep, i) => (
              <div key={i} className="flex items-center gap-3 text-xs">
                <span className={`font-bold px-2 py-0.5 rounded ${METHOD_STYLE[dep.method?.toUpperCase()] ?? "bg-zinc-100 text-zinc-600"}`}>
                  {dep.method?.toUpperCase()}
                </span>
                <span className="font-mono text-zinc-700">{dep.endpoint}</span>
                {dep.description && <span className="text-zinc-500">{dep.description}</span>}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── 탭 5: 백엔드 ──────────────────────────────────────────
function BackendSection({ data }: { data: BackendArch | undefined }) {
  const t = useTranslations("plan");
  if (!data) return <EmptySection />;

  return (
    <div className="grid grid-cols-2 gap-4">
      {data.layers && (
        <Card>
          <CardTitle>{t("section.layerStructure")}</CardTitle>
          <div className="space-y-4">
            {(["routers", "services", "repositories"] as const).map((layer) => {
              const items = data.layers[layer] ?? [];
              if (!items.length) return null;
              return (
                <div key={layer}>
                  <p className="text-xs font-semibold text-zinc-500 mb-1 capitalize">{layer}</p>
                  <div className="space-y-0.5 pl-2">
                    {items.map((item, i) => (
                      <div key={i}>
                        <span className="font-mono text-sm text-zinc-700">{item.name}</span>
                        {item.description && (
                          <span className="text-sm text-zinc-500 ml-2">{item.description}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <div className="space-y-4">
        {data.jobs?.length > 0 && (
          <Card>
            <CardTitle>{t("section.backgroundJobs")}</CardTitle>
            <ul className="space-y-2">
              {data.jobs.map((j, i) => (
                <li key={i}>
                  <span className="font-mono text-sm text-zinc-700">{j.name}</span>
                  {j.schedule && <span className="text-sm text-zinc-500 ml-2">{j.schedule}</span>}
                  {j.description && <p className="text-sm text-zinc-500 mt-0.5">{j.description}</p>}
                </li>
              ))}
            </ul>
          </Card>
        )}
        {data.externalIntegrations?.length > 0 && (
          <Card>
            <CardTitle>{t("section.externalIntegrations")}</CardTitle>
            <ul className="space-y-2">
              {data.externalIntegrations.map((ig, i) => (
                <li key={i}>
                  <span className="font-mono text-sm text-zinc-700">{ig.name}</span>
                  {ig.description && <p className="text-sm text-zinc-500 mt-0.5">{ig.description}</p>}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}

// ─── 탭 6: 보안 ────────────────────────────────────────────
function SecuritySection({ data }: { data: SecurityDesign | undefined }) {
  const t = useTranslations("plan");
  if (!data) return <EmptySection />;

  const sections: { title: string; key: keyof SecurityDesign }[] = [
    { title: t("security.authentication"), key: "authentication" },
    { title: t("security.authorization"), key: "authorization" },
    { title: t("security.dataProtection"), key: "dataProtection" },
    { title: t("security.apiSecurity"), key: "apiSecurity" },
  ];

  return (
    <div className="grid grid-cols-2 gap-4">
      {sections.map(({ title, key }) => {
        const detail = data[key];
        if (!detail?.details) return null;
        return (
          <Card key={key}>
            <CardTitle>{title}</CardTitle>
            <p className="text-sm text-zinc-600 whitespace-pre-wrap">{detail.details}</p>
          </Card>
        );
      })}
    </div>
  );
}

// ─── 탭 7: 성능/캐싱 ──────────────────────────────────────
function PerformanceSection({ data }: { data: PerformanceDesign | undefined }) {
  const t = useTranslations("plan");
  if (!data) return <EmptySection />;

  return (
    <div className="space-y-4">
      {data.caching?.length > 0 && (
        <Card>
          <CardTitle>{t("section.caching")}</CardTitle>
          <div className="divide-y divide-zinc-100">
            {data.caching.map((item, i) => (
              <div key={i} className="py-3 first:pt-0 last:pb-0">
                <p className="text-sm font-semibold text-zinc-700 mb-1">{item.strategy}</p>
                {item.description && <p className="text-sm text-zinc-500 mb-1">{item.description}</p>}
                {item.implementationDetails && (
                  <p className="text-sm text-zinc-600 bg-zinc-50 rounded px-2 py-1">{item.implementationDetails}</p>
                )}
                {item.cacheInvalidation && (
                  <p className="text-sm text-zinc-400 mt-1">{t("performance.expire")} {item.cacheInvalidation}</p>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4">
        {data.queryOptimization?.length > 0 && (
          <Card>
            <CardTitle>{t("section.queryOptimization")}</CardTitle>
            <div className="space-y-3">
              {data.queryOptimization.map((item, i) => (
                <div key={i}>
                  <p className="text-sm font-semibold text-zinc-600 mb-0.5">{item.queryType}</p>
                  <p className="text-sm text-zinc-500">{item.optimization}</p>
                  {item.details && <p className="text-sm text-zinc-400 mt-0.5">{item.details}</p>}
                </div>
              ))}
            </div>
          </Card>
        )}
        {data.bottlenecks?.length > 0 && (
          <Card>
            <CardTitle>{t("section.bottlenecks")}</CardTitle>
            <div className="space-y-3">
              {data.bottlenecks.map((item, i) => (
                <div key={i}>
                  <p className="text-sm font-semibold text-zinc-600 mb-0.5">{item.component}</p>
                  {item.description && <p className="text-sm text-zinc-500">{item.description}</p>}
                  {item.mitigation && (
                    <p className="text-sm text-blue-600 mt-0.5">{t("performance.mitigation")} {item.mitigation}</p>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {data.scaling && (
        <Card>
          <CardTitle>{t("section.scaling")}</CardTitle>
          <p className="text-sm text-zinc-600 whitespace-pre-wrap">{data.scaling}</p>
        </Card>
      )}
    </div>
  );
}

// ─── 기술 스택 입력 폼 ────────────────────────────────────────
function TechStackForm({
  onGenerate, isGenerating, isSample
}: {
  onGenerate: (stack: { frontend: string; backend: string; database: string }, constraints: string[]) => void;
  isGenerating: boolean;
  isSample: boolean;
}) {
  const t = useTranslations("plan");
  const [frontend, setFrontend] = useState("Next.js");
  const [backend, setBackend]   = useState("FastAPI");
  const [database, setDatabase] = useState("Firestore");
  const [constraints, setConstraints] = useState("");

  return (
    <div className="space-y-4 max-w-lg">
      <div className="space-y-2">
        <Label>{t("design.techStack")}</Label>
        <div className="grid grid-cols-3 gap-2">
          <Input placeholder="Frontend" value={frontend} onChange={(e) => setFrontend(e.target.value)} />
          <Input placeholder="Backend"  value={backend}  onChange={(e) => setBackend(e.target.value)} />
          <Input placeholder="Database" value={database} onChange={(e) => setDatabase(e.target.value)} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>{t("design.constraints")}</Label>
        <Textarea
          placeholder={t("design.constraintsPlaceholder")}
          value={constraints}
          onChange={(e) => setConstraints(e.target.value)}
          rows={2}
          className="resize-none"
        />
      </div>
      <Button
        onClick={() => {
          const list = constraints.split(",").map((c) => c.trim()).filter(Boolean);
          onGenerate({ frontend, backend, database }, list);
        }}
        disabled={isGenerating || isSample}
      >
        {isGenerating ? t("design.generating") : t("design.generate")}
      </Button>
    </div>
  );
}

// ─── 메인 ─────────────────────────────────────────────────────
export default function PlanPage({ params }: Props) {
  const { projectId } = use(params);
  const t = useTranslations("plan");
  const { groupId } = useAuth();

  const [design, setDesign] = useState<Design | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<DesignTab>("plan");
  const [isGenerating, setIsGenerating] = useState(false);
  const [showRegenForm, setShowRegenForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wasGeneratingRef = useRef(false);
  const isSample = projectId.startsWith("sample-");

  const load = useCallback(() => {
    fetchDesign(projectId)
      .then(setDesign)
      .catch(() => setDesign({ plan: null, architecture: null, updatedAt: null }))
      .finally(() => setIsLoading(false));
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!groupId) return;
    const unsub = listenToActiveJob(groupId, projectId, "design_generation", (isActive) => {
      if (!isActive && wasGeneratingRef.current) {
        load();
        setShowRegenForm(false);
      }
      wasGeneratingRef.current = isActive;
      setIsGenerating(isActive);
    });
    return unsub;
  }, [groupId, projectId, load]);

  async function handleGenerate(
    stack: { frontend: string; backend: string; database: string },
    constraints: string[]
  ) {
    setError(null);
    try {
      await generateDesign(projectId, { tech_stack: stack, constraints });
    } catch {
      setError(t("error.failed"));
      setIsGenerating(false);
    }
  }

  if (isLoading) return (
    <div className="flex justify-center py-16">
      <div className="w-6 h-6 border-2 border-zinc-300 border-t-zinc-700 rounded-full animate-spin" />
    </div>
  );

  const hasDesign = !!(design?.plan || design?.architecture);

  const arch = design?.architecture;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 설계 탭 바 */}
      <div className="bg-white border-b shrink-0">
        <div className="flex items-center justify-between px-6 pt-3">
          <div className="flex gap-0 -mb-px overflow-x-auto">
            {DESIGN_TAB_IDS.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === id && hasDesign
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-zinc-500 hover:text-zinc-700"
                }`}
              >
                {t(`tabs.${id}`)}
              </button>
            ))}
          </div>
          <div className="flex gap-2 pb-2">
            {hasDesign && !showRegenForm && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportDesign(projectId)}
                  className="flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  {t("toolbar.export")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowRegenForm(true)}
                  disabled={isGenerating || isSample}
                >
                  {t("design.regenerate")}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 배너 */}
      {error && (
        <div className="mx-6 mt-3 px-4 py-2 rounded-md bg-red-50 border border-red-200 text-sm text-red-700 shrink-0">
          {error}
        </div>
      )}
      {isGenerating && (
        <div className="mx-6 mt-3 px-4 py-2 rounded-md bg-blue-50 border border-blue-200 text-sm text-blue-700 flex items-center gap-2 shrink-0">
          <span className="w-3 h-3 border-2 border-blue-400 border-t-blue-700 rounded-full animate-spin" />
          {t("design.generating")}
          <span className="text-xs text-blue-500 ml-1">{t("error.timeNote")}</span>
        </div>
      )}

      {/* 콘텐츠 */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {showRegenForm || !hasDesign ? (
          <div>
            {!hasDesign && (
              <p className="text-zinc-500 text-sm mb-6">{t("design.noData")}</p>
            )}
            {showRegenForm && (
              <p className="text-sm font-medium text-zinc-700 mb-4">
                {t("design.regenerate")} — {t("regenTitle")}
              </p>
            )}
            {!hasDesign && !isGenerating && (
              <TechStackForm onGenerate={handleGenerate} isGenerating={isGenerating} isSample={isSample} />
            )}
            {showRegenForm && (
              <TechStackForm onGenerate={handleGenerate} isGenerating={isGenerating} isSample={isSample} />
            )}
            {showRegenForm && (
              <Button
                variant="ghost" size="sm"
                className="mt-3 text-zinc-500"
                onClick={() => setShowRegenForm(false)}
              >
                {t("cancel")}
              </Button>
            )}
          </div>
        ) : (
          <>
            {activeTab === "plan"         && <PlanSection         data={design?.plan} />}
            {activeTab === "architecture" && <ArchitectureSection data={arch?.systemArchitecture} />}
            {activeTab === "datamodel"    && <DataModelSection    data={arch?.dataModel} />}
            {activeTab === "api"          && <ApiSection          data={arch?.apiSpec} />}
            {activeTab === "frontend"     && <FrontendSection     data={arch?.frontendArch} />}
            {activeTab === "backend"      && <BackendSection      data={arch?.backendArch} />}
            {activeTab === "security"     && <SecuritySection     data={arch?.securityDesign} />}
            {activeTab === "performance"  && <PerformanceSection  data={arch?.performanceDesign} />}
          </>
        )}
      </div>
    </div>
  );
}
