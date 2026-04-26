import apiClient from "./client";

// ─── Design section types (camelCase — axios interceptor 적용됨) ──────────────

export type DesignComponent = {
  name: string;
  type: string;
  description: string;
  responsibility: string;
};

export type DesignDecision = {
  decision: string;
  reason: string;
};

export type SystemArchitecture = {
  components: DesignComponent[];
  dataFlow: string;
  techStack: Record<string, string>;
  deployment: Record<string, string>;
  designDecisions: DesignDecision[];
};

export type DataModelField = {
  name: string;
  type: string;
  constraints: string;
  description: string;
};

export type DataModelTable = {
  tableName: string;
  columns: DataModelField[];
};

export type DataModelRelationship = {
  from: string;
  to: string;
  type: string;
};

export type DataModelIndex = {
  name: string;
  table: string;
  columns: string[];
  type: string;
};

export type DataModel = {
  collections: DataModelTable[];
  relationships: DataModelRelationship[];
  indexes: DataModelIndex[];
  designNotes: string;
};

export type ApiEndpoint = {
  method: string;
  path: string;
  description: string;
  domain: string;
};

export type ApiSpec = {
  endpoints: ApiEndpoint[];
  auth: string;
};

export type FrontendRoute = {
  path: string;
  component: string;
  description: string;
};

export type FrontendComponentDef = {
  name: string;
  description: string;
};

export type ApiDependency = {
  endpoint: string;
  method: string;
  description: string;
};

export type FrontendArch = {
  routing: FrontendRoute[];
  components: FrontendComponentDef[];
  stateManagement: string;
  apiDependencies: ApiDependency[];
};

export type BackendLayerItem = {
  name: string;
  description: string;
};

export type BackendLayers = {
  routers: BackendLayerItem[];
  services: BackendLayerItem[];
  repositories: BackendLayerItem[];
};

export type BackendJob = {
  name: string;
  schedule: string;
  description: string;
};

export type BackendIntegration = {
  name: string;
  description: string;
};

export type BackendArch = {
  layers: BackendLayers;
  jobs: BackendJob[];
  externalIntegrations: BackendIntegration[];
};

export type SecurityDetail = { details: string };

export type SecurityDesign = {
  authentication: SecurityDetail;
  authorization: SecurityDetail;
  dataProtection: SecurityDetail;
  apiSecurity: SecurityDetail;
};

export type CachingItem = {
  strategy: string;
  description: string;
  implementationDetails: string;
  cacheInvalidation: string;
};

export type QueryOptItem = {
  queryType: string;
  optimization: string;
  details: string;
};

export type BottleneckItem = {
  component: string;
  description: string;
  mitigation: string;
};

export type PerformanceDesign = {
  caching: CachingItem[];
  queryOptimization: QueryOptItem[];
  scaling: string;
  bottlenecks: BottleneckItem[];
};

export type DesignArchitecture = {
  systemArchitecture?: SystemArchitecture;
  dataModel?: DataModel;
  apiSpec?: ApiSpec;
  frontendArch?: FrontendArch;
  backendArch?: BackendArch;
  securityDesign?: SecurityDesign;
  performanceDesign?: PerformanceDesign;
};

// ─── 개발 계획 타입 ───────────────────────────────────────────────────────────

export type PlanTask = {
  taskName: string;
  description: string;
  dependencies: string[];
};

export type PlanPhase = {
  phaseName: string;
  description: string;
  tasks: PlanTask[];
};

export type Milestone = {
  title: string;
  description: string;
};

export type DevelopmentPlan = {
  phases: PlanPhase[];
  milestones: Milestone[];
  criticalPath: string[];
  notes: string;
};

// ─── API 타입 ─────────────────────────────────────────────────────────────────

export type Design = {
  plan: DevelopmentPlan | null;
  architecture: DesignArchitecture | null;
  updatedAt: string | null;
};

export type GenerateDesignRequest = {
  tech_stack: { frontend: string; backend: string; database: string };
  constraints: string[];
};

// ─── API 함수 ─────────────────────────────────────────────────────────────────

export async function fetchDesign(projectId: string): Promise<Design> {
  const res = await apiClient.get<Design>(`/projects/${projectId}/design`);
  return res.data;
}

export async function generateDesign(
  projectId: string,
  data: GenerateDesignRequest
): Promise<{ jobId: string; status: string }> {
  const res = await apiClient.post(`/projects/${projectId}/design/generate`, data);
  return res.data;
}

export async function updateDesign(
  projectId: string,
  data: Partial<Pick<Design, "plan" | "architecture">>
): Promise<void> {
  await apiClient.patch(`/projects/${projectId}/design`, data);
}

export async function exportDesign(projectId: string): Promise<void> {
  const res = await apiClient.get(`/projects/${projectId}/design/export`, {
    responseType: "blob",
  });
  const disposition = res.headers["content-disposition"] ?? "";
  let filename = "design.md";

  if (disposition.includes("filename*=")) {
    const parts = disposition.split("filename*=");
    const filenamePart = parts[1].split(";")[0];
    const encodedName = filenamePart.replace(/UTF-8''/i, "");
    filename = decodeURIComponent(encodedName);
  } else {
    const match = disposition.match(/filename="?([^"]+)"?/);
    if (match) filename = match[1];
  }

  let blob: Blob;
  if (res.data instanceof Blob) {
    blob = res.data;
  } else if (typeof res.data === "object" && res.data !== null) {
    const content = (res.data as Record<string, unknown>).content ?? res.data;
    const stringData = typeof content === "string" ? content : JSON.stringify(content);
    blob = new Blob([stringData], { type: "text/markdown; charset=utf-8" });
  } else {
    blob = new Blob([res.data as BlobPart], { type: "text/markdown; charset=utf-8" });
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** 설계 문서가 생성될 때까지 최대 maxWaitMs 동안 폴링한다. */
export async function pollDesign(
  projectId: string,
  checkFn: (d: Design) => boolean,
  intervalMs = 3000,
  maxWaitMs = 120_000
): Promise<Design | null> {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, intervalMs));
    try {
      const d = await fetchDesign(projectId);
      if (checkFn(d)) return d;
    } catch {
      // 아직 없으면 계속 폴링
    }
  }
  return null;
}
