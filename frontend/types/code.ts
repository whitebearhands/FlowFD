export type LintStatus = "pending" | "passed" | "failed";
export type CodeTarget = "module" | "component" | "function";

export type LintIssue = {
  rule: string;
  line: number;
  message: string;
  fixed: boolean;
};

export type LintReport = {
  issues: LintIssue[];
};

export type Code = {
  codeId: string;
  target: CodeTarget;
  targetName: string;
  content: string;
  llmModel: string;
  lintStatus: LintStatus;
  lintReport: LintReport | null;
  createdAt: string;
};

export type GenerateCodeRequest = {
  target: CodeTarget;
  targetName: string;
  llmModel?: string | null;
};

export type GenerateCodeResponse = {
  jobId: string;
  status: "processing";
};
