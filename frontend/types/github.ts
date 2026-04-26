export type SyncFile = {
  path: string;
  size: number;
};

export type SyncDiff = {
  githubRepo: string | null;
  githubAutoCommit: boolean;
  files: SyncFile[];
};

export type SyncRequest = {
  commitMessage: string;
};

export type SyncResult = {
  commitSha: string;
  commitUrl: string;
  syncedFiles: string[];
};

export type SyncHistory = {
  syncId: string;
  commitSha: string;
  commitUrl: string;
  commitMessage: string;
  syncedFiles: string[];
  syncedAt: string;
};
