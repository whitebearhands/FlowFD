import apiClient from "./client";
import { SyncDiff, SyncRequest, SyncResult, SyncHistory } from "@/types/github";

export async function fetchSyncDiff(projectId: string): Promise<SyncDiff> {
  const res = await apiClient.get<SyncDiff>(
    `/projects/${projectId}/github/diff`
  );
  return res.data;
}

export async function syncToGithub(
  projectId: string,
  data: SyncRequest
): Promise<SyncResult> {
  const res = await apiClient.post<SyncResult>(
    `/projects/${projectId}/github/sync`,
    data
  );
  return res.data;
}

export async function fetchSyncHistory(
  projectId: string
): Promise<SyncHistory[]> {
  const res = await apiClient.get<{ syncs: SyncHistory[] }>(
    `/projects/${projectId}/github/syncs`
  );
  return res.data.syncs;
}
