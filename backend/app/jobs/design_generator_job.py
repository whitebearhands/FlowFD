import logging
from datetime import datetime

from google.cloud.firestore import Client

from app.core.firestore import register_job
from app.crew.pipeline import run_design_pipeline
from app.crew.schemas import PipelineState
from app.services.cps_service import get_latest_cps
from app.services.design_service import (
    complete_job,
    get_design,
    save_architecture,
    save_plan,
)
from app.services.github_service import auto_commit
from app.services.prd_service import get_latest_prd
from app.services.project_service import get_project
from app.services.user_service import get_user

LOCALE_TO_LANG: dict[str, str] = {
    "ko": "한국어",
    "en": "English",
}

logger = logging.getLogger(__name__)


# 12크레딧 차감
async def run(
    db: Client,
    group_id: str,
    project_id: str,
    job_id: str,
    user_id: str,
    tech_stack: dict,
    constraints: list[str],
) -> None:
    """PRD + CPS를 바탕으로 아키텍처 설계를 생성하는 백그라운드 잡 (LangGraph Phase 4)."""
    try:
        project = get_project(db, group_id, project_id)
        if project is None:
            raise ValueError(f"Project {project_id} not found")

        cps = get_latest_cps(db, group_id, project_id)
        if cps is None:
            raise ValueError("CPS not found. Generate CPS first.")

        prd = get_latest_prd(db, group_id, project_id)
        if prd is None:
            raise ValueError("PRD not found. Generate PRD first.")

        design = get_design(db, group_id, project_id)

        validated_cps = {
            **cps.model_dump(),
            "tech_stack": tech_stack,
            "constraints": constraints,
        }

        user = get_user(db, user_id)
        locale = (
            (user or {}).get("settings", {}).get("display", {}).get("language", "ko")
        )
        output_language = LOCALE_TO_LANG.get(locale, "한국어")

        register_job(job_id, group_id, project_id)

        initial_state: PipelineState = {
            "job_id": job_id,
            "project_id": project_id,
            "group_id": group_id,
            "user_id": user_id,
            "validated_cps": _sanitize(validated_cps),  # type: ignore[arg-type]
            "validated_prd": _sanitize(dict(prd)),  # type: ignore[arg-type]
            "existing_design": _sanitize(design) if design else "",
            "output_language": output_language,
            "retry_count": {},
            "pending_questions": [],
            "issues": [],
            "error": None,
        }

        result = await run_design_pipeline(initial_state)

        # 각 파트를 JSON dict로 조합해서 저장
        design_object = _build_design_json(result)

        # plan 필드 추출 (validated_design에서)
        plan = _extract_plan(result)

        if plan:
            save_plan(db, group_id, project_id, plan)
        if design_object:
            save_architecture(db, group_id, project_id, design_object)

        complete_job(db, group_id, project_id, job_id, success=True)
        await auto_commit(db, group_id, project_id, user_id, "design")
        logger.info(
            "Design saved as JSON: project=%s job=%s",
            project_id,
            job_id,
        )

        return {"design": design_object, "origin": result}

    except Exception as exc:
        logger.exception(
            "Design generation failed: project=%s job=%s error=%s",
            project_id,
            job_id,
            exc,
        )
        complete_job(db, group_id, project_id, job_id, success=False, error=str(exc))


def _build_design_json(result: PipelineState) -> dict:
    """LangGraph 결과에서 설계 파트를 우선순위에 맞게 조합한다. (critic 수정본 최우선)"""
    validated = result.get("validated_design", {})
    design: dict = {}

    keys = [
        "system_architecture",
        "data_model",
        "api_spec",
        "frontend_arch",
        "backend_arch",
        "security_design",
        "performance_design",
    ]

    for key in keys:
        if isinstance(validated, dict) and validated.get(key):
            design[key] = _sanitize(validated[key])
        else:
            design[key] = _sanitize(result.get(key))

    return design


def _extract_plan(result: PipelineState) -> dict | None:
    """validated_design에서 컴포넌트화된 개발 계획 객체를 추출한다."""
    validated = result.get("validated_design")
    if isinstance(validated, dict):
        plan = validated.get("plan")
        if plan and isinstance(plan, dict):
            return plan
    return None


def _sanitize(obj: object) -> object:
    """Firestore DatetimeWithNanoseconds 등 JSON 직렬화 불가 타입을 변환한다."""
    if isinstance(obj, dict):
        return {k: _sanitize(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_sanitize(i) for i in obj]
    if isinstance(obj, datetime) or hasattr(obj, "isoformat"):
        return obj.isoformat()
    if hasattr(obj, "timestamp"):
        return obj.timestamp()
    return obj
