from datetime import datetime

from pydantic import BaseModel


class Project(BaseModel):
    project_id: str
    name: str
    client: str
    color: str = "blue"
    description: str | None = None
    tags: list[str] = []
    status: str = "active"  # "active" | "archived"
    github_repo: str | None = None
    github_auto_commit: bool = False
    created_at: datetime
    last_meeting_at: datetime | None = None


class CreateProjectRequest(BaseModel):
    name: str
    client: str
    color: str = "blue"
    description: str | None = None
    tags: list[str] = []
    github_repo: str | None = None
    github_auto_commit: bool = False


class CreateProjectResponse(BaseModel):
    project_id: str
    name: str
    client: str
    created_at: datetime


class UpdateProjectRequest(BaseModel):
    name: str | None = None
    color: str | None = None
    description: str | None = None
    status: str | None = None  # "active" | "archived"
    tags: list[str] | None = None
    github_repo: str | None = None
    github_auto_commit: bool | None = None


class GetProjectListResponse(BaseModel):
    projects: list[Project]
