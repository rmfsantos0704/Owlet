const API_URL = ((import.meta.env.VITE_API_URL as string | undefined) ?? "").replace(/\/+$/, "");

const TIMEOUT_MS = 90_000; // some requests wait for the AI
const FILE_TIMEOUT_MS = 120_000;
const TOO_MANY = "Too many attempts. Please wait a few minutes and try again.";

// Errors from the server, carrying the HTTP status and (for a few cases) a machine-readable code.
export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

// the login token travels with every request, so it must only go over https (localhost is fine while developing)
function configError() {
  if (!API_URL) return new ApiError("Owlet isn't set up correctly: VITE_API_URL is missing.", 0);
  const local = /^http:\/\/localhost(:\d+)?(\/|$)/i.test(API_URL);
  if (import.meta.env.PROD && !local && !/^https:\/\//i.test(API_URL)) {
    return new ApiError("Owlet isn't set up correctly: VITE_API_URL must start with https://", 0);
  }
  return null;
}

function networkError(e: unknown) {
  if (e instanceof DOMException && e.name === "TimeoutError") {
    return new ApiError("This is taking too long. Please try again.", 0);
  }
  return new ApiError("Can't reach Owlet. Check your connection and try again.", 0);
}

function handleUnauthorized(status: number, token: string | null) {
  if (status === 401 && token) {
    localStorage.removeItem("token");
    window.location.href = "/login";
  }
}

async function send(path: string, init: RequestInit, timeoutMs: number) {
  const bad = configError();
  if (bad) throw bad;
  try {
    return await fetch(`${API_URL}${path}`, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (e) {
    throw networkError(e);
  }
}

// turns a failed response into an ApiError, preferring the server's own message
async function fail(res: Response, token: string | null, fallback: string): Promise<never> {
  const data = await res.json().catch(() => ({}));
  handleUnauthorized(res.status, token);
  throw new ApiError(typeof data?.error === "string" ? data.error : fallback, res.status, data?.code);
}

export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<T> {
  const token = localStorage.getItem("token");
  const res = await send(
    path,
    {
      method: options.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    },
    TIMEOUT_MS
  );
  if (!res.ok) return fail(res, token, res.status === 429 ? TOO_MANY : "Request failed");
  return (await res.json().catch(() => ({}))) as T;
}

// multipart upload: the browser sets the Content-Type (with boundary) itself
export async function upload<T>(path: string, form: FormData): Promise<T> {
  const token = localStorage.getItem("token");
  const res = await send(
    path,
    { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {}, body: form },
    FILE_TIMEOUT_MS
  );
  if (!res.ok) return fail(res, token, res.status === 429 ? "Too many uploads. Wait a minute and try again." : "Upload failed");
  return (await res.json().catch(() => ({}))) as T;
}

export async function download(path: string, filename: string) {
  const token = localStorage.getItem("token");
  const res = await send(path, { headers: token ? { Authorization: `Bearer ${token}` } : {} }, FILE_TIMEOUT_MS);
  if (!res.ok) return fail(res, token, "Download failed");

  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000); // revoking right away can cancel the download in some browsers
}