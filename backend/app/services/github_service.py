"""PyGithub를 사용해 프로젝트 문서를 GitHub 레포에 동기화한다."""
from __future__ import annotations

import logging
import re
from datetime import UTC, datetime

from google.cloud.firestore import Client

from app.services.cps_service import get_latest_cps
from app.services.design_service import get_design
from app.services.github_markdown import (
    cps_to_markdown,
    design_to_markdown,
    meeting_to_markdown,
    prd_to_markdown,
    readme_to_markdown,
)
from app.services.prd_service import get_latest_prd
from app.services.project_service import get_project
from app.services.user_service import get_user

logger = logging.getLogger(__name__)


def get_github_token(db: Client, user_id: str) -> str | None:
    user = get_user(db, user_id)
    if not user:
        return None
    return ((user.get("settings") or {}).get("github") or {}).get("personal_access_token")


def _parse_repo_full_name(token: str, repo_url: str) -> str:
    """repo URL/이름을 'owner/repo' 형식으로 변환한다."""
    url = repo_url.strip().rstrip("/").removesuffix(".git")
    m = re.match(r"https?://github\.com/([^/]+/[^/]+)", url)
    if m:
        return m.group(1)
    if "/" in url:
        return url
    from github import Github
    return f"{Github(token).get_user().login}/{url}"


def _get_all_meetings(db: Client, group_id: str, project_id: str) -> list[dict]:
    docs = (
        db.collection("groups")
        .document(group_id)
        .collection("projects")
        .document(project_id)
        .collection("meetings")
        .order_by("created_at")
        .get()
    )
    return [{"meeting_id": doc.id, **doc.to_dict()} for doc in docs]


def collect_project_files(
    db: Client,
    group_id: str,
    project_id: str,
) -> dict[str, str]:
    """프로젝트의 현재 문서들을 {파일경로: 마크다운} 형태로 수집한다."""
    project = get_project(db, group_id, project_id)
    if not project:
        return {}

    files: dict[str, str] = {}

    files["README.md"] = readme_to_markdown(project.name, project.client, project.description)

    cps = get_latest_cps(db, group_id, project_id)
    if cps:
        files["docs/cps.md"] = cps_to_markdown(cps.model_dump())

    prd = get_latest_prd(db, group_id, project_id)
    if prd:
        files["docs/prd.md"] = prd_to_markdown(prd, prd.get("version", ""))

    design = get_design(db, group_id, project_id)
    if design:
        files["docs/design.md"] = design_to_markdown(design)

    for m in _get_all_meetings(db, group_id, project_id):
        date = str(m.get("date") or "unknown")
        title = str(m.get("title") or "meeting")
        slug = re.sub(r"[^\w\-]", "-", title.lower())[:40].strip("-")
        files[f"docs/meetings/{date}_{slug}.md"] = meeting_to_markdown(m)

    return files


def _ensure_repo(g, full_name: str):
    """레포가 없으면 private으로 생성한다."""
    from github import UnknownObjectException

    try:
        return g.get_repo(full_name)
    except UnknownObjectException:
        owner, name = full_name.split("/", 1)
        user = g.get_user()
        if user.login == owner:
            repo = user.create_repo(name, private=True, auto_init=True)
        else:
            org = g.get_organization(owner)
            repo = org.create_repo(name, private=True, auto_init=True)
        logger.info("GitHub repo created: %s", full_name)
        return repo


def sync_to_github(
    token: str,
    repo_url: str,
    files: dict[str, str],
    commit_message: str,
) -> dict:
    """파일들을 한 번의 커밋으로 GitHub 레포에 동기화한다."""
    from github import Github, GithubException, InputGitTreeElement

    g = Github(token)
    full_name = _parse_repo_full_name(token, repo_url)
    repo = _ensure_repo(g, full_name)

    try:
        ref = repo.get_git_ref(f"heads/{repo.default_branch}")
        base_commit = repo.get_git_commit(ref.object.sha)
        base_tree = base_commit.tree

        elements = []
        for path, content in files.items():
            blob = repo.create_git_blob(content, "utf-8")
            elements.append(
                InputGitTreeElement(path=path, mode="100644", type="blob", sha=blob.sha)
            )

        new_tree = repo.create_git_tree(elements, base_tree)
        new_commit = repo.create_git_commit(
            message=commit_message,
            tree=new_tree,
            parents=[base_commit],
        )
        ref.edit(new_commit.sha)

        return {
            "commit_sha": new_commit.sha,
            "commit_url": f"https://github.com/{full_name}/commit/{new_commit.sha}",
            "synced_files": list(files.keys()),
        }

    except GithubException as exc:
        logger.error("GitHub sync failed: repo=%s error=%s", repo_url, exc)
        raise


def save_sync_history(
    db: Client,
    group_id: str,
    project_id: str,
    commit_sha: str,
    commit_url: str,
    commit_message: str,
    synced_files: list[str],
) -> None:
    (
        db.collection("groups")
        .document(group_id)
        .collection("projects")
        .document(project_id)
        .collection("github_syncs")
        .document()
        .set(
            {
                "commit_sha": commit_sha,
                "commit_url": commit_url,
                "commit_message": commit_message,
                "synced_files": synced_files,
                "synced_at": datetime.now(UTC),
            }
        )
    )


def get_sync_history(db: Client, group_id: str, project_id: str) -> list[dict]:
    docs = (
        db.collection("groups")
        .document(group_id)
        .collection("projects")
        .document(project_id)
        .collection("github_syncs")
        .order_by("synced_at", direction="DESCENDING")
        .limit(20)
        .get()
    )
    result = []
    for doc in docs:
        d = doc.to_dict()
        synced_at = d.get("synced_at")
        result.append({
            "sync_id": doc.id,
            **d,
            "synced_at": synced_at.isoformat() if hasattr(synced_at, "isoformat") else str(synced_at),
        })
    return result


async def auto_commit(
    db: Client,
    group_id: str,
    project_id: str,
    user_id: str,
    doc_type: str,
) -> None:
    """백그라운드 잡 완료 후 자동 커밋 (github_auto_commit이 True인 경우만)."""
    project = get_project(db, group_id, project_id)
    if not project or not project.github_repo or not project.github_auto_commit:
        return

    token = get_github_token(db, user_id)
    if not token:
        logger.warning("auto_commit skipped: no GitHub token for user=%s", user_id)
        return

    files = collect_project_files(db, group_id, project_id)
    if not files:
        return

    try:
        result = sync_to_github(
            token, project.github_repo, files, f"auto: update {doc_type}"
        )
        save_sync_history(
            db, group_id, project_id,
            result["commit_sha"], result["commit_url"],
            f"auto: update {doc_type}", result["synced_files"],
        )
        logger.info(
            "auto_commit: project=%s doc=%s sha=%s", project_id, doc_type, result["commit_sha"]
        )
    except Exception as exc:
        logger.error("auto_commit failed: project=%s doc=%s error=%s", project_id, doc_type, exc)
