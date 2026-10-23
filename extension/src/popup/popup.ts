import { api, getToken, setToken, clearToken, DASHBOARD_URL } from "../api";

type Ws = {
  id: string;
  name: string;
  role: string;
  aiSettings: { format: string; length: string; instructions: string };
};

const FORMATS: Record<string, string> = {
  paragraph: "Paragraph",
  bullets: "Bullet points",
  academic: "Academic",
  simple: "Plain language",
};
const LENGTHS: Record<string, string> = { short: "Short", medium: "Medium", detailed: "Detailed" };
const OFFLINE = "Can't reach Owlet. Is the server running?";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

let workspaces: Ws[] = [];
let clippable = false;
let clipping = false;
let lastWorkspaceId = ""; // last real selection, so Cancel can go back to it

const open = (url: string) => chrome.tabs.create({ url });
const selected = () => workspaces.find((w) => w.id === $<HTMLSelectElement>("workspace").value);

// ---------- small UI helpers ----------

function status(kind: "ok" | "err" | "info" | "", text = "", link?: { label: string; url: string }) {
  const box = $("status");
  box.hidden = !kind;
  box.className = "status" + (kind ? ` ${kind}` : "");
  $("statusText").textContent = text;
  const btn = $("statusLink");
  btn.hidden = !link;
  btn.textContent = link?.label ?? "";
  btn.dataset.url = link?.url ?? "";
}

function loginMsg(text = "") {
  const el = $("loginMsg");
  el.textContent = text;
  el.hidden = !text;
}

function updateClipEnabled() {
  $<HTMLButtonElement>("clipBtn").disabled = clipping || !clippable || !selected();
}

function setClipBusy(busy: boolean) {
  clipping = busy;
  const btn = $("clipBtn");
  if (busy) btn.classList.remove("done");
  $("clipSpinner").hidden = !busy;
  $("clipIcon").hidden = busy;
  $("clipLabel").textContent = busy ? "Clipping…" : btn.classList.contains("done") ? "Saved" : "Clip this page";
  updateClipEnabled();
}

function flashClipDone() {
  const btn = $("clipBtn");
  btn.classList.add("done");
  $("clipLabel").textContent = "Saved";
  setTimeout(() => {
    btn.classList.remove("done");
    if (!clipping) $("clipLabel").textContent = "Clip this page";
  }, 2200);
}

// ---------- data ----------

async function loadPage() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url ?? "";
  clippable = /^https?:\/\//i.test(url);

  let host = "";
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    /* not a normal URL */
  }
  $("pageTitle").textContent = clippable ? tab?.title?.trim() || url : "This page can't be clipped";
  $("pageHost").textContent = clippable ? host : "Open an article or website, then try again.";

  const fav = tab?.favIconUrl ?? "";
  const showFav = clippable && /^https?:\/\//i.test(fav);
  const img = $<HTMLImageElement>("pageFavicon");
  img.hidden = !showFav;
  $("pageFallback").style.display = showFav ? "none" : "";
  if (showFav) img.src = fav;
  updateClipEnabled();
}
function showNewRow(show: boolean) {
  $("newWsRow").hidden = !show;
  if (show) {
    const input = $<HTMLInputElement>("newWs");
    input.value = "";
    input.focus();
  }
}

function restoreSelection() {
  const sel = $<HTMLSelectElement>("workspace");
  sel.value = workspaces.some((w) => w.id === lastWorkspaceId) ? lastWorkspaceId : workspaces[0]?.id ?? "";
  showNewRow(false);
  fillSettings();
}

function fillSettings() {
  const ws = selected();
  const owner = ws?.role === "owner";
  const s = ws?.aiSettings;
  $<HTMLSelectElement>("format").value = s?.format ?? "paragraph";
  $<HTMLSelectElement>("length").value = s?.length ?? "medium";
  $<HTMLTextAreaElement>("instructions").value = s?.instructions ?? "";
  for (const id of ["format", "length", "instructions", "saveSettings"]) {
    $<HTMLInputElement>(id).disabled = !owner;
  }
  $("ownerNote").hidden = owner || !ws;
  $("aiHint").textContent = ws
    ? `AI summary: ${FORMATS[s?.format ?? ""] ?? "Paragraph"} \u00B7 ${LENGTHS[s?.length ?? ""] ?? "Medium"}`
    : "AI summary";
  updateClipEnabled();
}

async function loadWorkspaces(preferId?: string) {
  try {
    const r = await api("/workspaces");
    if (r.status === 401) {
      await clearToken();
      await render();
      return loginMsg("Session expired. Please log in again.");
    }
    if (!r.ok) return status("err", r.data.error ?? "Couldn't load your workspaces");

    const { workspaceId } = await chrome.storage.local.get("workspaceId");
    workspaces = (r.data.workspaces as Ws[]).filter((w) => w.role !== "viewer");
    const sel = $<HTMLSelectElement>("workspace");
    sel.innerHTML = "";
    for (const w of workspaces) sel.add(new Option(w.name, w.id));
    sel.add(new Option("+ Create new workspace…", "new"));

    const want = preferId ?? (typeof workspaceId === "string" ? workspaceId : "");
    if (workspaces.some((w) => w.id === want)) sel.value = want;
    lastWorkspaceId = sel.value;
    showNewRow(false);
    fillSettings();
  } catch {
    status("err", OFFLINE);
  }
}

async function render() {
  const loggedIn = !!(await getToken());
  $("viewLogin").hidden = loggedIn;
  $("viewMain").hidden = !loggedIn;
  if (!loggedIn) return;
  status("");
  await Promise.all([loadPage(), loadWorkspaces()]);
}

// ---------- events ----------

$("workspace").addEventListener("change", () => {
  const sel = $<HTMLSelectElement>("workspace");
  if (sel.value === "new") {
    status("");
    showNewRow(true);
    fillSettings();
    return;
  }
  lastWorkspaceId = sel.value;
  showNewRow(false);
  chrome.storage.local.set({ workspaceId: sel.value });
  fillSettings();
});

async function createWorkspace() {
  const input = $<HTMLInputElement>("newWs");
  const name = input.value.trim();
  if (!name) {
    input.focus();
    return;
  }
  const btn = $<HTMLButtonElement>("newWsBtn");
  btn.disabled = true;
  try {
    const r = await api("/workspaces", { method: "POST", body: { name } });
    if (!r.ok) return status("err", r.data.error ?? "Could not create workspace");
    await chrome.storage.local.set({ workspaceId: r.data.workspace.id });
    await loadWorkspaces(r.data.workspace.id);
    status("ok", `Created "${name}".`);
  } catch {
    status("err", OFFLINE);
  } finally {
    btn.disabled = false;
  }
}
$("newWsBtn").addEventListener("click", createWorkspace);
$("newWsCancel").addEventListener("click", restoreSelection);
$("newWs").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    createWorkspace();
  } else if (e.key === "Escape") {
    e.preventDefault();
    restoreSelection();
  }
});
$("registerLink").addEventListener("click", () => open(`${DASHBOARD_URL}/register`));
$("openDash").addEventListener("click", () => open(DASHBOARD_URL));
$("openSettings").addEventListener("click", () => {
  const ws = selected();
  open(ws ? `${DASHBOARD_URL}/workspace/${ws.id}/settings` : DASHBOARD_URL);
});
$("statusLink").addEventListener("click", () => {
  const url = $("statusLink").dataset.url;
  if (url) open(url);
});

$("logoutBtn").addEventListener("click", async () => {
  await clearToken();
  workspaces = [];
  await render();
});

$("pageFavicon").addEventListener("error", () => {
  $("pageFavicon").hidden = true;
  $("pageFallback").style.display = "";
});

$("workspace").addEventListener("change", async () => {
  const sel = $<HTMLSelectElement>("workspace");
  if (sel.value === "new") {
    const name = prompt("Enter new workspace name:");
    if (!name || !name.trim()) {
      const { workspaceId } = await chrome.storage.local.get("workspaceId");
      const want = typeof workspaceId === "string" && workspaces.some((w) => w.id === workspaceId) ? workspaceId : workspaces[0]?.id ?? "";
      sel.value = want;
      fillSettings();
      return;
    }
    const trimmed = name.trim();
    try {
      const r = await api("/workspaces", { method: "POST", body: { name: trimmed } });
      if (!r.ok) {
        status("err", r.data.error ?? "Could not create workspace");
        const { workspaceId } = await chrome.storage.local.get("workspaceId");
        const want = typeof workspaceId === "string" && workspaces.some((w) => w.id === workspaceId) ? workspaceId : workspaces[0]?.id ?? "";
        sel.value = want;
        fillSettings();
        return;
      }
      await chrome.storage.local.set({ workspaceId: r.data.workspace.id });
      await loadWorkspaces(r.data.workspace.id);
      status("ok", `Created "${trimmed}".`);
    } catch {
      status("err", OFFLINE);
      const { workspaceId } = await chrome.storage.local.get("workspaceId");
      const want = typeof workspaceId === "string" && workspaces.some((w) => w.id === workspaceId) ? workspaceId : workspaces[0]?.id ?? "";
      sel.value = want;
      fillSettings();
    }
    return;
  }
  chrome.storage.local.set({ workspaceId: sel.value });
  fillSettings();
});

$("clipBtn").addEventListener("click", async () => {
  if (clipping || !clippable) return;
  setClipBusy(true);
  status("");
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return status("err", "No active tab");

    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
    const page = await chrome.tabs.sendMessage(tab.id, { type: "OWLET_EXTRACT" });
    if (!page || page.rawText.length < 50) return status("err", "Not enough readable text on this page.");

    const r = await api("/research/clip", {
      method: "POST",
      body: { ...page, workspaceId: $<HTMLSelectElement>("workspace").value || undefined },
    });

    if (r.status === 401) {
      await clearToken();
      await render();
      return loginMsg("Session expired. Please log in again.");
    }
    if (r.status === 409) {
      const link = r.data.id ? { label: "View it", url: `${DASHBOARD_URL}/item/${r.data.id}` } : undefined;
      return status("info", "Already in this workspace.", link);
    }
    if (!r.ok) return status("err", r.data.error ?? "Clip failed");

    const id = r.data.item?._id;
    const link = id ? { label: "View in Owlet", url: `${DASHBOARD_URL}/item/${id}` } : undefined;
    status(
      r.data.aiFailed ? "info" : "ok",
      r.data.aiFailed ? "Saved, but the AI summary failed." : "Saved with an AI summary.",
      link
    );
    flashClipDone();
  } catch {
    status("err", "Can't clip this page. Try a normal website, and check that the server is running.");
  } finally {
    setClipBusy(false);
  }
});

$("saveSettings").addEventListener("click", async () => {
  const ws = selected();
  if (!ws) return;
  const btn = $<HTMLButtonElement>("saveSettings");
  btn.disabled = true;
  $("saveSpinner").hidden = false;
  $("saveLabel").textContent = "Saving…";
  try {
    const aiSettings = {
      format: $<HTMLSelectElement>("format").value,
      length: $<HTMLSelectElement>("length").value,
      instructions: $<HTMLTextAreaElement>("instructions").value.trim(),
    };
    const r = await api(`/workspaces/${ws.id}`, { method: "PATCH", body: { aiSettings } });
    if (!r.ok) return status("err", r.data.error ?? "Could not save settings");
    await loadWorkspaces(ws.id);
    status("ok", "Settings saved.");
    $("saveLabel").textContent = "Saved";
    setTimeout(() => ($("saveLabel").textContent = "Save settings"), 1800);
  } catch {
    status("err", OFFLINE);
  } finally {
    $("saveSpinner").hidden = true;
    btn.disabled = selected()?.role !== "owner";
    if ($("saveLabel").textContent === "Saving…") $("saveLabel").textContent = "Save settings";
  }
});

render();

// ---------- login ----------

async function handleLogin(e: SubmitEvent) {  
  e.preventDefault();  
  loginMsg("");  
  
  const email = $<HTMLInputElement>("email").value.trim();  
  const password = $<HTMLInputElement>("password").value;  
  if (!email || !password) return;  
  
  const btn = $<HTMLButtonElement>("loginBtn");  
  btn.disabled = true;  
  $("loginSpinner").hidden = false;  
  $("loginLabel").textContent = "Logging in…";  
  
  try {    
    const r = await api("/auth/login", { method: "POST", body: { email, password } });    
    
    if (r.status === 429) return loginMsg("Too many attempts. Wait a few minutes and try again.");    
    if (!r.ok) return loginMsg(r.data.error || "Incorrect email or password.");    
    if (!r.data.token) return loginMsg("The server didn't return a login token.");    
    
    await setToken(r.data.token);    
    $<HTMLInputElement>("password").value = "";    
    await render();  
  } catch {    
    loginMsg(OFFLINE);  
  } finally {    
    btn.disabled = false;    
    $("loginSpinner").hidden = true;    
    $("loginLabel").textContent = "Log in";  
  }
}

$("loginForm").addEventListener("submit", handleLogin);