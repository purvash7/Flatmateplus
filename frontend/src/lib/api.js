import axios from "axios";

export const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
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
  return `${API}/files/${path}`;
}
