export type PrdChangeType = "auto" | "manual_edit";

export type PrdVersion = {
  version: string;
  sourceCpsVersion: string;
  changeType: PrdChangeType;
  createdAt: string;
};

export type Prd = {
  version: string;
  content: PrdContent;
  sourceCpsVersion: string;
  changeType: PrdChangeType;
  createdAt: string;
};

export type UpdatePrdRequest = {
  section: string;
  content: string;
  reason?: string | null;
};

// ── 구조화된 PRD 데이터 타입 (camelCase — axios interceptor 적용됨) ──

export type PrdSuccessMetric = {
  metric: string;
  before: string;
  after: string;
};

export type PrdGoals = {
  businessGoals: string[];
  successMetrics: PrdSuccessMetric[];
};

export type PrdUser = {
  type: string;
  goal: string;
  pain: string;
  frequency: string;
};

export type PrdScopeItem = {
  frId: string;
  description: string;
  priority: string;
};

export type PrdScope = {
  inScope: PrdScopeItem[];
  outOfScope: string[];
};

export type FrPriority = "Must" | "Should" | "Could";

export type PrdFeature = {
  id: string;
  title: string;
  description: string;
  priority: FrPriority;
};

export type PrdRisk = {
  description: string;
  frIds: string[];
};

export type PrdNonFunctional = {
  category: string;
  requirement: string;
  metric: string;
};

export type PrdContent = {
  overview?: string;
  goals?: PrdGoals;
  users?: PrdUser[];
  scope?: PrdScope;
  features?: PrdFeature[];
  nonFunctional?: PrdNonFunctional[];
  risks?: PrdRisk[];
  openQuestions?: string[];
};
