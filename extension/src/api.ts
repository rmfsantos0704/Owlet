export const API_URL = "http://localhost:4000/api";
export const DASHBOARD_URL = "http://localhost:5173";

export async function getToken(): Promise<string | null> {
  const { token } = await chrome.storage.local.get("token");
  return typeof token === "string" ? token : null;
}
export const setToken = (token: string) => chrome.storage.local.set({ token });
export const clearToken = () => chrome.storage.local.remove("token");

export async function api(path: string, options: { method?: string; body?: unknown } = {}) {
  const token = await getToken();
  const res = await fetch(`${API_URL}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}