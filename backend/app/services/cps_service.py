from datetime import UTC, datetime

from google.cloud.firestore import Client

from app.models.cps_model import CpsDocument, CpsMeta


def _cps_ref(db: Client, group_id: str, project_id: str):
    if group_id == "samples":
        root = db.collection("samples").document("projects").collection("data")
    else:
        root = db.collection("groups").document(group_id).collection("projects")
    
    return root.document(project_id).collection("cps")


def get_latest_cps(db: Client, group_id: str, project_id: str) -> CpsDocument | None:
    """최신 버전 CPS를 조회한다."""
    docs = (
        _cps_ref(db, group_id, project_id)
        .order_by("created_at", direction="DESCENDING")
        .limit(1)
        .get()
    )
    if not docs:
        return None
    return _doc_to_cps(docs[0])


def get_cps_by_version(
    db: Client, group_id: str, project_id: str, version: str
) -> CpsDocument | None:
    doc = _cps_ref(db, group_id, project_id).document(version).get()
    if not doc.exists:
        return None
    return _doc_to_cps(doc)


def get_cps_versions(db: Client, group_id: str, project_id: str) -> list[dict]:
    docs = (
        _cps_ref(db, group_id, project_id)
        .order_by("created_at", direction="DESCENDING")
        .get()
    )
    result = []
    for doc in docs:
        data = doc.to_dict()
        result.append(
            {
                "version": doc.id,
                "changed_fields": data.get("meta", {}).get("changed_fields", []),
                "source_meeting_id": _get_latest_source_meeting(data),
                "change_type": data.get("meta", {}).get("change_type", "auto"),
                "created_at": data.get("created_at"),
            }
        )
    return result


def save_cps(db: Client, group_id: str, project_id: str, cps: CpsDocument) -> None:
    """CPS를 Firestore에 저장한다. version을 doc ID로 사용."""
    now = datetime.now(UTC)
    data = cps.model_dump()
    data["created_at"] = now
    _cps_ref(db, group_id, project_id).document(cps.meta.version).set(data)


def next_version(current: str | None) -> str:
    """버전 번호를 증가시킨다. None이면 1.0.0 반환."""
    if current is None:
        return "1.0.0"
    parts = current.split(".")
    major, minor, patch = int(parts[0]), int(parts[1]), int(parts[2])
    return f"{major}.{minor + 1}.{patch}"


def apply_field_update(cps_dict: dict, field_path: str, value: object) -> dict:
    """dot-notation field_path로 CPS dict의 특정 필드를 업데이트한다."""
    keys = field_path.split(".")
    node = cps_dict
    for key in keys[:-1]:
        if key not in node or not isinstance(node[key], dict):
            node[key] = {}
        node = node[key]
    node[keys[-1]] = value
    return cps_dict


def _get_latest_source_meeting(data: dict) -> str | None:
    meetings = data.get("meta", {}).get("source_meetings", [])
    return meetings[-1] if meetings else None


def _doc_to_cps(doc) -> CpsDocument:
    data = doc.to_dict()
    cps = CpsDocument.model_validate(data)
    cps.meta.version = doc.id
    return cps


def diff_cps(old: CpsDocument, new_dict: dict) -> list[str]:
    """두 CPS를 비교해서 변경된 최상위 섹션 이름 목록을 반환한다."""
    SECTIONS = [
        "context",
        "problem",
        "solution",
        "assumptions",
        "out_of_scope",
        "risks",
        "pending",
    ]
    changed = []
    old_dict = old.model_dump()
    for section in SECTIONS:
        if old_dict.get(section) != new_dict.get(section):
            changed.append(section)
    return changed


def build_cps_from_llm_output(
    raw: dict,
    project_id: str,
    client: str,
    version: str,
    source_meetings: list[str],
    change_type: str = "auto",
) -> CpsDocument:
    """LLM 출력 dict를 CpsDocument로 변환한다."""
    cps_data = raw.get("CPS", raw)
    meta = CpsMeta(
        project_id=project_id,
        client=client,
        version=version,
        last_updated=datetime.now(UTC),
        source_meetings=source_meetings,
        change_type=change_type,
    )
    cps_data["meta"] = meta.model_dump()
    return CpsDocument.model_validate(cps_data)
