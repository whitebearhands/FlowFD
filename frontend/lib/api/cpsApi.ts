import apiClient from "./client";
import { CpsDocument, CpsVersion, UpdateCpsRequest } from "@/types/cps";

type CpsResponse = {
  version: string;
  cps: CpsDocument;
  createdAt: string;
  updatedAt: string;
};

export async function fetchCps(projectId: string): Promise<CpsDocument> {
  const res = await apiClient.get<CpsResponse>(`/projects/${projectId}/cps`);
  return res.data.cps;
}

export async function fetchCpsHistory(
  projectId: string
): Promise<CpsVersion[]> {
  const res = await apiClient.get<{ versions: CpsVersion[] }>(
    `/projects/${projectId}/cps/history`
  );
  return res.data.versions;
}

export async function fetchCpsVersion(
  projectId: string,
  version: string
): Promise<CpsDocument> {
  const res = await apiClient.get<CpsResponse>(
    `/projects/${projectId}/cps/${version}`
  );
  return res.data.cps;
}

export async function updateCps(
  projectId: string,
  data: UpdateCpsRequest
): Promise<void> {
  await apiClient.patch(`/projects/${projectId}/cps`, data);
}
