from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.auth import CurrentUser, get_current_user
from app.core.firestore import get_db
from app.models.cps_model import (
    CpsVersionSummary,
    GetCpsHistoryResponse,
    GetCpsResponse,
    UpdateCpsRequest,
)
from app.services.cps_service import (
    apply_field_update,
    build_cps_from_llm_output,
    get_cps_by_version,
    get_cps_versions,
    get_latest_cps,
    next_version,
    save_cps,
)
from app.services.project_service import get_project, resolve_project_params

router = APIRouter(prefix="/projects/{project_id}/cps", tags=["cps"])


def _check_project(db, group_id: str, project_id: str) -> None:
    if get_project(db, group_id, project_id) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )


@router.get("", response_model=GetCpsResponse)
async def get_cps(
    project_id: str,
    current_user: CurrentUser = Depends(get_current_user),
) -> GetCpsResponse:
    db = get_db()
    group_id, real_project_id = resolve_project_params(project_id, current_user.group_id)
    _check_project(db, group_id, real_project_id)
    cps = get_latest_cps(db, group_id, real_project_id)
    if cps is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="CPS not found. Add a meeting to generate CPS.",
        )
    now = cps.meta.last_updated
    return GetCpsResponse(
        version=cps.meta.version,
        cps=cps,
        created_at=cps.created_at or now,
        updated_at=now,
    )


@router.get("/history", response_model=GetCpsHistoryResponse)
async def get_cps_history(
    project_id: str,
    current_user: CurrentUser = Depends(get_current_user),
) -> GetCpsHistoryResponse:
    db = get_db()
    group_id, real_project_id = resolve_project_params(project_id, current_user.group_id)
    _check_project(db, group_id, real_project_id)
    versions_raw = get_cps_versions(db, group_id, real_project_id)
    versions = [
        CpsVersionSummary(
            version=v["version"],
            changed_fields=v.get("changed_fields", []),
            source_meeting_id=v.get("source_meeting_id"),
            change_type=v.get("change_type", "auto"),
            created_at=v["created_at"],
        )
        for v in versions_raw
    ]
    return GetCpsHistoryResponse(versions=versions)


@router.get("/{version}", response_model=GetCpsResponse)
async def get_cps_version(
    project_id: str,
    version: str,
    current_user: CurrentUser = Depends(get_current_user),
) -> GetCpsResponse:
    db = get_db()
    group_id, real_project_id = resolve_project_params(project_id, current_user.group_id)
    _check_project(db, group_id, real_project_id)
    cps = get_cps_by_version(db, group_id, real_project_id, version)
    if cps is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"CPS version {version} not found",
        )
    now = cps.meta.last_updated
    return GetCpsResponse(
        version=cps.meta.version,
        cps=cps,
        created_at=cps.created_at or now,
        updated_at=now,
    )


@router.patch("", status_code=204)
async def update_cps(
    project_id: str,
    body: UpdateCpsRequest,
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

    existing = get_latest_cps(db, group_id, real_project_id)
    if existing is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="CPS not found",
        )

    project = get_project(db, current_user.group_id, project_id)

    cps_dict = existing.model_dump()
    cps_dict = apply_field_update(cps_dict, body.field_path, body.value)

    # decision_log에 manual_edit 기록
    log_entry = {
        "meeting_id": "",
        "changed": body.field_path,
        "reason": body.reason or "manual_edit",
    }
    cps_dict.setdefault("decision_log", []).append(log_entry)

    new_version = next_version(existing.meta.version)
    cps_dict["meta"]["version"] = new_version
    cps_dict["meta"]["change_type"] = "manual_edit"
    cps_dict["meta"]["last_updated"] = datetime.now(UTC)

    updated_cps = build_cps_from_llm_output(
        raw=cps_dict,
        project_id=real_project_id,
        client=project.client if project else existing.meta.client,
        version=new_version,
        source_meetings=existing.meta.source_meetings,
        change_type="manual_edit",
    )
    save_cps(db, group_id, real_project_id, updated_cps)
