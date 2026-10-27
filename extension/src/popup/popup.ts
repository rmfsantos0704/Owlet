import { api, getToken, setToken, clearToken, DASHBOARD_URL } from "../api";

type Collection = {
  id: string;
  name: string;
  role: string;
  isDefault?: boolean;
  aiSettings: { format: string; length: string; instructions: string };
};

type JoinLink = { token: string; role: string; expiresAt: string; maxUses: number | null; uses: number; expired: boolean };
const linkUsable = (l?: JoinLink | null): l is JoinLink =>
  !!l && !l.expired && (l.maxUses === null || l.uses < l.maxUses);

const FORMATS: Record<string, string> = {
  paragraph: "Paragraph",
  bullets: "Bullet points",
  academic: "Academic",
  simple: "Plain language",
};
const LENGTHS: Record<string, string> = { short: "Short", medium: "Medium", detailed: "Detailed" };
const OFFLINE = "Can't reach Owlet. Is the server running?";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

let collections: Collection[] = [];
let clippable = false;
let clipping = false;
let lastCollectionId = ""; // last real selection, so Cancel can go back to it

const open = (url: string) => chrome.tabs.create({ url });
const selected = () => collections.find((w) => w.id === $<HTMLSelectElement>("collection").value);

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
  $("newCollectionRow").hidden = !show;
  if (show) {
    const input = $<HTMLInputElement>("newCollection");
    input.value = "";
    input.focus();
  }
}

function restoreSelection() {
  const sel = $<HTMLSelectElement>("collection");
  sel.value = collections.some((w) => w.id === lastCollectionId) ? lastCollectionId : collections[0]?.id ?? "";
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
  $("shareRow").hidden = !(owner && !ws?.isDefault); // the Personal collection can't be shared
  shareNote();
  $("aiHint").textContent = ws
    ? `AI summary: ${FORMATS[s?.format ?? ""] ?? "Paragraph"} \u00B7 ${LENGTHS[s?.length ?? ""] ?? "Medium"}`
    : "AI summary";
  updateClipEnabled();
}

// the line under the "Copy join link" button; pass a url to show it for copying by hand
function shareNote(text = "", url = "") {
  const note = $("copyLinkNote");
  note.textContent = text;
  note.hidden = !text;
  const field = $<HTMLInputElement>("copyLinkField");
  field.hidden = !url;
  field.value = url;
  if (url) field.select();
}

// Copies the collection's join link, making a viewer link (7 days) first if there isn't a working one.
async function copyJoinLink() {
  const ws = selected();
  if (!ws || ws.role !== "owner" || ws.isDefault) return;
  const btn = $<HTMLButtonElement>("copyLinkBtn");
  const label = $("copyLinkLabel");
  btn.disabled = true;
  label.textContent = "Getting link\u2026";
  shareNote();
  let copied = false;
  try {
    const got = await api(`/collections/${ws.id}`);
    if (got.status === 401) {
      await clearToken();
      await render();
      return loginMsg("Session expired. Please log in again.");
    }
    if (!got.ok) return shareNote(got.data.error ?? "Couldn't load the collection.");

    let link = got.data.collection?.joinLink as JoinLink | null | undefined;
    if (!linkUsable(link)) {
      const made = await api(`/collections/${ws.id}/join-link`, {
        method: "POST",
        body: { role: "viewer", expiresInDays: 7, maxUses: null },
      });
      if (made.status === 429) return shareNote("Too many requests. Try again in a little while.");
      if (!made.ok) return shareNote(made.data.error ?? "Couldn't create the link.");
      link = made.data.joinLink as JoinLink;
    }

    const url = `${DASHBOARD_URL}/join/${link.token}`;
    const info = `Joins as ${link.role}, expires ${new Date(link.expiresAt).toLocaleDateString()}.`;
    try {
      await navigator.clipboard.writeText(url);
      copied = true;
      label.textContent = "Link copied";
      shareNote(`Copied. ${info}`);
      setTimeout(() => {
        if (!btn.disabled) label.textContent = "Copy join link";
      }, 2000);
    } catch {
      shareNote(`Couldn't copy automatically. ${info}`, url); // the link exists; the browser blocked copying
    }
  } catch {
    shareNote(OFFLINE);
  } finally {
    btn.disabled = false;
    if (!copied) label.textContent = "Copy join link";
  }
}

async function loadCollections(preferId?: string) {
  try {
    const r = await api("/collections");
    if (r.status === 401) {
      await clearToken();
      await render();
      return loginMsg("Session expired. Please log in again.");
    }
    if (!r.ok) return status("err", r.data.error ?? "Couldn't load your collections");

    const { collectionId } = await chrome.storage.local.get("collectionId");
    collections = (r.data.collections as Collection[]).filter((w) => w.role !== "viewer");
    const sel = $<HTMLSelectElement>("collection");
    sel.innerHTML = "";
    for (const w of collections) sel.add(new Option(w.name, w.id));
    sel.add(new Option("+ Create new collection…", "new"));

    const want = preferId ?? (typeof collectionId === "string" ? collectionId : "");
    if (collections.some((w) => w.id === want)) sel.value = want;
    lastCollectionId = sel.value;
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
  await Promise.all([loadPage(), loadCollections()]);
}

// ---------- events ----------

$("collection").addEventListener("change", () => {
  const sel = $<HTMLSelectElement>("collection");
  if (sel.value === "new") {
    status("");
    showNewRow(true);
    fillSettings();
    return;
  }
  lastCollectionId = sel.value;
  showNewRow(false);
  chrome.storage.local.set({ collectionId: sel.value });
  fillSettings();
});

async function createCollection() {
  const input = $<HTMLInputElement>("newCollection");
  const name = input.value.trim();
  if (!name) {
    input.focus();
    return;
  }
  const btn = $<HTMLButtonElement>("newCollectionBtn");
  btn.disabled = true;
  try {
    const r = await api("/collections", { method: "POST", body: { name } });
    if (!r.ok) return status("err", r.data.error ?? "Could not create collection");
    await chrome.storage.local.set({ collectionId: r.data.collection.id });
    await loadCollections(r.data.collection.id);
    status("ok", `Created "${name}".`);
  } catch {
    status("err", OFFLINE);
  } finally {
    btn.disabled = false;
  }
}

$("newCollectionBtn").addEventListener("click", createCollection);
$("newCollectionCancel").addEventListener("click", restoreSelection);
$("newCollection").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    createCollection();
  } else if (e.key === "Escape") {
    e.preventDefault();
    restoreSelection();
  }
});

$("registerLink").addEventListener("click", () => open(`${DASHBOARD_URL}/register`));
$("openDash").addEventListener("click", () => open(DASHBOARD_URL));
$("openSettings").addEventListener("click", () => {
  const ws = selected();
  open(ws ? `${DASHBOARD_URL}/collection/${ws.id}/settings` : DASHBOARD_URL);
});
$("copyLinkBtn").addEventListener("click", copyJoinLink);
$("statusLink").addEventListener("click", () => {
  const url = $("statusLink").dataset.url;
  if (url) open(url);
});

$("logoutBtn").addEventListener("click", async () => {
  await clearToken();
  collections = [];
  await render();
});

$("pageFavicon").addEventListener("error", () => {
  $("pageFavicon").hidden = true;
  $("pageFallback").style.display = "";
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
      body: { ...page, collectionId: $<HTMLSelectElement>("collection").value || undefined },
    });

    if (r.status === 401) {
      await clearToken();
      await render();
      return loginMsg("Session expired. Please log in again.");
    }
    if (r.status === 409) {
      const link = r.data.id ? { label: "View it", url: `${DASHBOARD_URL}/item/${r.data.id}` } : undefined;
      return status("info", "Already in this collection.", link);
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
    const r = await api(`/collections/${ws.id}`, { method: "PATCH", body: { aiSettings } });
    if (!r.ok) return status("err", r.data.error ?? "Could not save settings");
    await loadCollections(ws.id);
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

// the dashboard logged in or out (bridge.ts): follow it while the popup is open
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes.token) return;
  collections = [];
  void render();
});

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