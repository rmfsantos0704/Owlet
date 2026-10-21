const API_URL = import.meta.env.VITE_API_URL as string;

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

function handleUnauthorized(status: number, token: string | null) {
  if (status === 401 && token) {
    localStorage.removeItem("token");
    window.location.href = "/login";
  }
}

export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<T> {
  const token = localStorage.getItem("token");
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: options.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError("Can't reach Owlet. Check your connection and try again.", 0);
  }
  const data = await res.json().catch(() => ({}));
  handleUnauthorized(res.status, token);
  if (res.status === 429) throw new ApiError("Too many attempts. Please wait a few minutes and try again.", 429);
  if (!res.ok) throw new ApiError(data.error ?? "Request failed", res.status, data.code);
  return data as T;
}

// multipart upload: the browser sets the Content-Type (with boundary) itself
export async function upload<T>(path: string, form: FormData): Promise<T> {
  const token = localStorage.getItem("token");
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  handleUnauthorized(res.status, token);
  if (res.status === 429) throw new Error("Too many uploads. Wait a minute and try again.");
  if (!res.ok) throw new Error(data.error ?? "Upload failed");
  return data as T;
}

export async function download(path: string, filename: string) {
  const token = localStorage.getItem("token");
  const res = await fetch(`${API_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  handleUnauthorized(res.status, token);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Download failed");
  }
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}