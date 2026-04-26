import secrets
import string
from datetime import UTC, datetime

from google.cloud.firestore import Client


INVITE_CODE_LENGTH = 8


def _generate_invite_code() -> str:
    alphabet = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(INVITE_CODE_LENGTH))


def create_group(db: Client, name: str, admin_user_id: str) -> str:
    """그룹을 생성하고 group_id를 반환한다."""
    invite_code = _generate_invite_code()
    group_ref = db.collection("groups").document()
    group_id = group_ref.id

    group_ref.set(
        {
            "name": name,
            "invite_code": invite_code,
            "created_at": datetime.now(UTC),
        }
    )

    member_ref = group_ref.collection("members").document(admin_user_id)
    member_ref.set(
        {
            "role": "admin",
            "joined_at": datetime.now(UTC),
        }
    )

    return group_id


def get_group_by_invite_code(db: Client, invite_code: str) -> str | None:
    """초대코드로 group_id를 조회한다. 없으면 None 반환."""
    query = (
        db.collection("groups").where("invite_code", "==", invite_code).limit(1)
    )
    docs = query.get()
    if not docs:
        return None
    return docs[0].id


def add_member(db: Client, group_id: str, user_id: str) -> None:
    """그룹에 멤버를 추가한다."""
    member_ref = (
        db.collection("groups")
        .document(group_id)
        .collection("members")
        .document(user_id)
    )
    member_ref.set(
        {
            "role": "member",
            "joined_at": datetime.now(UTC),
        }
    )
