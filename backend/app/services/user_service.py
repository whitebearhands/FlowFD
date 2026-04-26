from datetime import UTC, datetime

from google.cloud.firestore import Client, Increment


def create_user(
    db: Client,
    user_id: str,
    email: str,
    display_name: str,
    group_id: str,
    github_pat: str | None = None,
) -> None:
    """users/{userId} 문서를 생성한다."""
    user_ref = db.collection("users").document(user_id)
    user_ref.set(
        {
            "email": email,
            "display_name": display_name,
            "group_id": group_id,
            "created_at": datetime.now(UTC),
            "settings": {
                "github": {"personal_access_token": github_pat} if github_pat else None,
                "display": {
                    "language": "en",
                    "timezone": "Asia/Seoul",
                    "date_format": "YYYY.MM.DD",
                },
                "automation": {
                    "default_analysis_mode": "smart",
                    "auto_analyze": False,
                    "auto_analyze_cps": False,
                    "auto_analyze_prd": False,
                },
            },
        }
    )


def get_user(db: Client, user_id: str) -> dict | None:
    """users/{userId} 문서를 조회한다."""
    doc = db.collection("users").document(user_id).get()
    if not doc.exists:
        return None
    return doc.to_dict()


def is_user_registered(db: Client, user_id: str) -> bool:
    """사용자가 이미 가입했는지 확인한다."""
    doc = db.collection("users").document(user_id).get()
    return doc.exists


def update_user_settings(db: Client, user_id: str, patch: dict) -> None:
    """users/{userId} 문서의 settings 필드를 부분 업데이트한다.
    patch 키는 Firestore 점표기법 경로를 사용한다.
    예: {"settings.llm.api_keys.gemini": "key-value"}
    """
    db.collection("users").document(user_id).update(patch)
