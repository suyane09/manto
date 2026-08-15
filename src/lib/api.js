import axios from "axios";

export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

export const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("arsenal_admin_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401) {
      localStorage.removeItem("arsenal_admin_token");
      localStorage.removeItem("arsenal_admin_username");
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  }
);

export default api;
