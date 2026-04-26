import json
import logging

from google.cloud.firestore import Client

from app.core.firestore import register_job
from app.crew.pipeline import run_prd_pipeline
from app.crew.schemas import PipelineState
from app.models.cps_model import CpsDocument
from app.core.credits import CREDITS_PRD
from app.services import billing_service
from app.services.design_service import create_job, complete_job
from app.services.github_service import auto_commit
from app.services.prd_service import get_latest_prd, next_version, save_prd


logger = logging.getLogger(__name__)


# 8크레딧 차감
async def run(
    db: Client,
    group_id: str,
    project_id: str,
    cps: CpsDocument,
    user_id: str,
    output_language: str = "한국어",
    job_id: str | None = None,
) -> None:
    """CPS 변경 후 PRD를 생성/업데이트하는 백그라운드 잡 (LangGraph Phase 3)."""
    try:
        billing_service.deduct_credits(db, user_id, CREDITS_PRD, "PRD Generation")
        existing_prd = get_latest_prd(db, group_id, project_id)
        new_version = next_version(existing_prd["version"] if existing_prd else None)

        if not job_id:
            job_id = create_job(db, group_id, project_id, "prd_generation")
        register_job(job_id, group_id, project_id)

        initial_state: PipelineState = {
            "job_id": job_id,
            "project_id": project_id,
            "group_id": group_id,
            "user_id": user_id,
            "validated_cps": cps.model_dump(),
            "output_language": output_language,
            "retry_count": {},
            "pending_questions": [],
            "issues": [],
            "error": None,
        }

        result = await run_prd_pipeline(initial_state)

        # PipelineState에서 validated_prd 추출 후 Markdown 변환
        validated_prd = result.get("validated_prd")
        if isinstance(validated_prd, dict):
            prd_content = validated_prd.get("content") or _dict_to_markdown(
                validated_prd
            )
        elif isinstance(validated_prd, str):
            prd_content = validated_prd
        else:
            prd_content = ""

        if not prd_content.strip():
            logger.warning("PRD update skipped: pipeline returned empty content")
            complete_job(
                db,
                group_id,
                project_id,
                job_id,
                success=False,
                error="Empty PRD content",
            )
            return

        save_prd(
            db=db,
            group_id=group_id,
            project_id=project_id,
            version=new_version,
            content=validated_prd,
            source_cps_version=cps.meta.version,
            change_type="auto",
        )
        complete_job(db, group_id, project_id, job_id, success=True)
        await auto_commit(db, group_id, project_id, user_id, "prd")
        logger.info(
            "PRD saved via LangGraph pipeline: project=%s version=%s source_cps=%s",
            project_id,
            new_version,
            cps.meta.version,
        )

    except Exception as exc:
        logger.exception("PRD update failed: project=%s error=%s", project_id, exc)


def _dict_to_markdown(prd_dict: dict) -> str:
    return f"```json\n{json.dumps(prd_dict, ensure_ascii=False, indent=2)}\n```"
