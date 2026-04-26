from fastapi import HTTPException, status


def raise_if_insufficient(balance: int, required: int) -> None:
    """잔액이 부족하면 402 에러를 발생시킨다."""
    if balance < required:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={
                "error": "insufficient_credits",
                "balance": balance,
                "required": required,
                "message": f"크레딧이 부족합니다. 현재 잔액: {balance} 크레딧",
            },
        )
