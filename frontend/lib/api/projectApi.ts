import apiClient from "./client";
import {
  Project,
  CreateProjectRequest,
  CreateProjectResponse,
  UpdateProjectRequest,
} from "@/types/project";

export async function fetchProjects(): Promise<Project[]> {
  const res = await apiClient.get<{ projects: Project[] }>("/projects");
  return res.data.projects;
}

export async function fetchSampleProjects(): Promise<Project[]> {
  const res = await apiClient.get<{ projects: Project[] }>("/projects/samples");
  return res.data.projects;
}

export async function fetchProject(projectId: string): Promise<Project> {
  const res = await apiClient.get<Project>(`/projects/${projectId}`);
  return res.data;
}

export async function createProject(
  data: CreateProjectRequest
): Promise<CreateProjectResponse> {
  const res = await apiClient.post<CreateProjectResponse>("/projects", data);
  return res.data;
}

export async function updateProject(
  projectId: string,
  data: UpdateProjectRequest
): Promise<void> {
  await apiClient.patch(`/projects/${projectId}`, data);
}
