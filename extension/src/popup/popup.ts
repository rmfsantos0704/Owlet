import { api, getToken, setToken, clearToken, DASHBOARD_URL, wake } from "../api";
import { HIGHLIGHT_COLORS } from "../highlightColors";
import { normalizePageUrl } from "../pageUrl";

type Collection = {
  id: string;
  name: string;
  role: string;
  isDefault?: boolean;
};

type AiSettings = { format: string; length: string; instructions: string };
type AiDailyUsage = { used: number; limit: number; remaining: number };
const AI_DEFAULTS: AiSettings = { format: "paragraph", length: "medium", instructions: "" };

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
let hasLink = false; // whether the selected collection currently has a usable join link
let clipTags: string[] = [];

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
  $<HTMLButtonElement>("showHighlightsBtn").disabled = !clippable || !selected();
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

// ---------- AI summary settings (per clip) ----------

// The settings in the form. They are sent with the next clip and remembered here for the one after.
function readAi(): AiSettings {
  return {
    format: $<HTMLSelectElement>("format").value,
    length: $<HTMLSelectElement>("length").value,
    instructions: $<HTMLTextAreaElement>("instructions").value.trim(),
  };
}

function updateAiHint() {
  const s = readAi();
  $("aiHint").textContent = `AI summary: ${FORMATS[s.format] ?? "Paragraph"} \u00B7 ${LENGTHS[s.length] ?? "Medium"}`;
}

function renderClipTags() {
  const list = $("clipTagList");
  list.replaceChildren();
  for (const tag of clipTags) {
    const chip = document.createElement("span");
    chip.className = "clip-tag";
    chip.append(document.createTextNode(tag));
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "×";
    remove.setAttribute("aria-label", `Remove ${tag}`);
    remove.addEventListener("click", () => {
      clipTags = clipTags.filter((item) => item !== tag);
      renderClipTags();
    });
    chip.append(remove);
    list.append(chip);
  }
}

function addClipTags(raw: string) {
  const input = $<HTMLInputElement>("clipTags");
  const values = raw.split(",").map((tag) => tag.trim().toLowerCase()).filter(Boolean);
  for (const tag of values) {
    if (tag.length > 40) {
      status("err", "Tags must be 40 characters or fewer.");
      continue;
    }
    if (!clipTags.includes(tag) && clipTags.length < 20) clipTags.push(tag);
  }
  if (clipTags.length >= 20 && values.some((tag) => !clipTags.includes(tag))) {
    status("err", "A clip can have up to 20 tags.");
  }
  input.value = "";
  renderClipTags();
}

async function loadTagSuggestions(collectionId: string) {
  try {
    const response = await api(`/collections/${encodeURIComponent(collectionId)}/tags`);
    if (!response.ok || selected()?.id !== collectionId) return;
    const suggestions = (response.data.tags as string[]).filter((tag) => typeof tag === "string");
    const list = $("tagSuggestions");
    list.replaceChildren(...suggestions.map((tag) => {
      const option = document.createElement("option");
      option.value = tag;
      return option;
    }));
  } catch {
    $("tagSuggestions").replaceChildren();
  }
}

async function loadAi() {
  const { aiSettings } = await chrome.storage.local.get("aiSettings");
  const s: AiSettings = { ...AI_DEFAULTS, ...(aiSettings as Partial<AiSettings> | undefined) };
  $<HTMLSelectElement>("format").value = s.format;
  $<HTMLSelectElement>("length").value = s.length;
  $<HTMLTextAreaElement>("instructions").value = s.instructions;
  updateAiHint();
}
// Show the AI settings only when the server has AI turned on.
async function loadFeatures() {
  try {
    const r = await api("/auth/me");
    const on = !!r.data?.features?.ai;
    $("aiSettings").hidden = !on;
    $("aiHintRow").hidden = !on;
    const usage = r.data?.features?.aiUsage as AiDailyUsage | undefined;
    if (
      usage &&
      Number.isFinite(usage.used) &&
      Number.isInteger(usage.limit) &&
      usage.limit > 0 &&
      Number.isFinite(usage.remaining)
    ) {
      const exhausted = usage.remaining === 0;
      $("aiUsage").hidden = false;
      $("aiUsageCount").textContent = `${usage.used} / ${usage.limit}`;
      $("aiUsageLabel").textContent = exhausted
        ? "Daily allowance used. AI is off for your account until midnight UTC."
        : `${usage.remaining} ${usage.remaining === 1 ? "use" : "uses"} left today. AI pauses for your account when used up.`;
      const progress = $("aiUsageProgress");
      progress.setAttribute("aria-valuemax", String(usage.limit));
      progress.setAttribute("aria-valuenow", String(Math.min(usage.used, usage.limit)));
      $("aiUsageBar").style.width = `${Math.min(100, (usage.used / usage.limit) * 100)}%`;
    }
  } catch {
    /* offline: the AI parts stay hidden */
  }
}

function onAiChange() {
  updateAiHint();
  void chrome.storage.local.set({ aiSettings: readAi() });
}

for (const id of ["format", "length", "instructions"]) {
  $(id).addEventListener("input", onAiChange);
  $(id).addEventListener("change", onAiChange);
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

// Collection settings: only the join link lives here now, and only the owner of a shared collection gets it.
function fillSettings() {
  const ws = selected();
  const canShare = !!(ws?.role === "owner" && !ws.isDefault); // the Personal collection can't be shared
  $("shareRow").hidden = !canShare;
  shareNote();
  if (canShare) void refreshLinkInfo();
  updateClipEnabled();
}

// ---------- join link ----------

// the line under the link buttons; pass a url to show it for copying by hand
function shareNote(text = "", url = "") {
  const note = $("copyLinkNote");
  note.textContent = text;
  note.hidden = !text;
  const field = $<HTMLInputElement>("copyLinkField");
  field.hidden = !url;
  field.value = url;
  if (url) field.select();
}

function setSelect(id: string, value: string) {
  const sel = $<HTMLSelectElement>(id);
  if (![...sel.options].some((o) => o.value === value)) sel.add(new Option(value, value));
  sel.value = value;
}

function resetLinkLabels() {
  $("copyLinkLabel").textContent = "Copy link";
  $("newLinkLabel").textContent = hasLink ? "Replace link" : "New link";
}

// Shows the current link's details and loads its role and use limit into the pickers so they can be tweaked.
function applyLink(link: JoinLink | null | undefined) {
  const info = $("linkInfo");
  hasLink = linkUsable(link);
  if (link && hasLink) {
    const uses = link.maxUses === null ? `${link.uses} joined` : `${link.uses} of ${link.maxUses} used`;
    const active = document.createElement("strong");
    active.textContent = "Active";
    info.replaceChildren(
      active,
      document.createTextNode(
        ` · joins as ${link.role} · expires ${new Date(link.expiresAt).toLocaleDateString()} · ${uses}. A new link replaces this one.`
      )
    );
    setSelect("linkRole", link.role);
    setSelect("linkUses", link.maxUses === null ? "" : String(link.maxUses));
  } else if (link?.expired) {
    info.textContent = "The link has expired. Create a new one.";
  } else if (link) {
    info.textContent = "The link has reached its use limit. Create a new one.";
  } else {
    info.textContent = "No active link. Choose the settings below and create one.";
  }
  resetLinkLabels();
}

async function refreshLinkInfo() {
  const ws = selected();
  if (!ws || ws.role !== "owner" || ws.isDefault) return;
  $("linkInfo").textContent = "Checking link…";
  try {
    const got = await api(`/collections/${ws.id}`);
    if (selected()?.id !== ws.id) return; // the person switched collections meanwhile
    if (!got.ok) {
      $("linkInfo").textContent = "";
      return;
    }
    applyLink(got.data.collection?.joinLink);
  } catch {
    if (selected()?.id === ws.id) $("linkInfo").textContent = "";
  }
}

function linkOptions() {
  const uses = $<HTMLSelectElement>("linkUses").value;
  return {
    role: $<HTMLSelectElement>("linkRole").value,
    expiresInDays: Number($<HTMLSelectElement>("linkExpiry").value),
    maxUses: uses ? Number(uses) : null,
  };
}

// "copy": copy the working link (making one with the chosen settings if there isn't one).
// "new": always make a fresh link with the chosen settings, then copy it.
async function shareLink(mode: "copy" | "new") {
  const ws = selected();
  if (!ws || ws.role !== "owner" || ws.isDefault) return;
  const copyBtn = $<HTMLButtonElement>("copyLinkBtn");
  const newBtn = $<HTMLButtonElement>("newLinkBtn");
  const label = $(mode === "copy" ? "copyLinkLabel" : "newLinkLabel");
  copyBtn.disabled = newBtn.disabled = true;
  label.textContent = mode === "copy" ? "Getting link\u2026" : "Creating\u2026";
  shareNote();
  let copied = false;
  try {
    let link: JoinLink | null | undefined;
    if (mode === "copy") {
      const got = await api(`/collections/${ws.id}`);
      if (got.status === 401) {
        await clearToken();
        await render();
        return loginMsg("Session expired. Please log in again.");
      }
      if (!got.ok) return shareNote(got.data.error ?? "Couldn't load the collection.");
      link = got.data.collection?.joinLink;
    }

    let created = false;
    if (mode === "new" || !linkUsable(link)) {
      const made = await api(`/collections/${ws.id}/join-link`, { method: "POST", body: linkOptions() });
      if (made.status === 401) {
        await clearToken();
        await render();
        return loginMsg("Session expired. Please log in again.");
      }
      if (made.status === 429) return shareNote("Too many requests. Try again in a little while.");
      if (!made.ok) return shareNote(made.data.error ?? "Couldn't create the link.");
      link = made.data.joinLink as JoinLink;
      created = true;
    }
    if (!link) return shareNote("Couldn't get the link.");

    applyLink(link);
    const url = `${DASHBOARD_URL}/join/${link.token}`;
    const prefix = created ? "New link created" : "Copied";
    try {
      await navigator.clipboard.writeText(url);
      copied = true;
      label.textContent = created ? "Created" : "Copied";
      shareNote(`${prefix} and copied.`);
      setTimeout(() => {
        if (!copyBtn.disabled) resetLinkLabels();
      }, 2000);
    } catch {
      shareNote(`${prefix}, but copying was blocked. Copy it by hand:`, url); // the link exists; the browser blocked copying
    }
  } catch {
    shareNote(OFFLINE);
  } finally {
    copyBtn.disabled = newBtn.disabled = false;
    if (!copied) resetLinkLabels();
  }
}

// ---------- collections ----------

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
    sel.replaceChildren();
    for (const w of collections) sel.add(new Option(w.name, w.id));
    sel.add(new Option("+ Create new collection…", "new"));

    const want = preferId ?? (typeof collectionId === "string" ? collectionId : "");
    if (collections.some((w) => w.id === want)) sel.value = want;
    lastCollectionId = sel.value;
    showNewRow(false);
    fillSettings();
    const collection = selected();
    if (collection) void loadTagSuggestions(collection.id);
  } catch {
    status("err", OFFLINE);
  }
}

async function render() {
  wake(); // free hosts sleep when idle: start waking the server as soon as the popup opens
  const loggedIn = !!(await getToken());
  $("viewLogin").hidden = loggedIn;
  $("viewMain").hidden = !loggedIn;
  if (!loggedIn) return;
  status("");
  await Promise.all([loadPage(), loadCollections(), loadAi(), loadFeatures()]);
}

// ---------- events ----------

$("collection").addEventListener("change", () => {
  const sel = $<HTMLSelectElement>("collection");
  if (sel.value === "new") {
    $("tagSuggestions").replaceChildren();
    status("");
    showNewRow(true);
    fillSettings();
    return;
  }
  lastCollectionId = sel.value;
  showNewRow(false);
  chrome.storage.local.set({ collectionId: sel.value });
  fillSettings();
  const collection = selected();
  if (collection) void loadTagSuggestions(collection.id);
});

$<HTMLInputElement>("clipTags").addEventListener("keydown", (event) => {
  const input = event.currentTarget as HTMLInputElement;
  if (event.key === "Enter" || event.key === ",") {
    event.preventDefault();
    addClipTags(input.value);
  }
});
$<HTMLInputElement>("clipTags").addEventListener("change", (event) => {
  const input = event.currentTarget as HTMLInputElement;
  if (input.value) addClipTags(input.value);
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
$("copyLinkBtn").addEventListener("click", () => void shareLink("copy"));
$("newLinkBtn").addEventListener("click", () => void shareLink("new"));
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

$<HTMLButtonElement>("showHighlightsBtn").addEventListener("click", async () => {
  const button = $<HTMLButtonElement>("showHighlightsBtn");
  if (button.disabled) return;
  button.disabled = true;
  status("info", "Finding saved highlights…");
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url || !/^https?:\/\//i.test(tab.url)) {
      return status("err", "Open a regular web page to show its highlights.");
    }
    const collection = selected();
    if (!collection) return status("err", "Choose a Collection first.");

    const url = normalizePageUrl(tab.url);
    const query = new URLSearchParams({ url, collectionId: collection.id });
    const found = await api(`/research/lookup?${query.toString()}`);
    if (found.status === 401) {
      await clearToken();
      await render();
      return loginMsg("Session expired. Please log in again.");
    }
    if (!found.ok) return status("err", found.data.error ?? "Couldn't find this page.");
    if (typeof found.data.id !== "string") return status("info", "This page isn't clipped yet.");

    const response = await api(`/research/${encodeURIComponent(found.data.id)}/highlights`);
    if (response.status === 401) {
      await clearToken();
      await render();
      return loginMsg("Session expired. Please log in again.");
    }
    if (!response.ok) return status("err", response.data.error ?? "Couldn't load the highlights.");
    const highlights = response.data.highlights as { text: string; color: string }[];
    const [painted] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: paintSavedHighlights,
      args: [highlights, HIGHLIGHT_COLORS],
    });
    status("info", painted?.result ?? `Showing 0 of ${highlights.length} highlights`);
  } catch {
    status("err", "Can't reach Owlet or read this page.");
  } finally {
    button.disabled = !clippable || !selected();
  }
});

function paintSavedHighlights(
  highlights: { text: string; color: string }[],
  palette: Record<string, string>
): string {
  const pageWindow = window as Window & {
    Highlight?: new (...ranges: Range[]) => object;
    CSS?: {
      highlights?: {
        delete(name: string): void;
        set(name: string, value: object): void;
      };
    };
  };
  const registry = pageWindow.CSS?.highlights;
  const HighlightConstructor = pageWindow.Highlight;
  if (!registry || !HighlightConstructor) return `Showing 0 of ${highlights.length} highlights`;

  const colors = Object.keys(palette);
  for (const color of colors) registry.delete(`owlet-${color}`);

  const root = document.body ?? document.documentElement;
  if (!root) return `Showing 0 of ${highlights.length} highlights`;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      return parent && !["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA"].includes(parent.tagName)
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT;
    },
  });
  const nodes: Text[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) nodes.push(node as Text);

  const offsets: { node: Text; offset: number }[] = [];
  let text = "";
  for (const textNode of nodes) {
    for (let offset = 0; offset < textNode.length; offset += 1) {
      const character = textNode.data[offset];
      if (/\s/.test(character)) {
        if (text && !text.endsWith(" ")) {
          text += " ";
          offsets.push({ node: textNode, offset });
        }
      } else {
        text += character;
        offsets.push({ node: textNode, offset });
      }
    }
  }
  if (text.endsWith(" ")) {
    text = text.slice(0, -1);
    offsets.pop();
  }

  const rangesByColor = new Map<string, Range[]>();
  const usedRanges: { start: number; end: number }[] = [];
  for (const highlight of highlights) {
    const needle = highlight.text.replace(/\s+/g, " ").trim();
    const color = colors.includes(highlight.color) ? highlight.color : "yellow";
    if (!needle) continue;
    let start = text.indexOf(needle);
    while (
      start >= 0 &&
      usedRanges.some((range) => start < range.end && start + needle.length > range.start)
    ) {
      start = text.indexOf(needle, start + 1);
    }
    if (start < 0) continue;
    const end = start + needle.length - 1;
    const first = offsets[start];
    const last = offsets[end];
    if (!first || !last) continue;
    const range = document.createRange();
    range.setStart(first.node, first.offset);
    range.setEnd(last.node, last.offset + 1);
    usedRanges.push({ start, end: start + needle.length });
    const ranges = rangesByColor.get(color) ?? [];
    ranges.push(range);
    rangesByColor.set(color, ranges);
  }

  for (const [color, ranges] of rangesByColor) {
    registry.set(`owlet-${color}`, new HighlightConstructor(...ranges));
  }

  const styledColors = new Set<string>();
  for (const sheet of document.adoptedStyleSheets) {
    try {
      for (const rule of Array.from(sheet.cssRules)) {
        for (const color of colors) {
          if (rule.cssText.includes(`::highlight(owlet-${color})`)) styledColors.add(color);
        }
      }
    } catch {
      continue;
    }
  }
  const missingStyles = colors.filter((color) => !styledColors.has(color));
  if (missingStyles.length) {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(
      missingStyles.map((color) => `::highlight(owlet-${color}) { background-color: ${palette[color]}; }`).join("\n")
    );
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
  }

  const count = Array.from(rangesByColor.values()).reduce((total, ranges) => total + ranges.length, 0);
  return `Showing ${count} of ${highlights.length} highlights`;
}

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
      body: {
        ...page,
        collectionId: $<HTMLSelectElement>("collection").value || undefined,
        tags: [...clipTags],
        personalNote: $<HTMLInputElement>("personalNote").value.trim(),
        aiSettings: readAi(), // this clip's own AI settings
      },
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
    void loadFeatures();

    const id = r.data.item?._id;
    clipTags = [];
    renderClipTags();
    $<HTMLInputElement>("personalNote").value = "";
    const clippedCollection = selected();
    if (clippedCollection) void loadTagSuggestions(clippedCollection.id);
    const link = id ? { label: "View in Owlet", url: `${DASHBOARD_URL}/item/${id}` } : undefined;
    status(
      r.data.aiFailed ? "info" : "ok",
      r.data.aiFailed
        ? "Saved, but the AI summary failed."
        : r.data.aiEnabled === false
          ? "Saved."
          : "Saved with an AI summary.",
      link
    );
    flashClipDone();
  } catch {
    status("err", "Can't clip this page. Try a normal website, and check that the server is running.");
  } finally {
    setClipBusy(false);
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