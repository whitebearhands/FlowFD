import logging

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.core.auth import CurrentUser, get_current_user
from app.core.config import settings
from app.core.credits import CREDIT_PACKAGES
from app.core.firestore import get_db
from app.services import billing_service

log = logging.getLogger(__name__)
router = APIRouter(prefix="/billing", tags=["billing"])


def _paddle_base_url() -> str:
    if settings.paddle_environment == "sandbox":
        return "https://sandbox-api.paddle.com"
    return "https://api.paddle.com"


def _paddle_headers() -> dict:
    return {
        "Authorization": f"Bearer {settings.paddle_api_key}",
        "Content-Type": "application/json",
    }


# ── checkout ──────────────────────────────────────────────────────────────────


class CheckoutRequest(BaseModel):
    product_type: str  # "subscription" | "credits"
    plan: str | None = None  # "monthly" | "annual"
    credits_product: str | None = None  # "credits_200" | "credits_500" | "credits_1000"


class CheckoutResponse(BaseModel):
    checkout_url: str
    transaction_id: str


def _resolve_price_id(req: CheckoutRequest) -> str | None:
    if req.product_type == "subscription":
        if req.plan == "monthly":
            return settings.paddle_price_monthly
        if req.plan == "annual":
            return settings.paddle_price_annual
    elif req.product_type == "credits":
        mapping = {
            "credits_200": settings.paddle_price_credits_200,
            "credits_500": settings.paddle_price_credits_500,
            "credits_1000": settings.paddle_price_credits_1000,
        }
        return mapping.get(req.credits_product or "")
    return None


@router.post("/checkout", response_model=CheckoutResponse)
async def create_checkout(
    body: CheckoutRequest,
    current_user: CurrentUser = Depends(get_current_user),
) -> CheckoutResponse:
    price_id = _resolve_price_id(body)
    if not price_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid product_type or plan/credits_product",
        )

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{_paddle_base_url()}/transactions",
            headers=_paddle_headers(),
            json={
                "items": [{"price_id": price_id, "quantity": 1}],
                "custom_data": {"user_id": current_user.user_id},
            },
            timeout=15,
        )

    if resp.status_code not in (200, 201):
        log.error("Paddle create transaction failed: %s %s", resp.status_code, resp.text)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to create Paddle checkout session",
        )

    data = resp.json().get("data", {})
    checkout_url = (data.get("checkout") or {}).get("url", "")
    tx_id = data.get("id", "")

    if not checkout_url:
        log.error("Paddle checkout URL missing in response: %s", resp.text)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Paddle checkout URL not returned",
        )

    return CheckoutResponse(checkout_url=checkout_url, transaction_id=tx_id)


# ── credits ───────────────────────────────────────────────────────────────────


class SubscriptionInfo(BaseModel):
    plan: str
    status: str
    current_period_end: str | None
    cancel_at_period_end: bool


class CreditsResponse(BaseModel):
    subscription_credits: int
    purchased_credits: int
    total_credits: int
    subscription: SubscriptionInfo | None


class CreditPackageInfo(BaseModel):
    credits: int
    price_usd: float


class CreditsConfigResponse(BaseModel):
    packages: dict[str, CreditPackageInfo]


@router.get("/credits", response_model=CreditsResponse)
async def get_credits(
    current_user: CurrentUser = Depends(get_current_user),
) -> CreditsResponse:
    db = get_db()
    credits = billing_service.get_credits(db, current_user.user_id)
    sub = billing_service.get_subscription(db, current_user.user_id)

    sub_info = None
    if sub:
        period_end = sub.get("current_period_end")
        if hasattr(period_end, "isoformat"):
            period_end = period_end.isoformat()
        sub_info = SubscriptionInfo(
            plan=sub.get("plan", "none"),
            status=sub.get("status", ""),
            current_period_end=period_end,
            cancel_at_period_end=sub.get("cancel_at_period_end", False),
        )

    return CreditsResponse(
        subscription_credits=credits.get("subscription_credits", 0),
        purchased_credits=credits.get("purchased_credits", 0),
        total_credits=credits.get("total_credits", 0),
        subscription=sub_info,
    )


@router.get("/config", response_model=CreditsConfigResponse)
async def get_credits_config(
    _: CurrentUser = Depends(get_current_user),
) -> CreditsConfigResponse:
    """프론트엔드가 Paddle Overlay 열 때 필요한 크레딧 패키지 정보."""
    return CreditsConfigResponse(
        packages={k: CreditPackageInfo(**v) for k, v in CREDIT_PACKAGES.items()}
    )


# ── subscription cancel / resume ─────────────────────────────────────────────


def _get_paddle_sub_id(db, user_id: str) -> str:
    sub = billing_service.get_subscription(db, user_id)
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No subscription found",
        )
    paddle_sub_id = sub.get("paddle_subscription_id")
    if not paddle_sub_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Subscription has no Paddle ID",
        )
    return paddle_sub_id


@router.post("/subscription/cancel", status_code=204)
async def cancel_subscription(
    current_user: CurrentUser = Depends(get_current_user),
) -> None:
    db = get_db()
    paddle_sub_id = _get_paddle_sub_id(db, current_user.user_id)

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{_paddle_base_url()}/subscriptions/{paddle_sub_id}/cancel",
            headers=_paddle_headers(),
            json={"effective_from": "next_billing_period"},
            timeout=15,
        )

    if resp.status_code not in (200, 201):
        log.error("Paddle cancel failed: %s %s", resp.status_code, resp.text)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to cancel subscription via Paddle",
        )


@router.post("/subscription/resume", status_code=204)
async def resume_subscription(
    current_user: CurrentUser = Depends(get_current_user),
) -> None:
    """예약된 취소(cancel_at_period_end)를 철회한다."""
    db = get_db()
    paddle_sub_id = _get_paddle_sub_id(db, current_user.user_id)

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{_paddle_base_url()}/subscriptions/{paddle_sub_id}/resume",
            headers=_paddle_headers(),
            json={},
            timeout=15,
        )

    if resp.status_code not in (200, 201):
        log.error("Paddle resume failed: %s %s", resp.status_code, resp.text)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to resume subscription via Paddle",
        )
