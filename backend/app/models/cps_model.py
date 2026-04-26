from datetime import datetime
from typing import Annotated, Any

from pydantic import BaseModel, BeforeValidator


# ── LLM 출력 유연 타입 ─────────────────────────────────
# LLM이 str 필드에 list/dict를 반환하는 경우를 자동 변환한다.

def _to_str(v: Any) -> str | None:
    if v is None:
        return None
    if isinstance(v, str):
        return v
    if isinstance(v, list):
        parts = []
        for item in v:
            if isinstance(item, dict):
                parts.append(", ".join(f"{k}: {val}" for k, val in item.items()))
            else:
                parts.append(str(item))
        return "\n".join(parts)
    if isinstance(v, dict):
        return ", ".join(f"{k}: {val}" for k, val in v.items())
    return str(v)


def _to_str_list(v: Any) -> list[str]:
    if v is None:
        return []
    if not isinstance(v, list):
        v = [v]
    return [_to_str(item) or "" for item in v]  # type: ignore[return-value]


FlexStr = Annotated[str | None, BeforeValidator(_to_str)]
FlexStrList = Annotated[list[str], BeforeValidator(_to_str_list)]


def _to_single_dict(v: Any) -> dict | None:
    """LLM이 단일 객체 필드에 list를 반환할 때 첫 번째 요소를 사용한다."""
    if v is None:
        return None
    if isinstance(v, list):
        return v[0] if v else None
    return v


FlexModel = Annotated[Any, BeforeValidator(_to_single_dict)]


# ── 하위 타입 ──────────────────────────────────────────

class RootCause(BaseModel):
    content: FlexStr = None
    confidence: str | None = None  # "suspected" | "probable" | "confirmed"


class Hypothesis(BaseModel):
    content: FlexStr = None
    confidence: str | None = None


class Assumption(BaseModel):
    content: FlexStr = None
    risk_if_wrong: FlexStr = None


class DecisionLogEntry(BaseModel):
    meeting_id: str
    changed: FlexStr = None
    reason: FlexStr = None


# ── CPS 섹션 ───────────────────────────────────────────

class CpsMeta(BaseModel):
    project_id: str
    client: str
    version: str
    last_updated: datetime
    source_meetings: list[str] = []
    change_type: str = "auto"  # "auto" | "manual_edit"
    changed_fields: list[str] = []


class CpsContext(BaseModel):
    background: FlexStr = None
    environment: FlexStr = None
    stakeholders: FlexStr = None
    constraints: FlexStr = None


class CpsProblem(BaseModel):
    business_problem: FlexStr = None
    technical_problem: FlexStr = None
    impact: FlexStr = None
    root_cause: Annotated[RootCause | None, BeforeValidator(_to_single_dict)] = None


class CpsSolution(BaseModel):
    proposed_by_client: FlexStr = None
    proposed_by_fde: FlexStr = None
    hypothesis: Annotated[Hypothesis | None, BeforeValidator(_to_single_dict)] = None
    success_criteria: FlexStr = None


class CpsRisks(BaseModel):
    technical: FlexStrList = []
    business: FlexStrList = []


class CpsPending(BaseModel):
    insights: FlexStrList = []
    questions: FlexStrList = []
    solution_ideas: FlexStrList = []


# ── 전체 CPS 문서 ──────────────────────────────────────

class CpsDocument(BaseModel):
    meta: CpsMeta
    context: CpsContext = CpsContext()
    problem: CpsProblem = CpsProblem()
    solution: CpsSolution = CpsSolution()
    assumptions: list[Assumption] = []
    out_of_scope: list[str] = []
    risks: CpsRisks = CpsRisks()
    pending: CpsPending = CpsPending()
    decision_log: list[DecisionLogEntry] = []
    created_at: datetime | None = None


# ── API 요청/응답 ──────────────────────────────────────

class GetCpsResponse(BaseModel):
    version: str
    cps: CpsDocument
    created_at: datetime
    updated_at: datetime


class CpsVersionSummary(BaseModel):
    version: str
    changed_fields: list[str]
    source_meeting_id: str | None = None
    change_type: str
    created_at: datetime


class GetCpsHistoryResponse(BaseModel):
    versions: list[CpsVersionSummary]


class UpdateCpsRequest(BaseModel):
    field_path: str
    value: object
    reason: str | None = None
