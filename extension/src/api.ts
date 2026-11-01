export const API_URL = "http://localhost:4000/api";
export const DASHBOARD_URL = "http://localhost:5173";

// the login token must only ever travel over https (or to your own machine while developing)
const SAFE_API = /^https:\/\//i.test(API_URL) || /^http:\/\/localhost(:\d+)?\//i.test(API_URL);

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

// Free hosts put idle servers to sleep, and the first request wakes them (up to about a minute).
// Call this as soon as the popup opens, so the server is already awake when the person logs in or clips.
export function wake() {
  if (!SAFE_API) return;
  void fetch(`${API_URL}/health`, { signal: AbortSignal.timeout(120_000) }).catch(() => {});
}

export async function api(path: string, options: { method?: string; body?: unknown } = {}) {
  if (!SAFE_API) throw new Error("API_URL must start with https:// outside development");
  const token = await getToken();
  const res = await fetch(`${API_URL}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: AbortSignal.timeout(150_000), // a sleeping free server can take about a minute to wake up
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}