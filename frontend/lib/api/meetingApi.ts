import apiClient from "./client";
import {
  Meeting,
  MeetingSummary,
  CreateMeetingRequest,
  CreateMeetingResponse,
} from "@/types/meeting";

export async function fetchMeetings(
  projectId: string
): Promise<MeetingSummary[]> {
  const res = await apiClient.get<{ meetings: MeetingSummary[] }>(
    `/projects/${projectId}/meetings`
  );
  return res.data.meetings;
}

export async function fetchMeeting(
  projectId: string,
  meetingId: string
): Promise<Meeting> {
  const res = await apiClient.get<Meeting>(
    `/projects/${projectId}/meetings/${meetingId}`
  );
  return res.data;
}

export async function fetchMeetingSummaryText(
  projectId: string,
  meetingId: string
): Promise<{ summary: string | null }> {
  const res = await apiClient.get<{ summary: string | null }>(
    `/projects/${projectId}/meetings/${meetingId}/summary`
  );
  return res.data;
}

export async function createMeeting(
  projectId: string,
  data: CreateMeetingRequest
): Promise<CreateMeetingResponse> {
  const res = await apiClient.post<CreateMeetingResponse>(
    `/projects/${projectId}/meetings`,
    data
  );
  return res.data;
}

export async function updateMeeting(
  projectId: string,
  meetingId: string,
  data: Partial<CreateMeetingRequest>
): Promise<Meeting> {
  const res = await apiClient.patch<Meeting>(
    `/projects/${projectId}/meetings/${meetingId}`,
    data
  );
  return res.data;
}

export type AnalyzeOptions = {
  analyze_cps?: boolean;
  analyze_prd?: boolean;
  analysis_mode?: "smart" | "full";
};

export async function analyzeProject(
  projectId: string,
  options?: AnalyzeOptions
): Promise<{ analysisStatus: string }> {
  const res = await apiClient.post(`/projects/${projectId}/meetings/analyze`, {
    analyze_cps: options?.analyze_cps ?? true,
    analyze_prd: options?.analyze_prd ?? true,
    analysis_mode: options?.analysis_mode ?? "smart",
  });
  return res.data;
}

export async function reanalyzeMeeting(
  projectId: string,
  meetingId: string,
  options?: AnalyzeOptions
): Promise<{ meetingId: string; analysisStatus: string }> {
  const res = await apiClient.post(
    `/projects/${projectId}/meetings/${meetingId}/analyze`,
    {
      analyze_cps: options?.analyze_cps ?? true,
      analyze_prd: options?.analyze_prd ?? true,
      analysis_mode: options?.analysis_mode ?? "smart",
    }
  );
  return res.data;
}
