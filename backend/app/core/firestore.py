import json

import firebase_admin
from firebase_admin import credentials, firestore
from google.cloud.firestore import Client

from app.core.config import settings

_db: Client | None = None


def get_db() -> Client:
    global _db
    if _db is None:
        _db = _init_firestore()
    return _db


def _init_firestore() -> Client:
    if not firebase_admin._apps:
        service_account_key = settings.firebase_service_account_key
        if service_account_key:
            # 로컬 개발: JSON 문자열이면 파싱, 파일 경로면 그대로 사용
            try:
                key_dict = json.loads(service_account_key)
                cred = credentials.Certificate(key_dict)
            except (json.JSONDecodeError, ValueError):
                cred = credentials.Certificate(service_account_key)
            firebase_admin.initialize_app(cred, {"projectId": settings.firebase_project_id})
        else:
            # Cloud Run: ADC(Application Default Credentials) 자동 사용
            firebase_admin.initialize_app(options={"projectId": settings.firebase_project_id})

    return firestore.client()


# ── Job Registry ────────────────────────────────────────────────────────────
# pipeline.py에서 job_id만으로 Firestore 경로를 찾기 위한 인메모리 레지스트리.
# Cloud Run 단일 프로세스 환경에서 동작한다.

_job_registry: dict[str, tuple[str, str]] = {}  # job_id → (group_id, project_id)


def register_job(job_id: str, group_id: str, project_id: str) -> None:
    """잡 시작 시 group_id / project_id 경로를 등록한다."""
    _job_registry[job_id] = (group_id, project_id)


async def update_job_state(job_id: str, patch: dict) -> None:
    """pipeline.py에서 호출하는 비동기 잡 상태 업데이트.

    Firestore SDK는 동기식이지만 asyncio 이벤트 루프에서 안전하게 호출 가능하다.
    레지스트리에 없는 job_id는 조용히 무시한다.
    """
    if job_id not in _job_registry:
        return
    group_id, project_id = _job_registry[job_id]
    try:
        db = get_db()
        (
            db.collection("groups")
            .document(group_id)
            .collection("projects")
            .document(project_id)
            .collection("jobs")
            .document(job_id)
            .update(patch)
        )
    except Exception:  # noqa: BLE001
        pass  # 잡 상태 업데이트 실패는 파이프라인을 중단시키지 않는다
