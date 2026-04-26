from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status

from app.core.auth import CurrentUser, get_current_user
from app.core.billing_deps import raise_if_insufficient
from app.core.credits import calc_analyze_credits
from app.core.firestore import get_db
from app.jobs import cps_analyzer_job, meeting_summary_job
from app.models.meeting_model import (
    AnalyzeRequest,
    CreateMeetingRequest,
    CreateMeetingResponse,
    GetMeetingListResponse,
    Meeting,
    MeetingSummaryTextResponse,
    ReanalyzeMeetingResponse,
    UpdateMeetingRequest,
)
from app.services import billing_service
from app.services.meeting_service import (
    create_meeting,
    get_meeting,
    get_meeting_list,
    get_meeting_summary_text,
    get_pending_meeting_ids,
    set_analysis_status,
    update_meeting,
)
from app.services.project_service import get_project, resolve_project_params

router = APIRouter(prefix="/projects/{project_id}/meetings", tags=["meetings"])


def _check_project(db, group_id: str, project_id: str) -> None:
    if get_project(db, group_id, project_id) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Project not found"
        )


@router.get("", response_model=GetMeetingListResponse)
async def list_meetings(
    project_id: str,
    current_user: CurrentUser = Depends(get_current_user),
) -> GetMeetingListResponse:
    db = get_db()
    group_id, real_project_id = resolve_project_params(project_id, current_user.group_id)
    _check_project(db, group_id, real_project_id)
    meetings = get_meeting_list(db, group_id, real_project_id)
    return GetMeetingListResponse(meetings=meetings)


@router.post("", response_model=CreateMeetingResponse, status_code=201)
async def create_meeting_endpoint(
    project_id: str,
    body: CreateMeetingRequest,
    background_tasks: BackgroundTasks,
    current_user: CurrentUser = Depends(get_current_user),
) -> CreateMeetingResponse:
    db = get_db()
    group_id, real_project_id = resolve_project_params(project_id, current_user.group_id)
    _check_project(db, group_id, real_project_id)

    if group_id == "samples":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Sample projects are read-only",
        )

    result = create_meeting(db, group_id, real_project_id, body)

    background_tasks.add_task(
        meeting_summary_job.run,
        db,
        group_id,
        real_project_id,
        result.meeting_id,
        current_user.user_id,
    )

    if body.analyze:
        pending_ids = get_pending_meeting_ids(db, group_id, real_project_id)
        required = calc_analyze_credits(len(pending_ids), body.analysis_mode)
        credits = billing_service.get_credits(db, current_user.user_id)
        raise_if_insufficient(credits["total_credits"], required)
        billing_service.deduct_credits(
            db, current_user.user_id, required, "CPS Analysis for New Meeting"
        )
        from app.services.design_service import create_job
        job_id = create_job(db, current_user.group_id, project_id, "cps_analysis")
        background_tasks.add_task(
            cps_analyzer_job.run,
            db,
            current_user.group_id,
            project_id,
            pending_ids,
            current_user.user_id,
            body.analysis_mode,
            body.analyze_prd,
            job_id,
        )

    return result


@router.post("/analyze", response_model=ReanalyzeMeetingResponse)
async def analyze_project_meetings(
    project_id: str,
    body: AnalyzeRequest,
    background_tasks: BackgroundTasks,
    current_user: CurrentUser = Depends(get_current_user),
) -> ReanalyzeMeetingResponse:
    """프로젝트의 pending 미팅을 모두 분석한다 (프로젝트 단위 트리거)."""
    db = get_db()
    group_id, real_project_id = resolve_project_params(project_id, current_user.group_id)
    _check_project(db, group_id, real_project_id)

    if group_id == "samples":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Sample projects are read-only",
        )

    if not body.analyze_cps and not body.analyze_prd:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="analyze_cps or analyze_prd must be true",
        )

    if body.analyze_cps:
        pending_ids = get_pending_meeting_ids(db, group_id, real_project_id)
        if not pending_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No pending meetings to analyze",
            )
        required = calc_analyze_credits(len(pending_ids), body.analysis_mode)
        credits = billing_service.get_credits(db, current_user.user_id)
        raise_if_insufficient(credits["total_credits"], required)
        billing_service.deduct_credits(
            db, current_user.user_id, required, "CPS Analysis for New Meeting"
        )
        from app.services.design_service import create_job
        job_id = create_job(db, current_user.group_id, project_id, "cps_analysis")
        background_tasks.add_task(
            cps_analyzer_job.run,
            db,
            current_user.group_id,
            project_id,
            pending_ids,
            current_user.user_id,
            body.analysis_mode,
            body.analyze_prd,
            job_id,
        )

    return ReanalyzeMeetingResponse(meeting_id="", analysis_status="processing")


@router.patch("/{meeting_id}", response_model=Meeting)
async def update_meeting_endpoint(
    project_id: str,
    meeting_id: str,
    body: UpdateMeetingRequest,
    background_tasks: BackgroundTasks,
    current_user: CurrentUser = Depends(get_current_user),
) -> Meeting:
    db = get_db()
    group_id, real_project_id = resolve_project_params(project_id, current_user.group_id)
    _check_project(db, group_id, real_project_id)

    if group_id == "samples":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Sample projects are read-only",
        )

    meeting = update_meeting(db, group_id, real_project_id, meeting_id, body)
    if meeting is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found"
        )

    if body.content is not None:
        background_tasks.add_task(
            meeting_summary_job.run,
            db,
            current_user.group_id,
            project_id,
            meeting_id,
            current_user.user_id,
        )
    return meeting


@router.post("/{meeting_id}/analyze", response_model=ReanalyzeMeetingResponse)
async def reanalyze_meeting_endpoint(
    project_id: str,
    meeting_id: str,
    body: AnalyzeRequest,
    background_tasks: BackgroundTasks,
    current_user: CurrentUser = Depends(get_current_user),
) -> ReanalyzeMeetingResponse:
    """단일 미팅 재분석 → 내부적으로 프로젝트 단위 analyze와 동일하게 동작."""
    db = get_db()
    group_id, real_project_id = resolve_project_params(project_id, current_user.group_id)
    _check_project(db, group_id, real_project_id)

    if group_id == "samples":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Sample projects are read-only",
        )

    if not body.analyze_cps and not body.analyze_prd:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="analyze_cps or analyze_prd must be true",
        )

    meeting = get_meeting(db, group_id, real_project_id, meeting_id)
    if meeting is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found"
        )

    if body.analyze_cps:
        set_analysis_status(
            db, group_id, real_project_id, meeting_id, "pending"
        )
        pending_ids = get_pending_meeting_ids(db, group_id, real_project_id)
        required = calc_analyze_credits(len(pending_ids), body.analysis_mode)
        credits = billing_service.get_credits(db, current_user.user_id)
        if credits["total_credits"] < required:
            set_analysis_status(
                db, group_id, real_project_id, meeting_id, "completed"
            )
            raise_if_insufficient(credits["total_credits"], required)
        billing_service.deduct_credits(
            db, current_user.user_id, required, "CPS Analysis for Re-analyzed Meeting"
        )
        from app.services.design_service import create_job
        job_id = create_job(db, current_user.group_id, project_id, "cps_analysis")
        background_tasks.add_task(
            cps_analyzer_job.run,
            db,
            current_user.group_id,
            project_id,
            pending_ids,
            current_user.user_id,
            body.analysis_mode,
            body.analyze_prd,
            job_id,
        )

    return ReanalyzeMeetingResponse(meeting_id=meeting_id, analysis_status="processing")


@router.get("/{meeting_id}", response_model=Meeting)
async def get_meeting_endpoint(
    project_id: str,
    meeting_id: str,
    current_user: CurrentUser = Depends(get_current_user),
) -> Meeting:
    db = get_db()
    group_id, real_project_id = resolve_project_params(project_id, current_user.group_id)
    _check_project(db, group_id, real_project_id)
    meeting = get_meeting(db, group_id, real_project_id, meeting_id)
    if meeting is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found"
        )
    return meeting


@router.get("/{meeting_id}/summary", response_model=MeetingSummaryTextResponse)
async def get_meeting_summary_endpoint(
    project_id: str,
    meeting_id: str,
    current_user: CurrentUser = Depends(get_current_user),
) -> MeetingSummaryTextResponse:
    db = get_db()
    group_id, real_project_id = resolve_project_params(project_id, current_user.group_id)
    _check_project(db, group_id, real_project_id)
    summary_data = get_meeting_summary_text(
        db, group_id, real_project_id, meeting_id
    )
    if summary_data is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found"
        )
    return MeetingSummaryTextResponse(**summary_data)
