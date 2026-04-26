from datetime import UTC, datetime

from google.cloud.firestore import Client

DOC_ID = "latest"


def _design_ref(db: Client, group_id: str, project_id: str):
    if group_id == "samples":
        root = db.collection("samples").document("projects").collection("data")
    else:
        root = db.collection("groups").document(group_id).collection("projects")
    
    return root.document(project_id).collection("design").document(DOC_ID)


def _jobs_ref(db: Client, group_id: str, project_id: str):
    if group_id == "samples":
        root = db.collection("samples").document("projects").collection("data")
    else:
        root = db.collection("groups").document(group_id).collection("projects")
    
    return root.document(project_id).collection("jobs")


def get_design(db: Client, group_id: str, project_id: str) -> dict | None:
    doc = _design_ref(db, group_id, project_id).get()
    if not doc.exists:
        return None
    return doc.to_dict()


def save_plan(db: Client, group_id: str, project_id: str, plan: dict) -> None:
    ref = _design_ref(db, group_id, project_id)
    doc = ref.get()
    if doc.exists:
        ref.update({"plan": plan, "updated_at": datetime.now(UTC)})
    else:
        ref.set({"plan": plan, "architecture": None, "updated_at": datetime.now(UTC)})


def save_architecture(
    db: Client, group_id: str, project_id: str, architecture: dict
) -> None:
    ref = _design_ref(db, group_id, project_id)
    doc = ref.get()
    if doc.exists:
        ref.update({"architecture": architecture, "updated_at": datetime.now(UTC)})
    else:
        ref.set(
            {
                "plan": None,
                "architecture": architecture,
                "updated_at": datetime.now(UTC),
            }
        )


def create_job(db: Client, group_id: str, project_id: str, job_type: str) -> str:
    ref = _jobs_ref(db, group_id, project_id).document()
    ref.set(
        {
            "type": job_type,
            "status": "processing",
            "result": None,
            "error": None,
            "created_at": datetime.now(UTC),
            "completed_at": None,
        }
    )
    return ref.id


def complete_job(
    db: Client,
    group_id: str,
    project_id: str,
    job_id: str,
    success: bool,
    error: str | None = None,
) -> None:
    _jobs_ref(db, group_id, project_id).document(job_id).update(
        {
            "status": "completed" if success else "failed",
            "error": error,
            "completed_at": datetime.now(UTC),
        }
    )
