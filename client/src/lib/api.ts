import axios from "axios";

// Dev: Vite proxy üzerinden aynı origin. Prod: VITE_API_URL veya localhost:4000
export const API_URL =
  import.meta.env.VITE_API_URL ??
  (import.meta.env.DEV ? window.location.origin : "http://localhost:4000");

export const api = axios.create({
  baseURL: `${API_URL}/api`,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("achat_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !err.config?.url?.includes("/auth/")) {
      localStorage.removeItem("achat_token");
    }
    return Promise.reject(err);
  }
);
