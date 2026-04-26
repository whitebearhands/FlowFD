import logging

from google.cloud.firestore import Client
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_google_genai import ChatGoogleGenerativeAI

from app.core.config import settings
from app.models.meeting_model import UpdateMeetingRequest
from app.services.meeting_service import get_meeting, update_meeting
from app.services.user_service import get_user

logger = logging.getLogger(__name__)

LOCALE_TO_LANG: dict[str, str] = {
    "ko": "한국어",
    "en": "English",
}

SYS_PROMPT = """당신은 탁월한 IT 비즈니스 분석가입니다. 
주어진 미팅 내용을 분석하여 향후 요구사항 명세(CPS) 작성에 활용할 수 있도록 미팅의 핵심 요약을 작성해야 합니다.

[작성 지침]
1. 분량: 최대 500자 이내
2. 형식: 개조식 (Bullet points)
3. 언어: {lang}
4. 핵심 내용: 이해관계자, 요구사항(기능/비기능), 고충(Pain points), 제약사항 등을 위주로 가장 중요한 정보만 추출하세요. 쓸데없는 인사말이나 부가적인 내용은 과감히 생략하세요.
5. 서론 금지: "Here's a summary..." 또는 "다음은 요약입니다"와 같은 일체의 도입부나 부가 설명 없이 즉시 본문 내용만 출력하세요.
"""


def get_llm() -> ChatGoogleGenerativeAI:
    return ChatGoogleGenerativeAI(
        model="gemini-2.5-flash",
        google_api_key=settings.gemini_api_key,
        temperature=0.1,
    )


def run(
    db: Client,
    group_id: str,
    project_id: str,
    meeting_id: str,
    user_id: str,
) -> None:
    """미팅을 최대 500자 개조식으로 요약하여 저장하는 백그라운드 잡"""
    try:
        meeting = get_meeting(db, group_id, project_id, meeting_id)
        if not meeting or not meeting.content:
            logger.warning(
                "Meeting %s not found or no content to summarize.", meeting_id
            )
            return

        user = get_user(db, user_id)
        locale = (
            (user or {}).get("settings", {}).get("display", {}).get("language", "ko")
        )
        output_language = LOCALE_TO_LANG.get(locale, "한국어")

        llm = get_llm()
        system_prompt = SYS_PROMPT.format(lang=output_language)

        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=f"[미팅 내용]\n{meeting.content}"),
        ]

        response = llm.invoke(messages)
        summary_raw = response.content
        if isinstance(summary_raw, list):
            summary_text = "".join(str(part) for part in summary_raw)
        else:
            summary_text = str(summary_raw).strip()

        # 중복 엔터(\n\n)를 단일 엔터(\n)로 변경
        while "\n\n" in summary_text:
            summary_text = summary_text.replace("\n\n", "\n")

        # 요약 업데이트
        update_doc = UpdateMeetingRequest(summary=summary_text)
        update_meeting(db, group_id, project_id, meeting_id, update_doc)

        logger.info("Meeting %s summary generated and saved successfully.", meeting_id)

    except Exception as exc:
        logger.exception(
            "Failed to generate summary for meeting=%s error=%s", meeting_id, exc
        )
