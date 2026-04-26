from app.core.billing_deps import raise_if_insufficient
from app.core.credits import CREDITS_PRD
from app.jobs import prd_updater_job
from app.services import billing_service
from app.services.cps_service import get_latest_cps
from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from fastapi.responses import Response
from pydantic import BaseModel
from urllib.parse import quote
from app.core.auth import CurrentUser, get_current_user
from app.core.firestore import get_db
from app.services.prd_service import (
    get_latest_prd,
    get_prd_by_version,
    get_prd_versions,
    next_version,
    save_prd,
)
from app.services.project_service import get_project, resolve_project_params
from app.services.github_markdown import prd_to_markdown

LOCALE_TO_LANG: dict[str, str] = {
    "ko": "한국어",
    "en": "English",
}

router = APIRouter(prefix="/projects/{project_id}/prd", tags=["prd"])


class PrdResponse(BaseModel):
    version: str
    content: dict
    source_cps_version: str
    change_type: str
    created_at: datetime


class PrdVersionSummary(BaseModel):
    version: str
    source_cps_version: str
    change_type: str
    created_at: datetime


class GetPrdHistoryResponse(BaseModel):
    versions: list[PrdVersionSummary]


class UpdatePrdRequest(BaseModel):
    section: str
    content: dict
    reason: str | None = None


def _check_project(db, group_id: str, project_id: str) -> None:
    if get_project(db, group_id, project_id) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )


@router.get("", response_model=PrdResponse)
async def get_prd(
    project_id: str,
    current_user: CurrentUser = Depends(get_current_user),
) -> PrdResponse:
    db = get_db()
    group_id, real_project_id = resolve_project_params(project_id, current_user.group_id)
    _check_project(db, group_id, real_project_id)
    prd = get_latest_prd(db, group_id, real_project_id)
    if prd is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="PRD not found. CPS must be generated first.",
        )
    return PrdResponse(**prd)


@router.get("/history", response_model=GetPrdHistoryResponse)
async def get_prd_history(
    project_id: str,
    current_user: CurrentUser = Depends(get_current_user),
) -> GetPrdHistoryResponse:
    db = get_db()
    group_id, real_project_id = resolve_project_params(project_id, current_user.group_id)
    _check_project(db, group_id, real_project_id)
    versions_raw = get_prd_versions(db, group_id, real_project_id)
    return GetPrdHistoryResponse(
        versions=[PrdVersionSummary(**v) for v in versions_raw]
    )


@router.get("/export")
async def export_prd(
    project_id: str,
    current_user: CurrentUser = Depends(get_current_user),
) -> Response:
    db = get_db()
    group_id, real_project_id = resolve_project_params(project_id, current_user.group_id)
    _check_project(db, group_id, real_project_id)
    prd = get_latest_prd(db, group_id, real_project_id)
    if prd is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="PRD not found"
        )
    project = get_project(db, group_id, real_project_id)
    project_name = (project.name if project else None) or project_id
    md = prd_to_markdown(prd, prd.get("version", "1.0.0"))
    safe_name = project_name.replace(" ", "_").replace("/", "_")
    filename = f"prd_{safe_name}_v{prd.get('version', '1.0.0')}.md"
    encoded_filename = quote(filename)
    return Response(
        content=md.encode("utf-8"),
        media_type="text/markdown; charset=utf-8",
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}",
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


@router.get("/{version}", response_model=PrdResponse)
async def get_prd_version(
    project_id: str,
    version: str,
    current_user: CurrentUser = Depends(get_current_user),
) -> PrdResponse:
    db = get_db()
    group_id, real_project_id = resolve_project_params(project_id, current_user.group_id)
    _check_project(db, group_id, real_project_id)
    prd = get_prd_by_version(db, group_id, real_project_id, version)
    if prd is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"PRD version {version} not found",
        )
    return PrdResponse(**prd)


def _prd_to_markdown(prd: dict, project_name: str) -> str:
    """PRD JSON → 마크다운 문자열 변환."""
    version = prd.get("version", "")
    created_at = prd.get("created_at", "")
    if hasattr(created_at, "isoformat"):
        created_at = created_at.isoformat()

    data = prd.get("content", "")

    lines: list[str] = []

    lines.append(f"# PRD: {project_name}")
    lines.append(f"> 버전: {version} | 생성일: {created_at}")
    lines.append("")

    # 목표
    goals = data.get("goals", {})
    if goals:
        lines.append("## 목표")
        biz = goals.get("business_goals", [])
        if biz:
            lines.append("### 비즈니스 목표")
            for g in biz:
                lines.append(f"- {g}")
            lines.append("")
        metrics = goals.get("success_metrics", [])
        if metrics:
            lines.append("### 성공 지표")
            lines.append("| 지표 | 이전 | 이후 |")
            lines.append("|------|------|------|")
            for m in metrics:
                lines.append(
                    f"| {m.get('metric','')} | {m.get('before','')} | {m.get('after','')} |"
                )
            lines.append("")

    # 사용자
    users = data.get("users", [])
    if users:
        lines.append("## 사용자")
        for u in users:
            lines.append(f"### {u.get('type', '')}")
            if u.get("goal"):
                lines.append(f"- **목표**: {u['goal']}")
            if u.get("pain"):
                lines.append(f"- **불편**: {u['pain']}")
            if u.get("frequency"):
                lines.append(f"- **빈도**: {u['frequency']}")
            lines.append("")

    # 범위
    scope = data.get("scope", {})
    if scope:
        lines.append("## 범위")
        in_scope = scope.get("in_scope", [])
        if in_scope:
            lines.append("### 포함 범위")
            lines.append("| FR ID | 설명 | 우선순위 |")
            lines.append("|-------|------|---------|")
            for item in in_scope:
                if isinstance(item, dict):
                    lines.append(
                        f"| {item.get('fr_id','')} | {item.get('description','')} | {item.get('priority','')} |"
                    )
                else:
                    lines.append(f"| — | {item} | — |")
            lines.append("")
        out_scope = scope.get("out_of_scope", [])
        if out_scope:
            lines.append("### 제외 범위")
            for item in out_scope:
                lines.append(f"- {item}")
            lines.append("")

    # 기능 요구사항
    features = data.get("features", [])
    if features:
        lines.append("## 기능 요구사항")
        for priority in ("Must", "Should", "Could"):
            group = [
                f
                for f in features
                if str(f.get("priority", "")).capitalize() == priority
            ]
            if group:
                labels = {"Must": "필수", "Should": "권장", "Could": "선택"}
                lines.append(f"### {priority} ({labels[priority]})")
                for f in group:
                    lines.append(f"**{f.get('id', '')}. {f.get('title', '')}**")
                    if f.get("description"):
                        lines.append(f.get("description"))
                    lines.append("")

    # 리스크
    risks = data.get("risks", [])
    if risks:
        lines.append("## 리스크")
        for r in risks:
            desc = r.get("description", r) if isinstance(r, dict) else str(r)
            fr_ids = r.get("fr_ids", []) if isinstance(r, dict) else []
            if fr_ids:
                lines.append(f"- {desc} *(관련: {', '.join(fr_ids)})*")
            else:
                lines.append(f"- {desc}")
        lines.append("")

    # 미결 사항
    questions = data.get("open_questions", [])
    if questions:
        lines.append("## 미결 사항")
        for q in questions:
            lines.append(f"- {q}")
        lines.append("")

    return "\n".join(lines)


class GeneratePrdResponse(BaseModel):
    status: str
    credits_used: int


@router.post("/generate", response_model=GeneratePrdResponse)
async def generate_prd(
    project_id: str,
    background_tasks: BackgroundTasks,
    current_user: CurrentUser = Depends(get_current_user),
) -> GeneratePrdResponse:
    """CPS 기반으로 PRD를 수동으로 생성/재생성한다."""
    db = get_db()
    group_id, real_project_id = resolve_project_params(project_id, current_user.group_id)
    _check_project(db, group_id, real_project_id)

    if group_id == "samples":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Sample projects are read-only",
        )

    cps = get_latest_cps(db, group_id, real_project_id)
    if cps is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CPS must be generated before creating PRD.",
        )

    credits = billing_service.get_credits(db, current_user.user_id)
    raise_if_insufficient(credits["total_credits"], CREDITS_PRD)

    locale = current_user.settings.get("display", {}).get("language", "en")

    output_language = LOCALE_TO_LANG.get(locale, "English")

    from app.services.design_service import create_job
    job_id = create_job(db, group_id, real_project_id, "prd_generation")

    background_tasks.add_task(
        prd_updater_job.run,
        db,
        group_id,
        real_project_id,
        cps,
        current_user.user_id,
        output_language,
        job_id,
    )
    return GeneratePrdResponse(status="processing", credits_used=CREDITS_PRD)


@router.patch("", status_code=204)
async def update_prd(
    project_id: str,
    body: UpdatePrdRequest,
    current_user: CurrentUser = Depends(get_current_user),
) -> None:
    db = get_db()
    group_id, real_project_id = resolve_project_params(project_id, current_user.group_id)
    _check_project(db, group_id, real_project_id)

    if group_id == "samples":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Sample projects are read-only",
        )

    existing = get_latest_prd(db, group_id, real_project_id)
    if existing is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="PRD not found",
        )
    new_version = next_version(existing["version"])
    # 수동 편집: 전체 content를 교체 (section 기반 편집은 향후 구현)
    save_prd(
        db=db,
        group_id=group_id,
        project_id=real_project_id,
        version=new_version,
        content=body.content,
        source_cps_version=existing.get("source_cps_version", ""),
        change_type="manual_edit",
        reason=body.reason,
    )


@router.get("/test/analyze")
async def reanalyze_meeting_endpoint(
    project_id: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    db = get_db()
    group_id, real_project_id = resolve_project_params(project_id, current_user.group_id)
    _check_project(db, group_id, real_project_id)
    versions_raw = get_prd_versions(db, group_id, real_project_id)
    cps = get_latest_cps(db, group_id, real_project_id)

    await prd_updater_job.run(
        db, group_id, real_project_id, cps, current_user.user_id
    )

    return {"status": "success"}
