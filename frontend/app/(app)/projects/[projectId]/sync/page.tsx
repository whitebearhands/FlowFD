"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchSyncDiff, syncToGithub, fetchSyncHistory } from "@/lib/api/githubApi";
import { SyncDiff, SyncHistory } from "@/types/github";

export default function SyncPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const t = useTranslations("sync");

  const [diff, setDiff] = useState<SyncDiff | null>(null);
  const [history, setHistory] = useState<SyncHistory[]>([]);
  const [commitMessage, setCommitMessage] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{ commitSha: string; commitUrl: string } | null>(null);

  useEffect(() => {
    Promise.all([
      fetchSyncDiff(projectId).catch(() => null),
      fetchSyncHistory(projectId).catch(() => []),
    ]).then(([diffData, historyData]) => {
      setDiff(diffData);
      setHistory(historyData);
    }).finally(() => setIsLoading(false));
  }, [projectId]);

  async function handleSync() {
    if (!commitMessage.trim()) return;
    setIsSyncing(true);
    setError(null);
    try {
      const result = await syncToGithub(projectId, { commitMessage });
      setLastResult({ commitSha: result.commitSha, commitUrl: result.commitUrl });
      setCommitMessage("");
      const updated = await fetchSyncHistory(projectId).catch(() => []);
      setHistory(updated);
    } catch {
      setError(t("syncError"));
    } finally {
      setIsSyncing(false);
    }
  }

  const hasRepo = !!diff?.githubRepo;

  return (
    <div className="flex flex-col h-full">
      {/* Topbar */}
      <div className="bg-white border-b shrink-0">
        <div className="px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-zinc-400">
            <Link href={`/projects/${projectId}`} className="hover:text-zinc-600">
              {t("breadcrumb.project")}
            </Link>
            <span>/</span>
            <span className="text-zinc-600 font-medium">{t("breadcrumb.sync")}</span>
          </div>
          {hasRepo && (
            <Button
              size="sm"
              onClick={handleSync}
              disabled={isSyncing || !commitMessage.trim()}
            >
              {isSyncing ? t("syncing") : t("syncBtn")}
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="w-5 h-5 border-2 border-zinc-300 border-t-zinc-700 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-6">
            {/* 레포 미설정 안내 */}
            {!hasRepo && (
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-6 py-8 text-center">
                <p className="text-sm font-medium text-zinc-700">{t("noRepo")}</p>
                <p className="text-xs text-zinc-400 mt-1">{t("noRepoHint")}</p>
              </div>
            )}

            {hasRepo && (
              <>
                {/* 레포 정보 */}
                <div className="rounded-lg border bg-white p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-zinc-400">{t("repo")}</p>
                    <p className="text-sm font-medium text-zinc-800 mt-0.5">{diff.githubRepo}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {diff.githubAutoCommit && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                        {t("autoCommitOn")}
                      </span>
                    )}
                  </div>
                </div>

                {/* 성공 배너 */}
                {lastResult && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-center justify-between">
                    <p className="text-sm text-emerald-700">
                      {t("syncSuccess")} <code className="font-mono text-xs">{lastResult.commitSha.slice(0, 7)}</code>
                    </p>
                    <a
                      href={lastResult.commitUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-emerald-600 hover:underline"
                    >
                      {t("viewCommit")} →
                    </a>
                  </div>
                )}

                {/* 에러 */}
                {error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                )}

                {/* 커밋 메시지 + Sync */}
                <div className="rounded-lg border bg-white p-4 space-y-3">
                  <h2 className="text-sm font-semibold">{t("manualSync")}</h2>
                  <div className="flex gap-2">
                    <Input
                      placeholder={t("commitPlaceholder")}
                      value={commitMessage}
                      onChange={(e) => setCommitMessage(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSync()}
                      className="flex-1"
                    />
                    <Button
                      onClick={handleSync}
                      disabled={isSyncing || !commitMessage.trim()}
                    >
                      {isSyncing ? t("syncing") : t("syncBtn")}
                    </Button>
                  </div>
                </div>

                {/* 커밋될 파일 목록 */}
                {diff.files.length > 0 && (
                  <div className="rounded-lg border bg-white">
                    <div className="px-4 py-3 border-b">
                      <h2 className="text-sm font-semibold">
                        {t("filesToSync")}
                        <span className="ml-2 text-xs text-zinc-400 font-normal">
                          {diff.files.length}{t("filesCount")}
                        </span>
                      </h2>
                    </div>
                    <ul className="divide-y">
                      {diff.files.map((f) => (
                        <li key={f.path} className="flex items-center justify-between px-4 py-2.5">
                          <code className="text-xs text-zinc-700 font-mono">{f.path}</code>
                          <span className="text-xs text-zinc-400">{(f.size / 1024).toFixed(1)} KB</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}

            {/* Sync 히스토리 */}
            <div className="rounded-lg border bg-white">
              <div className="px-4 py-3 border-b">
                <h2 className="text-sm font-semibold">{t("history.title")}</h2>
              </div>
              {history.length === 0 ? (
                <div className="px-4 py-8 text-center text-zinc-400 text-xs">
                  {t("history.empty")}
                </div>
              ) : (
                <ul className="divide-y">
                  {history.map((h) => (
                    <li key={h.syncId} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-zinc-700 truncate">
                            {h.commitMessage}
                          </p>
                          <p className="text-xs text-zinc-400 mt-0.5">
                            <a
                              href={h.commitUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-mono hover:underline"
                            >
                              {h.commitSha.slice(0, 7)}
                            </a>
                            {" · "}
                            {new Date(h.syncedAt).toLocaleString()}
                          </p>
                        </div>
                        <span className="text-xs text-zinc-400 shrink-0">
                          {h.syncedFiles.length}{t("filesCount")}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
