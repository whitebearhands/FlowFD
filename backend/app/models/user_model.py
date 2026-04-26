from datetime import date, datetime
from re import sub

from pydantic import BaseModel


class User(BaseModel):
    user_id: str
    email: str
    display_name: str
    group_id: str
    created_at: datetime
    settings: dict = {}


class Group(BaseModel):
    group_id: str
    name: str
    invite_code: str
    created_at: datetime


class GroupMember(BaseModel):
    user_id: str
    role: str  # "admin" | "member"
    joined_at: datetime


class RegisterRequest(BaseModel):
    group_name: str
    display_name: str
    github_pat: str | None = None


class JoinGroupRequest(BaseModel):
    invite_code: str
    display_name: str
    github_pat: str | None = None


class RegisterResponse(BaseModel):
    user_id: str
    group_id: str
    display_name: str


class JoinGroupResponse(BaseModel):
    user_id: str
    group_id: str
    display_name: str
