from fastapi import APIRouter, Depends, HTTPException, status

from app.core.auth import CurrentUser, get_current_user
from app.core.firestore import get_db
from app.models.project_model import (
    CreateProjectRequest,
    CreateProjectResponse,
    GetProjectListResponse,
    Project,
    UpdateProjectRequest,
)
from app.services.project_service import (
    create_project,
    get_project,
    get_project_list,
    resolve_project_params,
    update_project,
)

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("", response_model=GetProjectListResponse)
async def list_projects(
    current_user: CurrentUser = Depends(get_current_user),
) -> GetProjectListResponse:
    db = get_db()
    projects = get_project_list(db, current_user.group_id)
    return GetProjectListResponse(projects=projects)


@router.get("/samples", response_model=GetProjectListResponse)
async def list_sample_projects(
    current_user: CurrentUser = Depends(get_current_user),
) -> GetProjectListResponse:
    db = get_db()
    projects = get_project_list(db, "samples")
    return GetProjectListResponse(projects=projects)


@router.post("", response_model=CreateProjectResponse, status_code=201)
async def create_project_endpoint(
    body: CreateProjectRequest,
    current_user: CurrentUser = Depends(get_current_user),
) -> CreateProjectResponse:
    db = get_db()
    return create_project(db, current_user.group_id, body)


@router.get("/{project_id}", response_model=Project)
async def get_project_endpoint(
    project_id: str,
    current_user: CurrentUser = Depends(get_current_user),
) -> Project:
    db = get_db()
    group_id, real_project_id = resolve_project_params(project_id, current_user.group_id)
    project = get_project(db, group_id, real_project_id)
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )
    return project


@router.patch("/{project_id}", status_code=204)
async def update_project_endpoint(
    project_id: str,
    body: UpdateProjectRequest,
    current_user: CurrentUser = Depends(get_current_user),
) -> None:
    db = get_db()
    group_id, real_project_id = resolve_project_params(project_id, current_user.group_id)
    
    if group_id == "samples":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Sample projects are read-only",
        )

    project = get_project(db, group_id, project_id)
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )
    update_project(db, group_id, real_project_id, body)
