export type AnalysisStatus = "pending" | "processing" | "completed" | "failed";

export type Meeting = {
  meetingId: string;
  title: string | null;
  date: string;
  participants: string[];
  content: string;
  summary?: string | null;
  analysisStatus: AnalysisStatus;
  createdAt: string;
};

export type MeetingSummary = Omit<Meeting, "content" | "summary">;

export type CreateMeetingRequest = {
  title?: string | null;
  date: string;
  participants: string[];
  content: string;
  analyze?: boolean;
};

export type CreateMeetingResponse = {
  meetingId: string;
  analysisStatus: AnalysisStatus;
  createdAt: string;
};
