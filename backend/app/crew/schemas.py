"""
LangGraph 파이프라인 스키마.
PipelineState: TypedDict (LangGraph State)
나머지: Pydantic 모델 (API 입출력)
"""

from typing import Literal, TypedDict

from pydantic import BaseModel, Field


# ─────────────────────────────────────────
# LangGraph State
# ─────────────────────────────────────────


class PipelineState(TypedDict, total=False):
    # ── 입력
    job_id: str
    project_id: str
    user_id: str
    group_id: str
    meeting_id: str
    new_meeting: str
    existing_cps: dict | None
    meeting_summaries: list[str]
    analysis_mode: str  # "smart" | "full"
    output_language: str  # "한국어" | "English" | ...

    # ── Phase 1 결과
    cleaned_transcript: str
    extracted_facts: dict
    sentiment_report: dict

    # ── Phase 2 결과
    context_draft: dict
    problem_draft: dict
    technical_draft: dict
    solution_draft: dict
    validated_cps: dict
    cps_score: int

    # ── Phase 3 결과
    goals_draft: dict
    users_draft: dict
    scope_draft: dict
    features_draft: dict
    nonfunc_draft: dict
    risks_draft: dict
    validated_prd: dict

    # ── Phase 4 결과
    system_architecture: dict
    data_model: dict
    api_spec: dict
    frontend_arch: dict
    backend_arch: dict
    security_design: dict
    performance_design: dict
    validated_design: dict

    # ── 제어
    retry_count: dict
    pending_questions: list[str]
    issues: list[dict]
    error: str | None


# ─────────────────────────────────────────
# Critic 이슈 타입
# ─────────────────────────────────────────

IssueType = Literal[
    "insufficient_data",
    "quality_issue",
    "consistency_error",
    "scope_creep",
    "system_error",
]

IssueSeverity = Literal["block", "warn", "info"]


class CriticIssue(BaseModel):
    type: IssueType
    severity: IssueSeverity
    field: str
    description: str
    phase: str = ""  # "cps" | "prd" | "design"
    affected_nodes: list[str] = []
    move_to_pending: bool = False


# ─────────────────────────────────────────
# API 입력 스키마
# ─────────────────────────────────────────


class MeetingAnalysisInput(BaseModel):
    job_id: str
    project_id: str
    user_id: str
    group_id: str
    meeting_id: str
    new_meeting: str
    existing_cps: dict | None = None
    meeting_summaries: list[str] = []
    analysis_mode: Literal["smart", "full"] = "smart"


class PrdGenerationInput(BaseModel):
    job_id: str
    project_id: str
    user_id: str
    group_id: str
    validated_cps: dict


class DesignGenerationInput(BaseModel):
    job_id: str
    project_id: str
    user_id: str
    group_id: str
    validated_cps: dict
    validated_prd: dict


# ─────────────────────────────────────────
# Firestore Job 상태 스키마
# ─────────────────────────────────────────

JobStatus = Literal["pending", "processing", "completed", "failed"]
JobType = Literal["cps_analysis", "prd_generation", "design_generation"]


class JobState(BaseModel):
    job_id: str
    type: JobType
    status: JobStatus
    analysis_mode: Literal["smart", "full"] | None = None
    current_layer: int = 0
    total_layers: int = 0
    current_node: str | None = None
    completed_nodes: list[str] = []
    issues: list[dict] = []
    pending_added: list[str] = []
    coins_used: int = 0
    error: str | None = None


# ─────────────────────────────────────────
# 재시도 정책
# ─────────────────────────────────────────

RETRY_POLICY: dict[str, dict] = {
    "insufficient_data": {"retry": False, "action": "move_to_pending"},
    "quality_issue": {"retry": True, "max_retries": 2, "fallback": "downgrade_to_warn"},
    "consistency_error": {"retry": True, "max_retries": 2},
    "system_error": {"retry": True, "max_retries": 3, "backoff": "exponential"},
    "scope_creep": {"retry": False, "action": "delete_and_log"},
}


# ─────────────────────────────────────────
# 노드 출력 스키마 (with_structured_output용)
# response_schema로 변환되어 토큰 레벨에서 구조 강제
# ─────────────────────────────────────────

# ── Phase 2 출력 ──────────────────────────

class RootCause(BaseModel):
    content: str | None = None
    confidence: Literal["suspected", "probable", "confirmed"] | None = None

class ContextDraftOutput(BaseModel):
    background: str | None = None
    environment: str | None = None
    stakeholders: str | None = None
    constraints: str | None = None

class ProblemDraftOutput(BaseModel):
    business_problem: str | None = None
    technical_problem: str | None = None
    impact: str | None = None
    root_cause: RootCause | None = None

class TechnicalDraftOutput(BaseModel):
    technical_problem: str | None = None
    root_cause: RootCause | None = None

class Hypothesis(BaseModel):
    content: str | None = None
    confidence: Literal["suspected", "probable", "confirmed"] | None = None

class SolutionSection(BaseModel):
    proposed_by_client: str | None = None
    proposed_by_fde: str | None = None
    hypothesis: Hypothesis | None = None
    success_criteria: str | None = None

class Assumption(BaseModel):
    content: str | None = None
    risk_if_wrong: str | None = None

class Risks(BaseModel):
    technical: list[str] = []
    business: list[str] = []

class Pending(BaseModel):
    insights: list[str] = []
    questions: list[str] = []
    solution_ideas: list[str] = []

class SolutionDraftOutput(BaseModel):
    solution: SolutionSection | None = None
    assumptions: list[Assumption] = []
    out_of_scope: list[str] = []
    risks: Risks | None = None
    pending: Pending | None = None

class DecisionLog(BaseModel):
    meeting_id: str | None = None
    changed: str | None = None
    reason: str | None = None

class ValidatedCps(BaseModel):
    meta: dict | None = None
    context: ContextDraftOutput | None = None
    problem: ProblemDraftOutput | None = None
    solution: SolutionSection | None = None
    assumptions: list[Assumption] = []
    out_of_scope: list[str] = []
    risks: Risks | None = None
    pending: Pending | None = None
    decision_log: list[DecisionLog] = []

class CpsCriticOutput(BaseModel):
    passed: bool = False
    overall_score: int = 0
    issues: list[CriticIssue] = []
    suggested_questions: list[str] = []
    validated_cps: ValidatedCps | None = None


# ── Phase 1 출력 ──────────────────────────

class FactExtractorOutput(BaseModel):
    numbers: list[str] = []
    systems: list[str] = []
    explicit_facts: list[str] = []


class SentimentAnalyzerOutput(BaseModel):
    strong_demands: list[str] = []
    concerns: list[str] = []
    expectations: list[str] = []


# ── Phase 3 출력 ──────────────────────────

class SuccessMetric(BaseModel):
    metric: str = ""
    before: str = ""
    after: str = ""


class GoalOutput(BaseModel):
    business_goals: list[str] = []
    success_metrics: list[SuccessMetric] = []


class UserOutput(BaseModel):
    type: str = ""
    goal: str = ""
    pain: str = ""
    frequency: str = ""


class UsersOutput(BaseModel):
    users: list[UserOutput] = []


class ScopeItem(BaseModel):
    fr_id: str = ""
    description: str = ""
    priority: str = ""


class ScopeOutput(BaseModel):
    in_scope: list[ScopeItem] = []
    out_of_scope: list[str] = []


class FeatureOutput(BaseModel):
    id: str = ""
    title: str = ""
    description: str = ""
    priority: Literal["Must", "Should", "Could"] = "Should"


class FeaturesOutput(BaseModel):
    features: list[FeatureOutput] = []


class NonfuncItem(BaseModel):
    category: str = ""
    requirement: str = ""
    metric: str = ""


class NonfuncOutput(BaseModel):
    non_functional: list[NonfuncItem] = []


class RiskItem(BaseModel):
    description: str = ""
    fr_ids: list[str] = []


class RisksAndQuestionsOutput(BaseModel):
    risks: list[RiskItem] = []
    open_questions: list[str] = []


# ── Phase 3 출력 ──────────────────────────

class ValidatedPrd(BaseModel):
    overview: str | None = None
    goals: GoalOutput | None = None
    users: list[UserOutput] = []
    scope: ScopeOutput | None = None
    features: list[FeatureOutput] = []
    non_functional: list[NonfuncItem] = []
    risks: list[RiskItem] = []
    open_questions: list[str] = []

class PrdCriticOutput(BaseModel):
    passed: bool = False
    issues: list[CriticIssue] = []
    validated_prd: ValidatedPrd | None = None

# ── Phase 4 출력 ──────────────────────────

class ComponentOutput(BaseModel):
    name: str = ""
    type: str = ""
    description: str = ""
    responsibility: str = ""


class DesignDecision(BaseModel):
    decision: str = ""
    reason: str = ""


class SystemArchitectureOutput(BaseModel):
    components: list[ComponentOutput] = []
    data_flow: str = ""
    tech_stack: dict[str, str] = {}
    deployment: dict[str, str] = {}
    design_decisions: list[DesignDecision] = []


class FieldOutput(BaseModel):
    name: str = ""
    type: str = ""
    constraints: str = ""
    description: str = ""


class TableOutput(BaseModel):
    table_name: str = ""
    columns: list[FieldOutput] = []


class RelationshipOutput(BaseModel):
    from_: str = Field(default="", alias="from")
    to: str = ""
    type: str = ""

    model_config = {"populate_by_name": True}


class IndexOutput(BaseModel):
    name: str = ""
    table: str = ""
    columns: list[str] = []
    type: str = ""


class DataModelOutput(BaseModel):
    collections: list[TableOutput] = []
    relationships: list[RelationshipOutput] = []
    indexes: list[IndexOutput] = []
    design_notes: str = ""


class EndpointOutput(BaseModel):
    method: str = ""
    path: str = ""
    description: str = ""
    domain: str = ""


class ApiSpecOutput(BaseModel):
    endpoints: list[EndpointOutput] = []
    auth: str = ""


class ApiDependency(BaseModel):
    endpoint: str = ""
    method: str = ""
    description: str = ""


class FrontendRoute(BaseModel):
    path: str = ""
    component: str = ""
    description: str = ""


class FrontendComponent(BaseModel):
    name: str = ""
    description: str = ""


class FrontendArchOutput(BaseModel):
    routing: list[FrontendRoute] = []
    components: list[FrontendComponent] = []
    state_management: str = ""
    api_dependencies: list[ApiDependency] = []


class BackendLayerItem(BaseModel):
    name: str = ""
    description: str = ""


class BackendJob(BaseModel):
    name: str = ""
    schedule: str = ""
    description: str = ""


class BackendIntegration(BaseModel):
    name: str = ""
    description: str = ""


class BackendLayers(BaseModel):
    routers: list[BackendLayerItem] = []
    services: list[BackendLayerItem] = []
    repositories: list[BackendLayerItem] = []


class BackendArchOutput(BaseModel):
    layers: BackendLayers = Field(default_factory=BackendLayers)
    jobs: list[BackendJob] = []
    external_integrations: list[BackendIntegration] = []


class CachingItem(BaseModel):
    strategy: str = ""
    description: str = ""
    implementation_details: str = ""
    cache_invalidation: str = ""


class QueryOptItem(BaseModel):
    query_type: str = ""
    optimization: str = ""
    details: str = ""


class BottleneckItem(BaseModel):
    component: str = ""
    description: str = ""
    mitigation: str = ""


class PerformanceDesignOutput(BaseModel):
    caching: list[CachingItem] = []
    query_optimization: list[QueryOptItem] = []
    scaling: str = ""
    bottlenecks: list[BottleneckItem] = []


# ── Phase 4: Critic & Plan 출력 ──────────────────────────

class SecurityDetail(BaseModel):
    details: str = ""


class SecurityDesignOutput(BaseModel):
    authentication: SecurityDetail = Field(default_factory=SecurityDetail)
    authorization: SecurityDetail = Field(default_factory=SecurityDetail)
    data_protection: SecurityDetail = Field(default_factory=SecurityDetail)
    api_security: SecurityDetail = Field(default_factory=SecurityDetail)


class ValidatedDesign(BaseModel):
    system_architecture: SystemArchitectureOutput | None = None
    data_model: DataModelOutput | None = None
    api_spec: ApiSpecOutput | None = None
    frontend_arch: FrontendArchOutput | None = None
    backend_arch: BackendArchOutput | None = None
    security_design: SecurityDesignOutput | None = None
    performance_design: PerformanceDesignOutput | None = None


class DesignCriticOutput(BaseModel):
    passed: bool = False
    issues: list[CriticIssue] = []
    validated_design: ValidatedDesign | None = None


class PlanTask(BaseModel):
    task_name: str = ""
    description: str = ""
    dependencies: list[str] = []


class PlanPhase(BaseModel):
    phase_name: str = ""
    description: str = ""
    tasks: list[PlanTask] = []


class Milestone(BaseModel):
    title: str = ""
    description: str = ""


class DevelopmentPlanOutput(BaseModel):
    phases: list[PlanPhase] = []
    milestones: list[Milestone] = []
    critical_path: list[str] = []
    notes: str = ""

