export const API_URL = "http://localhost:4000/api";
export const DASHBOARD_URL = "http://localhost:5173";

export async function getToken(): Promise<string | null> {
  const { token } = await chrome.storage.local.get("token");
  return typeof token === "string" ? token : null;
}
// tokenAt records when the login last changed, so the dashboard bridge (bridge.ts) can tell which side is newer
export const setToken = (token: string) => chrome.storage.local.set({ token, tokenAt: Date.now() });
export const clearToken = async () => {
  await chrome.storage.local.set({ tokenAt: Date.now() });
  await chrome.storage.local.remove("token");
};

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