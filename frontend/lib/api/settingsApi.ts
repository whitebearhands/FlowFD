import apiClient from "./client";

export type LlmSettings = {
  apiKeys: {
    gemini: string | null;
    claude: string | null;
    openai: string | null;
  };
  defaultModels: {
    cpsGeneration: string;
    prdGeneration: string;
    codeGeneration: string;
  };
};

export type GithubSettings = {
  personalAccessToken: string;
};

export type UserSettings = {
  llm: LlmSettings;
  github: GithubSettings | null;
  display: DisplaySettings;
};

export type DisplaySettings = {
  language: string;
  dateFormat: string;
  timezone: string;
};

export async function fetchSettings(): Promise<UserSettings> {
  const res = await apiClient.get<UserSettings>("/settings");
  return res.data;
}

export async function updateLlmSettings(data: LlmSettings): Promise<void> {
  await apiClient.patch("/settings/llm", data);
}

export async function updateGithubSettings(
  data: GithubSettings
): Promise<void> {
  await apiClient.patch("/settings/github", data);
}

export async function updateDisplaySettings(
  data: DisplaySettings
): Promise<void> {
  await apiClient.patch("/settings/display", data);
}