import axios from "axios";

export const BACKEND_URL = (process.env.REACT_APP_BACKEND_URL || "").replace(/\/$/, "");
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API, withCredentials: true });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("fm_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function setToken(t) {
  if (t) localStorage.setItem("fm_token", t);
  else localStorage.removeItem("fm_token");
}

export function fileUrl(path) {
  if (!path) return null;
  const value = String(path).trim();
  if (/^https?:\/\//i.test(value) || value.startsWith("data:") || value.startsWith("blob:")) return value;
  if (value.startsWith("/api/")) return `${BACKEND_URL}${value}`;
  if (value.startsWith("/files/")) return `${API}${value}`;
  const clean = value.replace(/^\/+/, "");
  return `${API}/files/${clean}`;
}
