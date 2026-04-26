import hashlib
import hmac
import logging
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, Request, Response
from google.cloud.firestore import Client

from app.core.config import settings
from app.core.credits import (
    SUBSCRIPTION_CREDITS_EXPIRE_DAYS,
    SUBSCRIPTION_MONTHLY_CREDITS,
)
from app.core.firestore import get_db
from app.services import billing_service

log = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


def _verify_signature(body: bytes, header: str | None) -> bool:
    """Paddle-Signature 헤더를 HMAC-SHA256으로 검증한다."""
    secret = settings.paddle_webhook_secret
    if not secret:
        log.error("PADDLE_WEBHOOK_SECRET not configured")
        return False
    if not header:
        log.warning("Paddle-Signature header missing")
        return False

    log.debug("Paddle-Signature raw header: %s", header)

    # "ts=1234567890;h1=abcdef..." 형식 파싱
    # h1 값이 = 를 포함할 경우에 대비해 maxsplit=1 사용
    parts = dict(p.split("=", 1) for p in header.split(";") if "=" in p)
    ts = parts.get("ts", "")
    h1 = parts.get("h1", "")

    if not ts or not h1:
        log.warning("Paddle-Signature parse failed: ts=%r h1=%r", ts, h1)
        return False

    signed = f"{ts}:{body.decode('utf-8')}"
    expected = hmac.new(
        secret.encode("utf-8"), signed.encode("utf-8"), hashlib.sha256
    ).hexdigest()

    log.debug("expected=%s  received=%s", expected, h1)
    return hmac.compare_digest(expected, h1)


def _price_id_to_plan(price_id: str) -> str | None:
    if price_id == settings.paddle_price_monthly:
        return "monthly"
    if price_id == settings.paddle_price_annual:
        return "annual"
    return None


def _price_id_to_credits_product(price_id: str) -> str | None:
    mapping = {
        settings.paddle_price_credits_200: "credits_200",
        settings.paddle_price_credits_500: "credits_500",
        settings.paddle_price_credits_1000: "credits_1000",
    }
    return mapping.get(price_id)


# ── event handlers ───────────────────────────────────────────────────────────


def _handle_transaction_completed(db: Client, data: dict) -> None:
    """1회성 크레딧 구매 처리. 구독 결제는 subscription.activated/renewed에서 처리."""
    tx_id = data.get("id", "")
    custom_data = data.get("custom_data") or {}
    user_id = custom_data.get("user_id")
    if not user_id:
        log.warning("transaction.completed: user_id missing in custom_data")
        return

    sub_id = data.get("subscription_id")
    if sub_id:
        return

    if billing_service.is_paddle_tx_processed(db, user_id, tx_id):
        log.info("transaction.completed: already processed tx=%s", tx_id)
        return

    items = data.get("items") or []
    for item in items:
        price_id = (item.get("price") or {}).get("id", "")
        credits_product = _price_id_to_credits_product(price_id)
        if credits_product:
            billing_service.grant_purchased_credits(db, user_id, credits_product, tx_id)
            log.info("Granted %s to user=%s tx=%s", credits_product, user_id, tx_id)


def _handle_subscription_activated(db: Client, data: dict) -> None:
    """구독 최초 활성화 시 subscription 문서 생성 + 첫 달 크레딧 지급."""
    sub_id = data.get("id", "")
    customer_id = data.get("customer_id", "")
    custom_data = data.get("custom_data") or {}
    user_id = custom_data.get("user_id")
    if not user_id:
        log.warning("subscription.activated: user_id missing in custom_data")
        return

    items = data.get("items") or []
    price_id = ((items[0].get("price") or {}).get("id", "")) if items else ""
    plan = _price_id_to_plan(price_id)
    if not plan:
        log.warning("subscription.activated: unknown price_id=%s", price_id)
        return

    period = data.get("current_billing_period") or {}
    period_start = period.get("starts_at")
    period_end = period.get("ends_at")
    now = datetime.now(UTC)

    billing_service.save_subscription(
        db,
        user_id,
        {
            "paddle_customer_id": customer_id,
            "paddle_subscription_id": sub_id,
            "plan": plan,
            "status": "active",
            "current_period_start": period_start,
            "current_period_end": period_end,
            "cancel_at_period_end": False,
            "created_at": now,
            "updated_at": now,
        },
    )

    expires_at = now + timedelta(days=SUBSCRIPTION_CREDITS_EXPIRE_DAYS)
    billing_service.grant_subscription_credits(
        db, user_id, SUBSCRIPTION_MONTHLY_CREDITS, expires_at
    )
    log.info("Subscription activated plan=%s user=%s sub=%s", plan, user_id, sub_id)


def _handle_subscription_updated(db: Client, data: dict) -> None:
    """플랜 변경 / cancel_at_period_end 변경 처리."""
    sub_id = data.get("id", "")
    user_id = billing_service.get_user_id_by_paddle_subscription(db, sub_id)
    if not user_id:
        log.warning("subscription.updated: user_id not found for sub=%s", sub_id)
        return

    status = data.get("status", "active")
    scheduled_change = data.get("scheduled_change") or {}
    cancel_at_period_end = scheduled_change.get("action") == "cancel"
    period = data.get("current_billing_period") or {}

    billing_service.save_subscription(
        db,
        user_id,
        {
            "status": status,
            "current_period_start": period.get("starts_at"),
            "current_period_end": period.get("ends_at"),
            "cancel_at_period_end": cancel_at_period_end,
            "updated_at": datetime.now(UTC),
        },
    )
    log.info("Subscription updated sub=%s user=%s status=%s", sub_id, user_id, status)


def _handle_subscription_canceled(db: Client, data: dict) -> None:
    """구독 취소 처리. 구독 크레딧 만료일 설정."""
    sub_id = data.get("id", "")
    user_id = billing_service.get_user_id_by_paddle_subscription(db, sub_id)
    if not user_id:
        log.warning("subscription.canceled: user_id not found for sub=%s", sub_id)
        return

    now = datetime.now(UTC)
    expires_at = now + timedelta(days=SUBSCRIPTION_CREDITS_EXPIRE_DAYS)

    billing_service.save_subscription(
        db,
        user_id,
        {
            "status": "canceled",
            "cancel_at_period_end": False,
            "updated_at": now,
        },
    )

    credits = billing_service.get_credits(db, user_id)
    if credits.get("subscription_credits", 0) > 0:
        billing_service.set_subscription_credits_expiry(db, user_id, expires_at)

    log.info(
        "Subscription canceled sub=%s user=%s expires=%s", sub_id, user_id, expires_at
    )


def _handle_subscription_renewed(db: Client, data: dict) -> None:
    """구독 갱신 시 월간 크레딧 재지급."""
    sub_id = data.get("id", "")
    tx_id = data.get("transaction_id", "")
    user_id = billing_service.get_user_id_by_paddle_subscription(db, sub_id)
    if not user_id:
        log.warning("subscription.renewed: user_id not found for sub=%s", sub_id)
        return

    if tx_id and billing_service.is_paddle_tx_processed(db, user_id, tx_id):
        log.info("subscription.renewed: already processed tx=%s", tx_id)
        return

    period = data.get("current_billing_period") or {}
    period_end_str = period.get("ends_at")
    now = datetime.now(UTC)
    expires_at = now + timedelta(days=SUBSCRIPTION_CREDITS_EXPIRE_DAYS)

    billing_service.grant_subscription_credits(
        db,
        user_id,
        SUBSCRIPTION_MONTHLY_CREDITS,
        expires_at,
        paddle_tx_id=tx_id or None,
    )
    billing_service.save_subscription(
        db,
        user_id,
        {
            "current_period_start": period.get("starts_at"),
            "current_period_end": period_end_str,
            "updated_at": now,
        },
    )
    log.info("Subscription renewed sub=%s user=%s", sub_id, user_id)


# ── router ───────────────────────────────────────────────────────────────────

_HANDLERS = {
    "transaction.completed": _handle_transaction_completed,
    "subscription.activated": _handle_subscription_activated,
    "subscription.updated": _handle_subscription_updated,
    "subscription.canceled": _handle_subscription_canceled,
    "subscription.renewed": _handle_subscription_renewed,
}


@router.post("/paddle")
async def paddle_webhook(
    request: Request,
    db: Client = Depends(get_db),
) -> Response:
    body = await request.body()
    sig_header = request.headers.get("Paddle-Signature")

    log.info(
        "Paddle webhook received: sig_header=%s body_len=%d",
        sig_header,
        len(body),
    )

    if not _verify_signature(body, sig_header):
        log.warning("Paddle webhook: invalid signature — secret_set=%s sig=%s", bool(settings.paddle_webhook_secret), sig_header)
        return Response(status_code=200)

    try:
        payload = await request.json()
    except Exception:
        log.exception("Paddle webhook: failed to parse JSON")
        return Response(status_code=200)

    event_type = payload.get("event_type", "")
    data = payload.get("data") or {}

    handler = _HANDLERS.get(event_type)
    if handler is None:
        log.debug("Paddle webhook: unhandled event_type=%s", event_type)
        return Response(status_code=200)

    try:
        handler(db, data)
    except Exception:
        log.exception("Paddle webhook: handler error event_type=%s", event_type)

    return Response(status_code=200)
