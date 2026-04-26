import dis

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.core.auth import CurrentUser, get_current_user
from app.core.firestore import get_db
from app.services.user_service import get_user, update_user_settings

router = APIRouter(prefix="/settings", tags=["settings"])


class LlmDefaultModels(BaseModel):
    cps_generation: str = "gemini-2.5-flash"
    prd_generation: str = "gemini-2.5-flash"
    code_generation: str = "gemini-2.5-flash"


class LlmSettingsRequest(BaseModel):
    default_models: LlmDefaultModels | None = None


class GithubSettingsRequest(BaseModel):
    personal_access_token: str | None = None


class AutomationSettingsRequest(BaseModel):
    default_analysis_mode: str = "smart"  # "smart" | "full"
    auto_analyze: bool = True
    auto_analyze_cps: bool = True
    auto_analyze_prd: bool = True


class DisplaySettingsRequest(BaseModel):
    language: str = "ko"
    timezone: str = "Asia/Seoul"
    dateFormat: str = "YYYY.MM.DD"


class SettingsResponse(BaseModel):
    locale: str
    timezone: str
    llm: dict
    github: dict | None
    automation: dict
    display: dict | None = None


@router.get("", response_model=SettingsResponse)
async def get_settings(
    current_user: CurrentUser = Depends(get_current_user),
) -> SettingsResponse:
    db = get_db()
    user = get_user(db, current_user.user_id)
    if user is None:
        return SettingsResponse(
            locale="ko",
            timezone="Asia/Seoul",
            llm={},
            github=None,
            automation={
                "default_analysis_mode": "smart",
                "auto_analyze": False,
                "auto_analyze_cps": False,
                "auto_analyze_prd": False,
            },
        )
    s = user.get("settings", {})
    github_raw = s.get("github") or {}
    github = github_raw if github_raw.get("personal_access_token") else None
    return SettingsResponse(
        locale=s.get("locale", "ko"),
        timezone=s.get("timezone", "Asia/Seoul"),
        llm=s.get("llm", {}),
        github=github,
        automation=s.get(
            "automation",
            {
                "default_analysis_mode": "smart",
                "auto_analyze": False,
                "auto_analyze_cps": False,
                "auto_analyze_prd": False,
            },
        ),
        display=s.get(
            "display",
            {"language": "ko", "timezone": "Asia/Seoul", "dateFormat": "YYYY.MM.DD"},
        ),
    )


@router.patch("/llm", status_code=204)
async def patch_llm_settings(
    body: LlmSettingsRequest,
    current_user: CurrentUser = Depends(get_current_user),
) -> None:
    db = get_db()
    if body.default_models is not None:
        patch = {
            f"settings.llm.default_models.{field}": model
            for field, model in body.default_models.model_dump().items()
        }
        update_user_settings(db, current_user.user_id, patch)


@router.patch("/github", status_code=204)
async def patch_github_settings(
    body: GithubSettingsRequest,
    current_user: CurrentUser = Depends(get_current_user),
) -> None:
    db = get_db()
    if body.personal_access_token is not None:
        pat = body.personal_access_token.strip()
        if pat:
            update_user_settings(
                db,
                current_user.user_id,
                {"settings.github.personal_access_token": pat},
            )
        else:
            # 빈 문자열 = 연결 해제: github 필드 전체를 null로
            update_user_settings(
                db,
                current_user.user_id,
                {"settings.github": None},
            )


@router.patch("/automation", status_code=204)
async def patch_automation_settings(
    body: AutomationSettingsRequest,
    current_user: CurrentUser = Depends(get_current_user),
) -> None:
    db = get_db()
    update_user_settings(
        db,
        current_user.user_id,
        {
            "settings.automation.default_analysis_mode": body.default_analysis_mode,
            "settings.automation.auto_analyze": body.auto_analyze,
            "settings.automation.auto_analyze_cps": body.auto_analyze_cps,
            "settings.automation.auto_analyze_prd": body.auto_analyze_prd,
        },
    )


@router.patch("/display", status_code=204)
async def patch_display_settings(
    body: DisplaySettingsRequest,
    current_user: CurrentUser = Depends(get_current_user),
) -> None:
    db = get_db()
    update_user_settings(
        db,
        current_user.user_id,
        {
            "settings.display.language": body.language,
            "settings.display.timezone": body.timezone,
            "settings.display.dateFormat": body.dateFormat,
        },
    )
