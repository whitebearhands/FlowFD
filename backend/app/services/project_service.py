from datetime import UTC, datetime

from google.cloud.firestore import Client

from app.models.project_model import (
    CreateProjectRequest,
    CreateProjectResponse,
    Project,
    UpdateProjectRequest,
)


def _projects_ref(db: Client, group_id: str):
    if group_id == "samples":
        return db.collection("samples").document("projects").collection("data")
    return db.collection("groups").document(group_id).collection("projects")


def resolve_project_params(project_id: str, default_group_id: str) -> tuple[str, str]:
    if project_id and project_id.startswith("sample-"):
        return "samples", project_id[len("sample-") :]
    return default_group_id, project_id


def create_project(
    db: Client,
    group_id: str,
    body: CreateProjectRequest,
) -> CreateProjectResponse:
    ref = _projects_ref(db, group_id).document()
    now = datetime.now(UTC)
    ref.set(
        {
            "name": body.name,
            "client": body.client,
            "color": body.color,
            "description": body.description,
            "tags": body.tags,
            "status": "active",
            "github_repo": body.github_repo,
            "github_auto_commit": body.github_auto_commit,
            "created_at": now,
            "last_meeting_at": None,
        }
    )
    return CreateProjectResponse(
        project_id=ref.id,
        name=body.name,
        client=body.client,
        created_at=now,
    )


def get_project_list(db: Client, group_id: str) -> list[Project]:
    docs = _projects_ref(db, group_id).order_by("created_at").get()
    prefix = "sample-" if group_id == "samples" else ""
    return [_doc_to_project(doc, prefix) for doc in docs]


def get_project(db: Client, group_id: str, project_id: str) -> Project | None:
    doc = _projects_ref(db, group_id).document(project_id).get()
    if not doc.exists:
        return None
    return _doc_to_project(doc)


def update_project(
    db: Client,
    group_id: str,
    project_id: str,
    body: UpdateProjectRequest,
) -> None:
    data = body.model_dump()
    updates = {k: v for k, v in data.items() if v is not None}
    # github_auto_commit은 False도 유효한 값이므로 별도 처리
    if data.get("github_auto_commit") is not None:
        updates["github_auto_commit"] = data["github_auto_commit"]
    if not updates:
        return
    _projects_ref(db, group_id).document(project_id).update(updates)


def _doc_to_project(doc, id_prefix: str = "") -> Project:
    data = doc.to_dict()
    return Project(
        project_id=f"{id_prefix}{doc.id}",
        name=data["name"],
        client=data["client"],
        color=data.get("color", "blue"),
        description=data.get("description"),
        tags=data.get("tags", []),
        status=data.get("status", "active"),
        github_repo=data.get("github_repo"),
        github_auto_commit=data.get("github_auto_commit", False),
        created_at=data["created_at"],
        last_meeting_at=data.get("last_meeting_at"),
    )
