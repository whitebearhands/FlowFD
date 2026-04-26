export type GroupMemberRole = "admin" | "member";

export type Group = {
  groupId: string;
  name: string;
  inviteCode: string;
  createdAt: string;
};

export type GroupMember = {
  userId: string;
  role: GroupMemberRole;
  joinedAt: string;
};

export type RegisterRequest = {
  groupName: string;
  displayName: string;
  githubPat?: string;
};

export type RegisterResponse = {
  userId: string;
  groupId: string;
  displayName: string;
};

export type JoinGroupRequest = {
  inviteCode: string;
  displayName: string;
  githubPat?: string;
};

export type JoinGroupResponse = {
  userId: string;
  groupId: string;
  displayName: string;
};
