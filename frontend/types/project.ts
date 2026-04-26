export type ProjectStatus = "active" | "archived";

export type ProjectColor =
  | "emerald"
  | "blue"
  | "violet"
  | "orange"
  | "rose"
  | "pink"
  | "zinc";

export type Project = {
  projectId: string;
  name: string;
  client: string;
  color: ProjectColor;
  description: string | null;
  tags: string[];
  status: ProjectStatus;
  githubRepo: string | null;
  githubAutoCommit: boolean;
  createdAt: string;
  lastMeetingAt: string | null;
};

export type CreateProjectRequest = {
  name: string;
  client: string;
  description?: string | null;
  tags?: string[];
  color?: ProjectColor;
  githubRepo?: string | null;
  githubAutoCommit?: boolean;
};

export type CreateProjectResponse = {
  projectId: string;
  name: string;
  client: string;
  createdAt: string;
};

export type UpdateProjectRequest = {
  name?: string | null;
  color?: ProjectColor | null;
  description?: string | null;
  status?: ProjectStatus | null;
  tags?: string[] | null;
  githubRepo?: string | null;
  githubAutoCommit?: boolean | null;
};
