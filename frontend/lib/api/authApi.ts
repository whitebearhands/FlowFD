import apiClient from "./client";
import {
  RegisterRequest,
  RegisterResponse,
  JoinGroupRequest,
  JoinGroupResponse,
} from "@/types/group";

export async function register(
  data: RegisterRequest
): Promise<RegisterResponse> {
  const res = await apiClient.post<RegisterResponse>("/auth/register", data);
  return res.data;
}

export async function joinGroup(
  data: JoinGroupRequest
): Promise<JoinGroupResponse> {
  const res = await apiClient.post<JoinGroupResponse>(
    "/auth/join-group",
    data
  );
  return res.data;
}
