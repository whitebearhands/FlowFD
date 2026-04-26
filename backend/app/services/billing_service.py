import logging
from datetime import UTC, datetime

from google.cloud.firestore import Client

from app.core.credits import (
    CREDIT_PACKAGES,
    FREE_INITIAL_CREDITS,
    SUBSCRIPTION_CREDITS_MAX_CARRY,
)

log = logging.getLogger(__name__)

_CREDITS_DOC = "current"
_SUBSCRIPTION_DOC = "current"


# ── helpers ──────────────────────────────────────────────────────────────────

def _credits_ref(db: Client, user_id: str):
    return db.collection("users").document(user_id).collection("credits").document(_CREDITS_DOC)


def _subscription_ref(db: Client, user_id: str):
    return db.collection("users").document(user_id).collection("subscription").document(_SUBSCRIPTION_DOC)


def _transactions_ref(db: Client, user_id: str):
    return db.collection("users").document(user_id).collection("credit_transactions")


def _get_or_init_credits(db: Client, user_id: str) -> dict:
    doc = _credits_ref(db, user_id).get()
    if doc.exists:
        return doc.to_dict()
    now = datetime.now(UTC)
    data = {
        "subscription_credits": 0,
        "subscription_credits_expires_at": None,
        "purchased_credits": 0,
        "total_credits": 0,
        "updated_at": now,
    }
    _credits_ref(db, user_id).set(data)
    return data


# ── public API ───────────────────────────────────────────────────────────────

def get_credits(db: Client, user_id: str) -> dict:
    return _get_or_init_credits(db, user_id)


def get_subscription(db: Client, user_id: str) -> dict | None:
    doc = _subscription_ref(db, user_id).get()
    return doc.to_dict() if doc.exists else None


def grant_subscription_credits(
    db: Client,
    user_id: str,
    amount: int,
    expires_at: datetime,
    paddle_tx_id: str | None = None,
) -> None:
    """구독 크레딧 지급. 이월 한도(SUBSCRIPTION_CREDITS_MAX_CARRY) 적용."""
    credits = _get_or_init_credits(db, user_id)
    current = credits.get("subscription_credits", 0)
    new_balance = min(current + amount, SUBSCRIPTION_CREDITS_MAX_CARRY)
    total = new_balance + credits.get("purchased_credits", 0)
    now = datetime.now(UTC)

    _credits_ref(db, user_id).update({
        "subscription_credits": new_balance,
        "subscription_credits_expires_at": expires_at,
        "total_credits": total,
        "updated_at": now,
    })

    _transactions_ref(db, user_id).add({
        "user_id": user_id,
        "type": "subscription_grant",
        "amount": new_balance - current,
        "balance_after": total,
        "description": f"구독 크레딧 지급 ({amount} 크레딧)",
        "job_id": None,
        "paddle_transaction_id": paddle_tx_id,
        "created_at": now,
    })


def grant_purchased_credits(
    db: Client,
    user_id: str,
    credits_product: str,
    paddle_tx_id: str,
) -> None:
    """1회성 크레딧 구매 지급. 중복 방지는 호출 전에 확인."""
    package = CREDIT_PACKAGES.get(credits_product)
    if package is None:
        log.error("Unknown credits_product: %s", credits_product)
        return
    amount = package["credits"]
    credits = _get_or_init_credits(db, user_id)
    new_purchased = credits.get("purchased_credits", 0) + amount
    total = credits.get("subscription_credits", 0) + new_purchased
    now = datetime.now(UTC)

    _credits_ref(db, user_id).update({
        "purchased_credits": new_purchased,
        "total_credits": total,
        "updated_at": now,
    })

    _transactions_ref(db, user_id).add({
        "user_id": user_id,
        "type": "purchase",
        "amount": amount,
        "balance_after": total,
        "description": f"크레딧 충전 ({amount} 크레딧)",
        "job_id": None,
        "paddle_transaction_id": paddle_tx_id,
        "created_at": now,
    })


def deduct_credits(
    db: Client,
    user_id: str,
    amount: int,
    description: str,
    job_id: str | None = None,
) -> int:
    """크레딧 차감. 구독 크레딧 → 충전 크레딧 순서. 차감 후 잔액 반환."""
    credits = _get_or_init_credits(db, user_id)
    sub = credits.get("subscription_credits", 0)
    purchased = credits.get("purchased_credits", 0)

    remaining = amount
    new_sub = sub
    new_purchased = purchased

    if sub > 0:
        use_sub = min(sub, remaining)
        new_sub -= use_sub
        remaining -= use_sub

    if remaining > 0:
        use_purchased = min(purchased, remaining)
        new_purchased -= use_purchased
        remaining -= use_purchased

    new_total = new_sub + new_purchased
    now = datetime.now(UTC)

    _credits_ref(db, user_id).update({
        "subscription_credits": new_sub,
        "purchased_credits": new_purchased,
        "total_credits": new_total,
        "updated_at": now,
    })

    _transactions_ref(db, user_id).add({
        "user_id": user_id,
        "type": "usage",
        "amount": -(amount - remaining),
        "balance_after": new_total,
        "description": description,
        "job_id": job_id,
        "paddle_transaction_id": None,
        "created_at": now,
    })

    return new_total


def has_enough_credits(db: Client, user_id: str, required: int) -> bool:
    credits = _get_or_init_credits(db, user_id)
    return credits.get("total_credits", 0) >= required


def save_subscription(db: Client, user_id: str, data: dict) -> None:
    _subscription_ref(db, user_id).set(data, merge=True)


def set_subscription_credits_expiry(db: Client, user_id: str, expires_at: datetime) -> None:
    _credits_ref(db, user_id).update({
        "subscription_credits_expires_at": expires_at,
        "updated_at": datetime.now(UTC),
    })


def is_paddle_tx_processed(db: Client, user_id: str, paddle_tx_id: str) -> bool:
    """멱등성 체크: 이미 처리된 paddle_transaction_id인지 확인."""
    docs = (
        _transactions_ref(db, user_id)
        .where("paddle_transaction_id", "==", paddle_tx_id)
        .limit(1)
        .get()
    )
    return len(docs) > 0


def initialize_free_credits(db: Client, user_id: str) -> None:
    """신규 가입 시 무료 크레딧 지급."""
    now = datetime.now(UTC)
    _credits_ref(db, user_id).set({
        "subscription_credits": 0,
        "subscription_credits_expires_at": None,
        "purchased_credits": FREE_INITIAL_CREDITS,
        "total_credits": FREE_INITIAL_CREDITS,
        "updated_at": now,
    })
    _transactions_ref(db, user_id).add({
        "user_id": user_id,
        "type": "purchase",
        "amount": FREE_INITIAL_CREDITS,
        "balance_after": FREE_INITIAL_CREDITS,
        "description": "신규 가입 무료 크레딧",
        "job_id": None,
        "paddle_transaction_id": None,
        "created_at": now,
    })


def get_user_id_by_paddle_subscription(db: Client, paddle_sub_id: str) -> str | None:
    """paddle_subscription_id로 user_id 역조회."""
    docs = (
        db.collection_group("subscription")
        .where("paddle_subscription_id", "==", paddle_sub_id)
        .limit(1)
        .get()
    )
    if not docs:
        return None
    # path: users/{userId}/subscription/current
    return docs[0].reference.parent.parent.id
