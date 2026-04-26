"""
LangGraph 파이프라인 노드 정의.
각 노드는 PipelineState를 받아서 업데이트된 state dict를 반환한다.
CrewAI 제거 — OpenAI 의존성 문제로 LangGraph로 전면 교체.
"""

import json
import logging
import re
from typing import Any, TypeVar

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from pydantic import BaseModel

from app.core.config import settings
from app.crew.schemas import (
    ApiSpecOutput,
    BackendArchOutput,
    DataModelOutput,
    FactExtractorOutput,
    FeaturesOutput,
    FrontendArchOutput,
    GoalOutput,
    NonfuncOutput,
    PerformanceDesignOutput,
    PipelineState,
    RisksAndQuestionsOutput,
    ScopeOutput,
    SentimentAnalyzerOutput,
    SystemArchitectureOutput,
    UsersOutput,
    SecurityDesignOutput,
    DesignCriticOutput,
    DevelopmentPlanOutput,
    ContextDraftOutput,
    ProblemDraftOutput,
    TechnicalDraftOutput,
    SolutionDraftOutput,
    CpsCriticOutput,
    PrdCriticOutput,
)

from app.prompts.prompts import (
    get_cps_system_prompt,
    get_context_builder_prompt,
    get_cps_critic_prompt,
    get_problem_definer_prompt,
    get_solution_synthesizer_prompt,
    get_technical_analyzer_prompt,
    get_prd_system_prompt,
    get_goal_definer_prompt,
    get_user_researcher_prompt,
    get_scope_definer_prompt,
    get_feature_writer_prompt,
    get_nonfunc_writer_prompt,
    get_risk_writer_prompt,
    get_prd_critic_prompt,
    get_system_architect_prompt,
    get_data_modeler_prompt,
    get_api_designer_prompt,
    get_frontend_architect_prompt,
    get_backend_architect_prompt,
    get_security_designer_prompt,
    get_performance_designer_prompt,
    get_design_critic_prompt,
    get_development_planner_prompt,
)

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)

MODEL_CONFIG: dict[str, str] = {
    # 단순 정제/추출
    "fact_extractor": "gemini-2.5-flash-lite",
    "sentiment_analyzer": "gemini-2.5-flash-lite",
    "user_researcher": "gemini-2.5-flash-lite",
    "scope_definer": "gemini-2.5-flash-lite",
    "nonfunc_writer": "gemini-2.5-flash-lite",
    "frontend_architect": "gemini-2.5-flash-lite",
    "performance_designer": "gemini-2.5-flash-lite",
    # 분류/분석
    "context_builder": "gemini-2.5-flash",
    "problem_definer": "gemini-2.5-flash",
    # 판단/종합
    "technical_analyzer": "gemini-3-flash-preview",
    "solution_synthesizer": "gemini-3-flash-preview",
    "goal_definer": "gemini-3-flash-preview",
    "risk_writer": "gemini-3-flash-preview",
    # Critic + 핵심 설계
    "cps_critic": "gemini-3-flash-preview",
    "feature_writer": "gemini-3-flash-preview",
    "prd_critic": "gemini-3-flash-preview",
    "system_architect": "gemini-3-flash-preview",
    "data_modeler": "gemini-3-flash-preview",
    "api_designer": "gemini-3-flash-preview",
    "backend_architect": "gemini-3-flash-preview",
    "security_designer": "gemini-3-flash-preview",
    "design_critic": "gemini-3-flash-preview",
    "development_planner": "gemini-3-flash-preview",
}


def get_llm(node_name: str, api_key: str | None = None) -> ChatGoogleGenerativeAI:
    """json_mode용 LLM — 자유형식 JSON 노드에서 사용."""
    return ChatGoogleGenerativeAI(
        model=MODEL_CONFIG[node_name],
        google_api_key=api_key or settings.gemini_api_key,
        temperature=0.1,
        response_mime_type="application/json",
    )


def _get_llm_plain(
    node_name: str, api_key: str | None = None
) -> ChatGoogleGenerativeAI:
    """with_structured_output용 LLM — response_schema를 SDK가 직접 주입한다."""
    return ChatGoogleGenerativeAI(
        model=MODEL_CONFIG[node_name],
        google_api_key=api_key or settings.gemini_api_key,
        temperature=0.1,
    )


def call_llm(
    node_name: str, system_prompt: str, user_prompt: str, api_key: str | None = None
) -> dict:
    """LLM 호출 후 JSON 파싱 — 자유형식 dict를 반환하는 노드용."""
    llm = get_llm(node_name, api_key)
    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=user_prompt),
    ]
    response = llm.invoke(messages)

    raw = response.content
    if isinstance(raw, list):
        text = "".join(
            part["text"] if isinstance(part, dict) else str(part) for part in raw
        ).strip()
    else:
        text = str(raw).strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        logger.warning("JSON parse failed for node=%s, raw=%r", node_name, text[:200])
        return _parse_json_robust(node_name, text)


def call_llm_structured(
    node_name: str,
    system_prompt: str,
    user_prompt: str,
    schema: type[T],
    api_key: str | None = None,
) -> T:
    """with_structured_output으로 LLM 호출.

    Gemini response_schema를 사용해 토큰 레벨에서 스키마를 강제하므로
    JSON 파싱 오류가 원천 차단된다.
    파싱 실패 시 call_llm 폴백 후 schema(**dict)로 변환한다.
    """
    llm = _get_llm_plain(node_name, api_key)
    structured = llm.with_structured_output(schema, include_raw=True)
    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=user_prompt),
    ]
    result = structured.invoke(messages)

    parsing_error = result.get("parsing_error")
    parsed = result.get("parsed")

    if parsing_error or parsed is None:
        logger.warning(
            "structured_output parsing failed for node=%s err=%s — fallback to call_llm",
            node_name,
            parsing_error,
        )
        raw_dict = call_llm(node_name, system_prompt, user_prompt, api_key)
        return schema(**{k: v for k, v in raw_dict.items() if k in schema.model_fields})

    return parsed  # type: ignore[return-value]


def _parse_json_robust(node_name: str, text: str) -> dict:
    """다단계 폴백으로 JSON 파싱. 실패해도 예외를 던지지 않고 빈 dict 반환."""
    # 1단계: 코드 펜스 내 JSON 추출
    fence_match = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    candidates = [fence_match.group(1).strip() if fence_match else None, text]

    for candidate in candidates:
        if not candidate:
            continue
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            pass

    # 2단계: 텍스트에서 { } 또는 [ ] 블록만 추출
    for pattern in (r"\{[\s\S]*\}", r"\[[\s\S]*\]"):
        m = re.search(pattern, text)
        if m:
            try:
                return json.loads(m.group())
            except json.JSONDecodeError:
                pass

    # 3단계: 폴백 — 원문 보존, 파이프라인 계속 진행
    logger.warning(
        "JSON parse failed for node=%s, returning raw text. len=%d",
        node_name,
        len(text),
    )
    return {"_raw": text, "_parse_failed": True}


def _json_default(o: Any) -> Any:
    """json.dumps 기본 직렬화기 — datetime 등 비표준 타입 처리."""
    if hasattr(o, "isoformat"):  # datetime, DatetimeWithNanoseconds
        return o.isoformat()
    if hasattr(o, "timestamp"):  # Firestore Timestamp
        return o.timestamp()
    return str(o)


def _j(obj: Any) -> str:
    return json.dumps(obj, ensure_ascii=False, default=_json_default)


def _as_dict(v: Any) -> dict:
    """값이 dict가 아닌 경우 안전하게 dict로 변환한다."""
    if isinstance(v, dict):
        return v
    if isinstance(v, str):
        return {"_value": v}
    return {}


def _as_dict_list(v: Any) -> list[dict]:
    """list 내 각 항목을 안전하게 dict로 변환한다."""
    if not isinstance(v, list):
        return []
    return [_as_dict(item) for item in v]


# ─────────────────────────────────────────
# Phase 1 — 미팅 분석 (병렬)
# ─────────────────────────────────────────


def fact_extractor_node(state: PipelineState) -> dict[str, Any]:
    logger.info("Executing node: fact_extractor")
    lang = state.get("output_language", "한국어")
    result = call_llm_structured(
        "fact_extractor",
        f"명시적 사실만 추출. 추측 금지. 출력 언어: {lang}",
        f"아래 미팅에서 수치(numbers), 시스템명(systems), 명시적 사실(explicit_facts)을 추출하라.\n\n[미팅 원본]\n{state['new_meeting']}",
        FactExtractorOutput,
    )
    return {"extracted_facts": result.model_dump()}


def sentiment_analyzer_node(state: PipelineState) -> dict[str, Any]:
    logger.info("Executing node: sentiment_analyzer")
    lang = state.get("output_language", "한국어")
    result = call_llm_structured(
        "sentiment_analyzer",
        f"이해관계자 감정/의도 파악 전문가. 출력 언어: {lang}",
        f"아래 미팅에서 강한 요구(strong_demands), 우려사항(concerns), 기대(expectations)를 추출하라.\n\n[미팅 원본]\n{state['new_meeting']}",
        SentimentAnalyzerOutput,
    )
    return {"sentiment_report": result.model_dump()}


# ─────────────────────────────────────────
# Phase 2 — CPS 구성
# ─────────────────────────────────────────


def context_builder_node(state: PipelineState) -> dict[str, Any]:
    logger.info("Executing node: context_builder")
    lang = state.get("output_language", "한국어")
    existing = state.get("existing_cps") or {}
    summaries = "\n---\n".join(state.get("meeting_summaries") or []) or "없음"
    result = call_llm_structured(
        "context_builder",
        f"{get_cps_system_prompt(lang)}\n\n{get_context_builder_prompt(lang)}",
        f"""CPS Context 섹션 작성. 분석 모드: {state['analysis_mode']}

[기존 CPS Context] {_j(existing.get('context', {}))}
[기존 미팅 요약본] {summaries}
[정제된 미팅] {state.get('cleaned_transcript', '')}
[추출 사실] {_j(state.get('extracted_facts', {}))}""",
        ContextDraftOutput,
    )
    return {"context_draft": result.model_dump()}


def problem_definer_node(state: PipelineState) -> dict[str, Any]:
    logger.info("Executing node: problem_definer")
    lang = state.get("output_language", "한국어")
    result = call_llm_structured(
        "problem_definer",
        f"{get_cps_system_prompt(lang)}\n\n{get_problem_definer_prompt(lang)}",
        f"""CPS Problem 섹션 작성. business_problem에 기술 용어 금지.

[정제된 미팅] {state.get('cleaned_transcript', '')}
[추출 사실] {_j(state.get('extracted_facts', {}))}
[감정 분석] {_j(state.get('sentiment_report', {}))}""",
        ProblemDraftOutput,
    )
    return {"problem_draft": result.model_dump()}


def technical_analyzer_node(state: PipelineState) -> dict[str, Any]:
    logger.info("Executing node: technical_analyzer")
    lang = state.get("output_language", "한국어")
    existing = state.get("existing_cps") or {}
    result = call_llm_structured(
        "technical_analyzer",
        f"{get_cps_system_prompt(lang)}\n\n{get_technical_analyzer_prompt(lang)}",
        f"""기술적 원인 분석. 근거 없으면 suspected.

[정제된 미팅] {state.get('cleaned_transcript', '')}
[추출 사실] {_j(state.get('extracted_facts', {}))}
[기존 CPS Problem] {_j(existing.get('problem', {}))}""",
        TechnicalDraftOutput,
    )
    return {"technical_draft": result.model_dump()}


def solution_synthesizer_node(state: PipelineState) -> dict[str, Any]:
    logger.info("Executing node: solution_synthesizer")
    lang = state.get("output_language", "한국어")
    result = call_llm_structured(
        "solution_synthesizer",
        f"{get_cps_system_prompt(lang)}\n\n{get_solution_synthesizer_prompt(lang)}",
        f"""solution, assumptions, out_of_scope, risks, pending 섹션을 작성하세요.

[Context] {_j(state.get('context_draft', {}))}
[Problem] {_j(state.get('problem_draft', {}))}
[Technical] {_j(state.get('technical_draft', {}))}
[감정 분석] {_j(state.get('sentiment_report', {}))}
[원본 미팅] {state['new_meeting']}""",
        SolutionDraftOutput,
    )
    return {"solution_draft": result.model_dump()}


def cps_critic_node(state: PipelineState) -> dict[str, Any]:
    logger.info("Executing node: cps_critic")
    lang = state.get("output_language", "한국어")
    existing = state.get("existing_cps") or {}
    # meta는 LLM이 아닌 state에서 직접 주입
    meta = {
        "project_id": state.get("project_id"),
        "client": existing.get("meta", {}).get("client"),
        "version": _next_version(existing.get("meta", {}).get("version")),
        "last_updated": None,  # 저장 시점에 서버에서 주입
        "source_meetings": (existing.get("meta", {}).get("source_meetings") or [])
        + [state.get("meeting_id")],
    }
    # decision_log: 스마트 모드면 변경 사항 기록
    existing_log = existing.get("decision_log") or []

    result = call_llm_structured(
        "cps_critic",
        get_cps_critic_prompt(lang),
        f"""CPS 초안 전체를 검증하고 스키마 그대로 조립하세요.

[Context 초안] {_j(state.get('context_draft', {}))}
[Problem 초안] {_j(state.get('problem_draft', {}))}
[Technical 초안] {_j(state.get('technical_draft', {}))}
[Solution+기타 초안] {_j(state.get('solution_draft', {}))}
[기존 CPS] {_j(existing)}
[원본 미팅] {state['new_meeting']}
[분석 모드] {state.get('analysis_mode', 'smart')}
[meeting_id] {state.get('meeting_id', '')}""",
        CpsCriticOutput,
    )

    # meta와 decision_log는 state 값으로 덮어씀
    validated = result.validated_cps.model_dump() if result.validated_cps else {}
    validated["meta"] = meta
    if existing_log:
        validated["decision_log"] = existing_log + (validated.get("decision_log") or [])

    issues = [i.model_dump() for i in result.issues]
    pending_questions = (
        state.get("pending_questions") or []
    ) + result.suggested_questions

    return {
        "validated_cps": validated,
        "cps_score": result.overall_score,
        "issues": (state.get("issues") or []) + issues,
        "pending_questions": pending_questions,
    }


def _next_version(current: str | None) -> str:
    """v1.0.0 → v1.1.0 형식으로 마이너 버전 증가."""
    if not current:
        return "v1.0.0"
    try:
        parts = current.lstrip("v").split(".")
        return f"v{parts[0]}.{int(parts[1]) + 1}.0"
    except Exception:
        return "v1.0.0"


# ─────────────────────────────────────────
# Phase 3 — PRD
# ─────────────────────────────────────────


def goal_definer_node(state: PipelineState) -> dict[str, Any]:
    logger.info("Executing node: goal_definer")
    lang = state.get("output_language", "한국어")
    result = call_llm_structured(
        "goal_definer",
        f"{get_prd_system_prompt(lang)}\n\n{get_goal_definer_prompt(lang)}",
        f"수치화된 비즈니스 목표와 성공 지표를 정의하라.\n[CPS Solution] {_j(state['validated_cps'].get('solution', {}))}",
        GoalOutput,
    )
    return {"goals_draft": result.model_dump()}


def user_researcher_node(state: PipelineState) -> dict[str, Any]:
    logger.info("Executing node: user_researcher")
    lang = state.get("output_language", "한국어")
    result = call_llm_structured(
        "user_researcher",
        f"{get_prd_system_prompt(lang)}\n\n{get_user_researcher_prompt(lang)}",
        f"사용자 유형을 type/goal/pain/frequency 형식으로 정의하라.\n[CPS Stakeholders] {state['validated_cps'].get('context', {}).get('stakeholders', '')}",
        UsersOutput,
    )
    return {"users_draft": result.model_dump()}


def scope_definer_node(state: PipelineState) -> dict[str, Any]:
    logger.info("Executing node: scope_definer")
    lang = state.get("output_language", "한국어")
    result = call_llm_structured(
        "scope_definer",
        f"{get_prd_system_prompt(lang)}\n\n{get_scope_definer_prompt(lang)}",
        f"""in_scope(FR ID 포함)와 out_of_scope를 정의하라.
[CPS Out of Scope] {_j(state['validated_cps'].get('out_of_scope', []))}
[CPS Pending] {_j(state['validated_cps'].get('pending', {}))}""",
        ScopeOutput,
    )
    return {"scope_draft": result.model_dump()}


def feature_writer_node(state: PipelineState) -> dict[str, Any]:
    logger.info("Executing node: feature_writer")
    lang = state.get("output_language", "한국어")
    result = call_llm_structured(
        "feature_writer",
        f"{get_prd_system_prompt(lang)}\n\n{get_feature_writer_prompt(lang)}",
        f"""FR-XXX-000 형식으로 Must/Should/Could 기능 요구사항을 작성하라. out_of_scope 항목은 FR 금지.
[목표] {_j(state.get('goals_draft', {}))}
[사용자] {_j(state.get('users_draft', {}))}
[범위] {_j(state.get('scope_draft', {}))}
[CPS Solution] {_j(state['validated_cps'].get('solution', {}))}""",
        FeaturesOutput,
    )
    return {"features_draft": result.model_dump()}


def nonfunc_writer_node(state: PipelineState) -> dict[str, Any]:
    logger.info("Executing node: nonfunc_writer")
    lang = state.get("output_language", "한국어")
    result = call_llm_structured(
        "nonfunc_writer",
        f"{get_prd_system_prompt(lang)}\n\n{get_nonfunc_writer_prompt(lang)}",
        f"""비기능 요구사항을 category/requirement/metric 형식으로 수치화하여 작성하라.
[CPS Constraints] {_j(state['validated_cps'].get('context', {}).get('constraints', ''))}
[CPS Risks] {_j(state['validated_cps'].get('risks', {}))}""",
        NonfuncOutput,
    )
    return {"nonfunc_draft": result.model_dump()}


def risk_writer_node(state: PipelineState) -> dict[str, Any]:
    logger.info("Executing node: risk_writer")
    lang = state.get("output_language", "한국어")
    result = call_llm_structured(
        "risk_writer",
        f"{get_prd_system_prompt(lang)}\n\n{get_risk_writer_prompt(lang)}",
        f"""리스크(각 FR ID 연결)와 미결 사항(open_questions)을 작성하라.
[CPS Risks] {_j(state['validated_cps'].get('risks', {}))}
[CPS Assumptions] {_j(state['validated_cps'].get('assumptions', []))}
[FR] {_j(state.get('features_draft', {}))}""",
        RisksAndQuestionsOutput,
    )
    return {"risks_draft": result.model_dump()}


def prd_critic_node(state: PipelineState) -> dict[str, Any]:
    logger.info("Executing node: prd_critic")
    lang = state.get("output_language", "한국어")
    result = call_llm_structured(
        "prd_critic",
        get_prd_critic_prompt(lang),
        f"""각 섹션 초안을 검증하고, 최종 PRD를 조립하여 반환하라.

[목표] {_j(state.get('goals_draft', {}))}
[사용자] {_j(state.get('users_draft', {}))}
[범위] {_j(state.get('scope_draft', {}))}
[FR] {_j(state.get('features_draft', {}))}
[비기능] {_j(state.get('nonfunc_draft', {}))}
[리스크] {_j(state.get('risks_draft', {}))}
[CPS] {_j(state.get('validated_cps', {}))}""",
        PrdCriticOutput,
    )

    if result.validated_prd:
        validated_prd = result.validated_prd.model_dump()
    else:
        validated_prd = {
            "goals": state.get("goals_draft", {}),
            "users": state.get("users_draft", {}).get("users", []),
            "scope": state.get("scope_draft", {}),
            "features": state.get("features_draft", {}).get("features", []),
            "non_functional": state.get("nonfunc_draft", {}).get("non_functional", []),
            "risks": state.get("risks_draft", {}).get("risks", []),
            "open_questions": state.get("risks_draft", {}).get("open_questions", []),
        }

    issues_list = [i.model_dump() for i in result.issues]

    return {
        "validated_prd": validated_prd,
        "issues": (state.get("issues") or []) + issues_list,
    }


# ─────────────────────────────────────────
# Phase 4 — 설계
# ─────────────────────────────────────────


def system_architect_node(state: PipelineState) -> dict[str, Any]:
    logger.info("Executing node: system_architect")
    lang = state.get("output_language", "한국어")
    existing_design = state.get("existing_design", {}) or {}
    existing_part = _j(existing_design.get("system_architecture", {})) if isinstance(existing_design, dict) else "{}"
    result = call_llm_structured(
        "system_architect",
        get_system_architect_prompt(lang),
        f"""컴포넌 목록, 데이터 흐름(data_flow), 기술 스택(tech_stack), 배포 구조(deployment), 설계 결정(design_decisions)을 포함한 시스템 아키텍처를 설계하라.
[PRD] {_j(state.get('validated_prd', {}))}
[CPS Constraints] {state['validated_cps'].get('context', {}).get('constraints', '')}
[기존 설계] {existing_part}""",
        SystemArchitectureOutput,
    )
    return {"system_architecture": result.model_dump()}


def data_modeler_node(state: PipelineState) -> dict[str, Any]:
    logger.info("Executing node: data_modeler")
    lang = state.get("output_language", "한국어")
    existing_design = state.get("existing_design", {}) or {}
    existing_part = _j(existing_design.get("data_model", {})) if isinstance(existing_design, dict) else "{}"
    result = call_llm_structured(
        "data_modeler",
        get_data_modeler_prompt(lang),
        f"""테이블(collections), 관계(relationships: from/to/type), 인덱스(indexes: name/table/columns/type)를 포함한 DB 스키마를 설계하라.
[PRD Features] {_j(state.get('validated_prd', {}).get('features', []))}
[Architecture] {_j(state.get('system_architecture', {}))}
[기존 설계] {existing_part}""",
        DataModelOutput,
    )
    return {"data_model": result.model_dump()}


def api_designer_node(state: PipelineState) -> dict[str, Any]:
    logger.info("Executing node: api_designer")
    lang = state.get("output_language", "한국어")
    existing_design = state.get("existing_design", {}) or {}
    existing_part = _j(existing_design.get("api_spec", {})) if isinstance(existing_design, dict) else "{}"
    result = call_llm_structured(
        "api_designer",
        get_api_designer_prompt(lang),
        f"""엔드포인트 목록(endpoints: method/path/description/domain)과 인증 방식(auth)을 포함한 RESTful API 명세를 작성하라.
[PRD Features] {_j(state.get('validated_prd', {}).get('features', []))}
[Architecture] {_j(state.get('system_architecture', {}))}
[기존 설계] {existing_part}""",
        ApiSpecOutput,
    )
    return {"api_spec": result.model_dump()}


def frontend_architect_node(state: PipelineState) -> dict[str, Any]:
    logger.info("Executing node: frontend_architect")
    lang = state.get("output_language", "한국어")
    existing_design = state.get("existing_design", {}) or {}
    existing_part = _j(existing_design.get("frontend_arch", {})) if isinstance(existing_design, dict) else "{}"
    result = call_llm_structured(
        "frontend_architect",
        get_frontend_architect_prompt(lang),
        f"""상태 관리 전략(state_management)과 API 의존성(api_dependencies: endpoint/method/description)을 포함한 프론트엔드 구조를 설계하라.
[PRD] {_j(state.get('validated_prd', {}))}
[Architecture] {_j(state.get('system_architecture', {}))}
[기존 설계] {existing_part}""",
        FrontendArchOutput,
    )
    return {"frontend_arch": result.model_dump()}


def backend_architect_node(state: PipelineState) -> dict[str, Any]:
    logger.info("Executing node: backend_architect")
    lang = state.get("output_language", "한국어")
    existing_design = state.get("existing_design", {}) or {}
    existing_part = _j(existing_design.get("backend_arch", {})) if isinstance(existing_design, dict) else "{}"
    result = call_llm_structured(
        "backend_architect",
        get_backend_architect_prompt(lang),
        f"""백그라운드 잡(jobs: name/schedule/description)과 외부 연동(external_integrations: name/description)을 포함한 백엔드 구조를 설계하라.
[PRD Features] {_j(state.get('validated_prd', {}).get('features', []))}
[Architecture] {_j(state.get('system_architecture', {}))}
[기존 설계] {existing_part}""",
        BackendArchOutput,
    )
    return {"backend_arch": result.model_dump()}


def security_designer_node(state: PipelineState) -> dict[str, Any]:
    logger.info("Executing node: security_designer")
    lang = state.get("output_language", "한국어")
    existing_design = state.get("existing_design", {}) or {}
    existing_part = _j(existing_design.get("security_design", {})) if isinstance(existing_design, dict) else "{}"
    result = call_llm_structured(
        "security_designer",
        get_security_designer_prompt(lang),
        f"""authentication/authorization/data_protection/api_security 섹션을 포함한 보안 설계를 작성하라.
[Data Model] {_j(state.get('data_model', {}))}
[API Spec] {_j(state.get('api_spec', {}))}
[PRD NonFunctional] {_j(state.get('validated_prd', {}).get('non_functional', {}))}
[기존 설계] {existing_part}""",
        SecurityDesignOutput,
    )
    return {"security_design": result.model_dump()}


def performance_designer_node(state: PipelineState) -> dict[str, Any]:
    logger.info("Executing node: performance_designer")
    lang = state.get("output_language", "한국어")
    existing_design = state.get("existing_design", {}) or {}
    existing_part = _j(existing_design.get("performance_design", {})) if isinstance(existing_design, dict) else "{}"
    result = call_llm_structured(
        "performance_designer",
        get_performance_designer_prompt(lang),
        f"""캐싱 전략(caching), 쿼리 최적화(query_optimization), 병목 포인트(bottlenecks)를 포함한 성능 설계를 작성하라.
[Architecture] {_j(state.get('system_architecture', {}))}
[Data Model] {_j(state.get('data_model', {}))}
[기존 설계] {existing_part}""",
        PerformanceDesignOutput,
    )
    return {"performance_design": result.model_dump()}


def deep_merge_design(original: dict, delta: dict) -> dict:
    import copy

    merged = copy.deepcopy(original)

    list_pks = {
        "components": "name",
        "collections": "table_name",
        "endpoints": "path",
        "routing": "path",
        "jobs": "name",
        "external_integrations": "name",
    }

    def merge_recursive(base, update):
        if not isinstance(update, dict) or not isinstance(base, dict):
            return update

        for k, v in update.items():
            if not v:
                continue

            if isinstance(v, list) and k in list_pks:
                pk = list_pks[k]
                base_list = base.get(k) or []
                for upd_item in v:
                    if not isinstance(upd_item, dict):
                        continue
                    pk_val = upd_item.get(pk)
                    match = next(
                        (
                            x
                            for x in base_list
                            if isinstance(x, dict) and x.get(pk) == pk_val
                        ),
                        None,
                    )
                    if match:
                        merge_recursive(match, upd_item)
                    else:
                        base_list.append(upd_item)
                base[k] = base_list
            elif isinstance(v, dict):
                base[k] = merge_recursive(base.get(k) or {}, v)
            else:
                base[k] = v
        return base

    return merge_recursive(merged, delta)


def design_critic_node(state: PipelineState) -> dict[str, Any]:
    logger.info("Executing node: design_critic")
    lang = state.get("output_language", "한국어")
    result = call_llm_structured(
        "design_critic",
        get_design_critic_prompt(lang),
        f"""설계 전체 검증 후 수정된 통합 설계 반환.
[System] {_j(state.get('system_architecture', {}))}
[Data] {_j(state.get('data_model', {}))}
[API] {_j(state.get('api_spec', {}))}
[Frontend] {_j(state.get('frontend_arch', {}))}
[Backend] {_j(state.get('backend_arch', {}))}
[Security] {_j(state.get('security_design', {}))}
[Performance] {_j(state.get('performance_design', {}))}
[PRD] {_j(state.get('validated_prd', {}))}""",
        DesignCriticOutput,
    )

    original_design = {
        "system_architecture": state.get("system_architecture", {}),
        "data_model": state.get("data_model", {}),
        "api_spec": state.get("api_spec", {}),
        "frontend_arch": state.get("frontend_arch", {}),
        "backend_arch": state.get("backend_arch", {}),
        "security_design": state.get("security_design", {}),
        "performance_design": state.get("performance_design", {}),
    }

    if result.validated_design:
        delta = result.validated_design.model_dump(
            exclude_unset=True, exclude_none=True
        )
        merged_design = deep_merge_design(original_design, delta)
    else:
        merged_design = original_design

    return {
        "validated_design": merged_design,
        "issues": (state.get("issues") or []) + [i.model_dump() for i in result.issues],
    }


def development_planner_node(state: PipelineState) -> dict[str, Any]:
    logger.info("Executing node: development_planner")
    lang = state.get("output_language", "한국어")
    validated = dict(state.get("validated_design") or {})
    result = call_llm_structured(
        "development_planner",
        get_development_planner_prompt(lang),
        f"[Validated Design] {_j(validated)}",
        DevelopmentPlanOutput,
    )
    validated["plan"] = result.model_dump()
    return {"validated_design": validated}
