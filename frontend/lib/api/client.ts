import axios, { AxiosRequestConfig } from "axios";
import { getIdToken } from "@/lib/firebase/auth";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

const apiClient = axios.create({
  baseURL: `${API_BASE_URL}/v1`,
  headers: {
    "Content-Type": "application/json",
  },
});

// 요청: Authorization 헤더 주입 + camelCase → snake_case
apiClient.interceptors.request.use(async (config) => {
  const token = await getIdToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (config.data) {
    config.data = toSnakeCase(config.data);
  }
  return config;
});

// 응답: snake_case → camelCase + 401 시 토큰 강제 갱신 후 1회 재시도
apiClient.interceptors.response.use(
  (response) => {
    if (
      response.data && 
      !(response.data instanceof Blob) && 
      !(response.data instanceof ArrayBuffer)
    ) {
      response.data = toCamelCase(response.data);
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config as AxiosRequestConfig & {
      _retry?: boolean;
    };
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const freshToken = await getIdToken(true); // 강제 갱신
      if (freshToken) {
        originalRequest.headers = {
          ...originalRequest.headers,
          Authorization: `Bearer ${freshToken}`,
        };
        return apiClient(originalRequest);
      }
    }
    return Promise.reject(error);
  }
);

function toSnakeCase(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(toSnakeCase);
  if (obj !== null && typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [
        k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`),
        toSnakeCase(v),
      ])
    );
  }
  return obj;
}

function toCamelCase(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(toCamelCase);
  if (obj !== null && typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [
        k.replace(/_([a-z])/g, (_, c) => c.toUpperCase()),
        toCamelCase(v),
      ])
    );
  }
  return obj;
}

export default apiClient;
