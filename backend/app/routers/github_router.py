from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.auth import CurrentUser, get_current_user
from app.core.firestore import get_db
from app.services.github_service import (
    collect_project_files,
    get_github_token,
    get_sync_history,
    save_sync_history,
    sync_to_github,
)
from app.services.project_service import get_project

router = APIRouter(prefix="/projects", tags=["github"])


class SyncRequest(BaseModel):
    commit_message: str


@router.get("/{project_id}/github/diff")
async def get_github_diff(
    project_id: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    db = get_db()
    project = get_project(db, current_user.group_id, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    files = collect_project_files(db, current_user.group_id, project_id)
    return {
        "github_repo": project.github_repo,
        "github_auto_commit": project.github_auto_commit,
        "files": [{"path": path, "size": len(content)} for path, content in files.items()],
    }


@router.post("/{project_id}/github/sync", status_code=201)
async def sync_github(
    project_id: str,
    body: SyncRequest,
    current_user: CurrentUser = Depends(get_current_user),
):
    db = get_db()
    project = get_project(db, current_user.group_id, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    if not project.github_repo:
        raise HTTPException(status_code=400, detail="GitHub repo not configured")

    token = get_github_token(db, current_user.user_id)
    if not token:
        raise HTTPException(status_code=400, detail="GitHub token not configured in settings")

    files = collect_project_files(db, current_user.group_id, project_id)
    if not files:
        raise HTTPException(status_code=400, detail="No documents to sync")

    result = sync_to_github(token, project.github_repo, files, body.commit_message)
    save_sync_history(
        db, current_user.group_id, project_id,
        result["commit_sha"], result["commit_url"],
        body.commit_message, result["synced_files"],
    )
    return result


@router.get("/{project_id}/github/syncs")
async def list_sync_history(
    project_id: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    db = get_db()
    project = get_project(db, current_user.group_id, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"syncs": get_sync_history(db, current_user.group_id, project_id)}
