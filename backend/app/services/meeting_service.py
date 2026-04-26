from datetime import UTC, date, datetime

from google.cloud.firestore import Client

from app.models.meeting_model import (
    CreateMeetingRequest,
    CreateMeetingResponse,
    Meeting,
    MeetingSummary,
    UpdateMeetingRequest,
)


def _meetings_ref(db: Client, group_id: str, project_id: str):
    if group_id == "samples":
        root = db.collection("samples").document("projects").collection("data")
    else:
        root = db.collection("groups").document(group_id).collection("projects")
    
    return root.document(project_id).collection("meetings")


def create_meeting(
    db: Client,
    group_id: str,
    project_id: str,
    body: CreateMeetingRequest,
) -> CreateMeetingResponse:
    now = datetime.now(UTC)
    ref = _meetings_ref(db, group_id, project_id).document()

    ref.set(
        {
            "title": body.title,
            "date": body.date,
            "participants": body.participants,
            "content": body.content,
            "summary": None,
            "analysis_status": "pending",
            "created_at": now,
        }
    )

    # 프로젝트의 last_meeting_at 업데이트
    (
        db.collection("groups")
        .document(group_id)
        .collection("projects")
        .document(project_id)
        .update({"last_meeting_at": datetime.combine(date.fromisoformat(body.date), datetime.min.time()).replace(tzinfo=UTC)})
    )

    return CreateMeetingResponse(
        meeting_id=ref.id,
        analysis_status="pending",
        created_at=now,
    )


def get_meeting_list(
    db: Client,
    group_id: str,
    project_id: str,
) -> list[MeetingSummary]:
    docs = (
        _meetings_ref(db, group_id, project_id)
        .order_by("created_at")
        .get()
    )
    return [_doc_to_summary(doc) for doc in docs]


def get_pending_meeting_ids(db: Client, group_id: str, project_id: str) -> list[str]:
    docs = (
        _meetings_ref(db, group_id, project_id)
        .where("analysis_status", "==", "pending")
        .order_by("created_at")
        .get()
    )
    return [doc.id for doc in docs]


def get_meeting(
    db: Client,
    group_id: str,
    project_id: str,
    meeting_id: str,
) -> Meeting | None:
    doc = _meetings_ref(db, group_id, project_id).document(meeting_id).get()
    if not doc.exists:
        return None
    data = doc.to_dict()
    return Meeting(
        meeting_id=doc.id,
        title=data.get("title"),
        date=data["date"],
        participants=data["participants"],
        content=data["content"],
        summary=data.get("summary"),
        analysis_status=data.get("analysis_status", "pending"),
        created_at=data["created_at"],
    )


def update_meeting(
    db: Client,
    group_id: str,
    project_id: str,
    meeting_id: str,
    body: UpdateMeetingRequest,
) -> Meeting | None:
    ref = _meetings_ref(db, group_id, project_id).document(meeting_id)
    doc = ref.get()
    if not doc.exists:
        return None

    updates: dict = {}
    if body.title is not None:
        updates["title"] = body.title
    if body.date is not None:
        updates["date"] = body.date
    if body.participants is not None:
        updates["participants"] = body.participants
    if body.content is not None:
        updates["content"] = body.content
        if body.summary is None:
            updates["summary"] = None
    if body.summary is not None:
        updates["summary"] = body.summary

    if updates:
        ref.update(updates)

    updated = ref.get()
    data = updated.to_dict()
    return Meeting(
        meeting_id=updated.id,
        title=data.get("title"),
        date=data["date"],
        participants=data["participants"],
        content=data["content"],
        summary=data.get("summary"),
        analysis_status=data.get("analysis_status", "pending"),
        created_at=data["created_at"],
    )


def set_analysis_status(
    db: Client,
    group_id: str,
    project_id: str,
    meeting_id: str,
    status: str,
) -> None:
    _meetings_ref(db, group_id, project_id).document(meeting_id).update(
        {"analysis_status": status}
    )


def get_meeting_summary_text(
    db: Client,
    group_id: str,
    project_id: str,
    meeting_id: str,
) -> dict | None:
    doc = _meetings_ref(db, group_id, project_id).document(meeting_id).get()
    if not doc.exists:
        return None
    data = doc.to_dict()
    return {"summary": data.get("summary")}


def get_completed_meetings(
    db: Client,
    group_id: str,
    project_id: str,
    exclude_ids: list[str] | None = None,
) -> list[Meeting]:
    """analysis_status가 completed인 미팅을 반환한다 (summary 포함)."""
    docs = (
        _meetings_ref(db, group_id, project_id)
        .where("analysis_status", "==", "completed")
        .order_by("created_at")
        .get()
    )
    exclude = set(exclude_ids or [])
    result = []
    for doc in docs:
        if doc.id in exclude:
            continue
        data = doc.to_dict()
        result.append(
            Meeting(
                meeting_id=doc.id,
                title=data.get("title"),
                date=data["date"],
                participants=data["participants"],
                content=data["content"],
                summary=data.get("summary"),
                analysis_status=data.get("analysis_status", "pending"),
                created_at=data["created_at"],
            )
        )
    return result


def _doc_to_summary(doc) -> MeetingSummary:
    data = doc.to_dict()
    return MeetingSummary(
        meeting_id=doc.id,
        title=data.get("title"),
        date=data["date"],
        participants=data["participants"],
        analysis_status=data.get("analysis_status", "pending"),
        created_at=data["created_at"],
    )
