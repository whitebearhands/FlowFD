from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class Meeting(BaseModel):
    meeting_id: str
    title: str | None = None
    date: str  # YYYY-MM-DD
    participants: list[str]
    content: str
    summary: str | None = None
    analysis_status: str  # "pending" | "processing" | "completed" | "failed"
    created_at: datetime


class MeetingSummary(BaseModel):
    meeting_id: str
    title: str | None = None
    date: str
    participants: list[str]
    analysis_status: str
    created_at: datetime


class CreateMeetingRequest(BaseModel):
    title: str | None = None
    date: str  # YYYY-MM-DD
    participants: list[str]
    content: str
    analyze: bool = True
    analysis_mode: Literal["smart", "full"] = "smart"
    analyze_prd: bool = True


class AnalyzeRequest(BaseModel):
    analyze_cps: bool = True
    analyze_prd: bool = True
    analysis_mode: Literal["smart", "full"] = "smart"


class CreateMeetingResponse(BaseModel):
    meeting_id: str
    analysis_status: str
    created_at: datetime


class GetMeetingListResponse(BaseModel):
    meetings: list[MeetingSummary]


class UpdateMeetingRequest(BaseModel):
    title: str | None = None
    date: str | None = None  # YYYY-MM-DD
    participants: list[str] | None = None
    content: str | None = None
    summary: str | None = None


class ReanalyzeMeetingResponse(BaseModel):
    meeting_id: str
    analysis_status: str


class MeetingSummaryTextResponse(BaseModel):
    summary: str | None = None
