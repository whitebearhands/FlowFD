import apiClient from "./client";
import { Prd, PrdVersion, UpdatePrdRequest } from "@/types/prd";

export async function fetchPrd(projectId: string): Promise<Prd> {
  const res = await apiClient.get<Prd>(`/projects/${projectId}/prd`);
  return res.data;
}

export async function fetchPrdHistory(
  projectId: string
): Promise<PrdVersion[]> {
  const res = await apiClient.get<{ versions: PrdVersion[] }>(
    `/projects/${projectId}/prd/history`
  );
  return res.data.versions;
}

export async function fetchPrdVersion(
  projectId: string,
  version: string
): Promise<Prd> {
  const res = await apiClient.get<Prd>(`/projects/${projectId}/prd/${version}`);
  return res.data;
}

export async function updatePrd(
  projectId: string,
  data: UpdatePrdRequest
): Promise<void> {
  await apiClient.patch(`/projects/${projectId}/prd`, data);
}

export async function generatePrd(projectId: string): Promise<{ status: string; creditsUsed: number }> {
  const res = await apiClient.post(`/projects/${projectId}/prd/generate`);
  return res.data;
}

export async function exportPrd(projectId: string): Promise<void> {
  const res = await apiClient.get(`/projects/${projectId}/prd/export`, {
    // 중요: 응답을 반드시 blob으로 받아야 [object Object]가 안 됩니다.
    responseType: "blob", 
  });

  const disposition = res.headers["content-disposition"] ?? "";
  let filename = "prd.md";

  // RFC 5987 방식(filename*) 추출 로직
  if (disposition.includes("filename*=")) {
    const parts = disposition.split("filename*=");
    const filenamePart = parts[1].split(";")[0]; // UTF-8''이름...
    const encodedName = filenamePart.replace(/UTF-8''/i, "");
    filename = decodeURIComponent(encodedName); // 여기서 한글 복원!
  } else {
    // 기존 방식 대응
    const match = disposition.match(/filename="?([^"]+)"?/);
    if (match) filename = match[1];
  }

  // res.data가 이미 Blob 객체이므로 다시 감쌀 때 타입을 명시하거나 그대로 사용
  let blob: Blob;
  
  if (res.data instanceof Blob) {
    blob = res.data;
  } 
  // 3. 만약 객체라면 (JSON으로 파싱되어 버렸다면) 그 안의 실제 텍스트나 데이터를 추출
  else if (typeof res.data === 'object' && res.data !== null) {
    // Axios 인터셉터 등이 데이터를 감쌌을 경우를 대비
    const content = res.data.content || res.data; 
    const stringData = typeof content === 'string' ? content : JSON.stringify(content);
    blob = new Blob([stringData], { type: "text/markdown; charset=utf-8" });
  } 
  // 4. 그 외에는 문자열로 간주하여 Blob 생성
  else {
    blob = new Blob([res.data], { type: "text/markdown; charset=utf-8" });
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  
  URL.revokeObjectURL(url);
}