import apiClient from "./client";
import { Code, GenerateCodeRequest, GenerateCodeResponse } from "@/types/code";

export async function fetchCodes(projectId: string): Promise<Code[]> {
  const res = await apiClient.get<{ codes: Code[] }>(
    `/projects/${projectId}/code`
  );
  return res.data.codes;
}

export async function fetchCode(
  projectId: string,
  codeId: string
): Promise<Code> {
  const res = await apiClient.get<Code>(`/projects/${projectId}/code/${codeId}`);
  return res.data;
}

export async function generateCode(
  projectId: string,
  data: GenerateCodeRequest
): Promise<GenerateCodeResponse> {
  const res = await apiClient.post<GenerateCodeResponse>(
    `/projects/${projectId}/code/generate`,
    data
  );
  return res.data;
}
