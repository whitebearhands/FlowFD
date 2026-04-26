export type Confidence = "suspected" | "probable" | "confirmed";
export type CpsChangeType = "auto" | "manual_edit";

export type CpsMeta = {
  projectId: string;
  client: string;
  version: string;
  lastUpdated: string;
  sourceMeetings: string[];
  changeType: CpsChangeType;
};

export type CpsContext = {
  background: string | null;
  environment: string | null;
  stakeholders: string | null;
  constraints: string | null;
};

export type CpsProblem = {
  businessProblem: string | null;
  technicalProblem: string | null;
  impact: string | null;
  rootCause: {
    content: string | null;
    confidence: Confidence | null;
  } | null;
};

export type CpsSolution = {
  proposedByClient: string | null;
  proposedByFde: string | null;
  hypothesis: {
    content: string | null;
    confidence: Confidence | null;
  } | null;
  successCriteria: string | null;
};

export type CpsAssumption = {
  content: string;
  riskIfWrong: string;
};

export type CpsRisks = {
  technical: string[];
  business: string[];
};

export type CpsPending = {
  insights: string[];
  questions: string[];
  solutionIdeas: string[];
};

export type CpsDecisionLogEntry = {
  meetingId: string;
  changed: string;
  reason: string;
};

export type CpsDocument = {
  meta: CpsMeta;
  context: CpsContext;
  problem: CpsProblem;
  solution: CpsSolution;
  assumptions: CpsAssumption[];
  outOfScope: string[];
  risks: CpsRisks;
  pending: CpsPending;
  decisionLog: CpsDecisionLogEntry[];
};

export type CpsVersion = {
  version: string;
  changedFields: string[];
  sourceMeetingId: string | null;
  changeType: CpsChangeType;
  createdAt: string;
};

export type UpdateCpsRequest = {
  fieldPath: string;
  value: unknown;
  reason?: string | null;
};
