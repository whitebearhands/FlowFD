from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from firebase_admin import auth

from app.core.firestore import get_db
from app.models.user_model import (
    JoinGroupRequest,
    JoinGroupResponse,
    RegisterRequest,
    RegisterResponse,
)
from app.services import billing_service
from app.services.group_service import (
    add_member,
    create_group,
    get_group_by_invite_code,
)
from app.services.user_service import create_user, is_user_registered

router = APIRouter(prefix="/auth", tags=["auth"])
bearer_scheme = HTTPBearer()


def _verify_token(token: str) -> dict:
    try:
        return auth.verify_id_token(token)
    except auth.ExpiredIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
        )
    except auth.InvalidIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )


@router.post("/register", response_model=RegisterResponse, status_code=201)
async def register(
    body: RegisterRequest,
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> RegisterResponse:
    """신규 가입: 사용자 문서 생성 + 새 그룹 생성."""
    decoded = _verify_token(credentials.credentials)
    user_id = decoded["uid"]
    email = decoded.get("email", "")

    db = get_db()

    if is_user_registered(db, user_id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User already registered",
        )

    group_id = create_group(db, body.group_name, user_id)
    create_user(db, user_id, email, body.display_name, group_id, body.github_pat)
    billing_service.initialize_free_credits(db, user_id)

    return RegisterResponse(
        user_id=user_id,
        group_id=group_id,
        display_name=body.display_name,
    )


@router.post("/join-group", response_model=JoinGroupResponse, status_code=201)
async def join_group(
    body: JoinGroupRequest,
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> JoinGroupResponse:
    """초대코드로 기존 그룹 합류: 사용자 문서 생성 + 멤버 추가."""
    decoded = _verify_token(credentials.credentials)
    user_id = decoded["uid"]
    email = decoded.get("email", "")

    db = get_db()

    if is_user_registered(db, user_id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User already registered",
        )

    group_id = get_group_by_invite_code(db, body.invite_code)
    if group_id is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid invite code",
        )

    add_member(db, group_id, user_id)
    create_user(db, user_id, email, body.display_name, group_id, body.github_pat)
    billing_service.initialize_free_credits(db, user_id)

    return JoinGroupResponse(
        user_id=user_id,
        group_id=group_id,
        display_name=body.display_name,
    )
