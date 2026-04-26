import logging
import sys
from contextlib import asynccontextmanager

logging.basicConfig(
    level=logging.INFO,
    stream=sys.stdout,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.firestore import get_db
from app.routers.auth_router import router as auth_router
from app.routers.billing_router import router as billing_router
from app.routers.cps_router import router as cps_router
from app.routers.github_router import router as github_router
from app.routers.meeting_router import router as meeting_router
from app.routers.plan_router import router as plan_router
from app.routers.prd_router import router as prd_router
from app.routers.project_router import router as project_router
from app.routers.settings_router import router as settings_router
from app.routers.webhook_router import router as webhook_router


@asynccontextmanager
async def lifespan(_: FastAPI):
    # 앱 시작 시 Firebase Admin 초기화
    get_db()
    yield


app = FastAPI(
    title="FlowFD API",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)

app.include_router(auth_router, prefix="/v1")
app.include_router(billing_router, prefix="/v1")
app.include_router(project_router, prefix="/v1")
app.include_router(meeting_router, prefix="/v1")
app.include_router(cps_router, prefix="/v1")
app.include_router(prd_router, prefix="/v1")
app.include_router(plan_router, prefix="/v1")
app.include_router(settings_router, prefix="/v1")
app.include_router(github_router, prefix="/v1")
app.include_router(webhook_router, prefix="/v1")


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}
