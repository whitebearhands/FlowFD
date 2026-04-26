import logging

from google.cloud.firestore import Client

from app.core.firestore import register_job
from app.crew.pipeline import run_cps_pipeline
from app.crew.schemas import PipelineState
from app.services.cps_service import (
    build_cps_from_llm_output,
    diff_cps,
    get_latest_cps,
    next_version,
    save_cps,
)
from app.services.design_service import complete_job, create_job
from app.services.meeting_service import (
    get_completed_meetings,
    get_meeting,
    set_analysis_status,
)
from app.services.project_service import get_project
from app.services.user_service import get_user
from app.jobs import prd_updater_job
from app.services.github_service import auto_commit

LOCALE_TO_LANG: dict[str, str] = {
    "ko": "한국어",
    "en": "English",
}

logger = logging.getLogger(__name__)


def _format_meetings(meetings: list) -> str:
    """여러 미팅 내용을 하나의 텍스트로 결합한다."""
    parts = []
    for m in meetings:
        header = f"=== Meeting ({m.date})"
        if m.title:
            header += f" — {m.title}"
        header += " ==="
        participants = ", ".join(m.participants) if m.participants else "N/A"
        parts.append(f"{header}\nParticipants: {participants}\n\n{m.content}")
    return "\n\n".join(parts)


async def run(
    db: Client,
    group_id: str,
    project_id: str,
    pending_meeting_ids: list[str],
    user_id: str,
    analysis_mode: str = "smart",
    run_prd: bool = True,
    job_id: str | None = None,
) -> None:
    """pending 미팅 목록을 분석해서 CPS를 생성/업데이트하는 백그라운드 잡."""
    if not pending_meeting_ids:
        logger.info(
            "cps_analyzer_job: no pending meetings, skipping: project=%s", project_id
        )
        return

    # 모든 pending 미팅을 processing으로 표시
    for mid in pending_meeting_ids:
        set_analysis_status(db, group_id, project_id, mid, "processing")

    try:
        # 미팅 내용 수집
        meetings = []
        for mid in pending_meeting_ids:
            m = get_meeting(db, group_id, project_id, mid)
            if m:
                meetings.append(m)

        if not meetings:
            logger.warning(
                "cps_analyzer_job: all meetings missing: project=%s", project_id
            )
            _mark_all(db, group_id, project_id, pending_meeting_ids, "failed")
            return

        project = get_project(db, group_id, project_id)
        if project is None:
            raise ValueError(f"Project {project_id} not found")

        existing_cps = get_latest_cps(db, group_id, project_id)
        source_meetings: list[str] = []
        existing_cps_dict: dict | None = None

        if existing_cps:
            source_meetings = list(existing_cps.meta.source_meetings)
            existing_cps_dict = existing_cps.model_dump()

        # smart 모드인데 기존 CPS가 없으면 full로 전환 (첫 분석)
        effective_mode = analysis_mode
        if analysis_mode == "smart" and existing_cps is None:
            effective_mode = "full"
            logger.info(
                "analysis_mode=smart but no existing CPS → switching to full: project=%s",
                project_id,
            )

        # 완료된 미팅들의 요약 수집 (새로 분석할 pending 미팅 제외)
        completed_meetings = get_completed_meetings(
            db, group_id, project_id, exclude_ids=pending_meeting_ids
        )
        meeting_summaries = [
            f"Meeting ({m.date}){' — ' + m.title if m.title else ''}: {m.summary}"
            for m in completed_meetings
            if m.summary
        ]

        # 새 미팅의 cleaned_transcript 구성
        # meeting_summary_job이 이미 생성한 summary를 재활용, 없으면 raw content 사용
        cleaned_parts = []
        for m in meetings:
            header = f"=== Meeting ({m.date})"
            if m.title:
                header += f" — {m.title}"
            header += " ==="
            content = m.summary if m.summary else m.content
            cleaned_parts.append(f"{header}\n{content}")
        cleaned_transcript = "\n\n".join(cleaned_parts)

        source_meetings_new = source_meetings + [m.meeting_id for m in meetings]
        new_version = next_version(existing_cps.meta.version if existing_cps else None)

        user = get_user(db, user_id)
        locale = (
            (user or {}).get("settings", {}).get("display", {}).get("language", "en")
        )
        output_language = LOCALE_TO_LANG.get(locale, "English")

        if not job_id:
            job_id = create_job(db, group_id, project_id, "cps_analysis")
        register_job(job_id, group_id, project_id)

        initial_state: PipelineState = {
            "job_id": job_id,
            "project_id": project_id,
            "group_id": group_id,
            "user_id": user_id,
            "meeting_id": pending_meeting_ids[-1],  # 최신 미팅 ID (메타용)
            "new_meeting": _format_meetings(meetings),
            "cleaned_transcript": cleaned_transcript,
            "existing_cps": existing_cps_dict if effective_mode == "smart" else None,
            "meeting_summaries": meeting_summaries,
            "analysis_mode": effective_mode,
            "output_language": output_language,
            "retry_count": {},
            "pending_questions": [],
            "issues": [],
            "error": None,
        }

        result = await run_cps_pipeline(initial_state)

        validated_cps_raw = result.get("validated_cps")
        if not isinstance(validated_cps_raw, dict):
            logger.warning(
                "CPS pipeline returned no validated_cps: project=%s", project_id
            )
            _mark_all(db, group_id, project_id, pending_meeting_ids, "failed")
            complete_job(
                db,
                group_id,
                project_id,
                job_id,
                success=False,
                error="Pipeline returned no validated_cps",
            )
            return

        new_cps = build_cps_from_llm_output(
            raw=validated_cps_raw,
            project_id=project_id,
            client=project.client,
            version=new_version,
            source_meetings=source_meetings_new,
            change_type="auto",
        )

        if existing_cps:
            changed_fields = diff_cps(existing_cps, new_cps.model_dump())
            if not changed_fields:
                logger.info("CPS unchanged, skipping save: project=%s", project_id)
                _mark_all(db, group_id, project_id, pending_meeting_ids, "completed")
                complete_job(db, group_id, project_id, job_id, success=True)
                return
            new_cps.meta.changed_fields = changed_fields

        save_cps(db, group_id, project_id, new_cps)
        complete_job(db, group_id, project_id, job_id, success=True)
        logger.info(
            "CPS saved: project=%s version=%s meetings=%s",
            project_id,
            new_version,
            pending_meeting_ids,
        )

        try:
            if run_prd:
                await prd_updater_job.run(
                    db, group_id, project_id, new_cps, user_id, output_language
                )
            await auto_commit(db, group_id, project_id, user_id, "cps")
        except Exception as exc:
            logger.error(
                "PRD/auto-commit failed after CPS: project=%s error=%s", project_id, exc
            )

        _mark_all(db, group_id, project_id, pending_meeting_ids, "completed")

    except Exception as exc:
        logger.exception("CPS analysis failed: project=%s error=%s", project_id, exc)
        _mark_all(db, group_id, project_id, pending_meeting_ids, "failed")


def _mark_all(
    db: Client,
    group_id: str,
    project_id: str,
    meeting_ids: list[str],
    status: str,
) -> None:
    for mid in meeting_ids:
        set_analysis_status(db, group_id, project_id, mid, status)
