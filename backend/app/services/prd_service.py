from datetime import UTC, datetime

from google.cloud.firestore import Client


def _prd_ref(db: Client, group_id: str, project_id: str):
    if group_id == "samples":
        root = db.collection("samples").document("projects").collection("data")
    else:
        root = db.collection("groups").document(group_id).collection("projects")
    
    return root.document(project_id).collection("prd")


def get_latest_prd(db: Client, group_id: str, project_id: str) -> dict | None:
    """최신 버전 PRD를 조회한다."""
    docs = (
        _prd_ref(db, group_id, project_id)
        .order_by("created_at", direction="DESCENDING")
        .limit(1)
        .get()
    )
    if not docs:
        return None
    return {"version": docs[0].id, **docs[0].to_dict()}


def get_prd_by_version(
    db: Client, group_id: str, project_id: str, version: str
) -> dict | None:
    doc = _prd_ref(db, group_id, project_id).document(version).get()
    if not doc.exists:
        return None
    return {"version": doc.id, **doc.to_dict()}


def get_prd_versions(db: Client, group_id: str, project_id: str) -> list[dict]:
    docs = (
        _prd_ref(db, group_id, project_id)
        .order_by("created_at", direction="DESCENDING")
        .get()
    )
    return [
        {
            "version": doc.id,
            "source_cps_version": doc.to_dict().get("source_cps_version", ""),
            "change_type": doc.to_dict().get("change_type", "auto"),
            "created_at": doc.to_dict().get("created_at"),
        }
        for doc in docs
    ]


def save_prd(
    db: Client,
    group_id: str,
    project_id: str,
    version: str,
    content: dict,
    source_cps_version: str,
    change_type: str = "auto",
) -> None:
    now = datetime.now(UTC)
    _prd_ref(db, group_id, project_id).document(version).set(
        {
            "content": content,
            "source_cps_version": source_cps_version,
            "change_type": change_type,
            "created_at": now,
        }
    )


def next_version(current: str | None) -> str:
    if current is None:
        return "1.0.0"
    parts = current.split(".")
    major, minor, patch = int(parts[0]), int(parts[1]), int(parts[2])
    return f"{major}.{minor + 1}.{patch}"
