import { api, getToken, setToken, clearToken, DASHBOARD_URL, wake } from "../api";
import { HIGHLIGHT_COLORS } from "../highlightColors";
import { normalizePageUrl } from "../pageUrl";
import { paintSavedHighlights } from "../highlightPaint";

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
const THEME_KEY = "popupTheme";
const TOUR_KEY = "extensionOnboardingSeen";
const COLOR_KEY = "highlightColor";
const TOUR_STEPS = [
  {
    target: "tourCollection",
    title: "Choose a Collection",
    description: "Collections keep different projects separate. Pick where this page should be saved, or create a new Collection right from the extension.",
  },
  {
    target: "tourDetails",
    title: "Add context",
    description: "Add tags to find this clip later, or a short note to remember why you saved it. Both are optional.",
  },
  {
    target: "tourClipActions",
    title: "Clip and revisit highlights",
    description: "Pick a highlight color, then clip this page to your selected Collection. Select text on a page and use the context menu or Alt+Shift+S to save a passage in that color (the right-click menu also lets you pick a color for a single highlight); Show my highlights displays saved passages on the current page.",
  },
  {
    target: "settings",
    title: "More tools when you need them",
    description: "Collection settings can create a shareable join link. Open the dashboard for members and other Collection controls. If AI is enabled, its summary preferences are here too.",
  },
];

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

let collections: Collection[] = [];
let clippable = false;
let clipping = false;
let lastCollectionId = ""; // last real selection, so Cancel can go back to it
let hasLink = false; // whether the selected collection currently has a usable join link
let clipTags: string[] = [];
let tourStep = 0;

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

function updateThemeButton(dark: boolean) {
  const button = $<HTMLButtonElement>("themeToggle");
  button.setAttribute("aria-pressed", String(dark));
  button.title = dark ? "Turn off dark mode" : "Turn on dark mode";
  button.setAttribute("aria-label", button.title);
  $("themeMoon").hidden = dark;
  $("themeSun").hidden = !dark;
}

async function applyTheme(loggedIn: boolean) {
  const { [THEME_KEY]: theme } = await chrome.storage.local.get(THEME_KEY);
  const dark = loggedIn && theme === "dark";
  document.body.classList.toggle("dark", dark);
  updateThemeButton(dark);
}

function closeTour() {
  $("tourOverlay").hidden = true;
  $("tourCard").hidden = true;
  document.querySelectorAll(".tour-target").forEach((target) => target.classList.remove("tour-target"));
  window.removeEventListener("resize", positionTour);
  window.removeEventListener("scroll", positionTour, true);
  void chrome.storage.local.set({ [TOUR_KEY]: true });
}

function positionTour() {
  const target = document.getElementById(TOUR_STEPS[tourStep].target);
  if (!target || $("tourOverlay").hidden) return;
  const targetRect = target.getBoundingClientRect();
  const card = $("tourCard");
  const cardRect = card.getBoundingClientRect();
  const margin = 12;
  let top = targetRect.bottom + 10;
  if (top + cardRect.height > window.innerHeight - margin) {
    top = targetRect.top - cardRect.height - 10;
  }
  top = Math.max(margin, Math.min(top, window.innerHeight - cardRect.height - margin));
  const left = Math.max(
    margin,
    Math.min(
      targetRect.left + targetRect.width / 2 - cardRect.width / 2,
      window.innerWidth - cardRect.width - margin
    )
  );
  card.style.top = `${top}px`;
  card.style.left = `${left}px`;
}

function showTour(index = 0) {
  tourStep = Math.min(Math.max(index, 0), TOUR_STEPS.length - 1);
  document.querySelectorAll(".tour-target").forEach((target) => target.classList.remove("tour-target"));
  const step = TOUR_STEPS[tourStep];
  const target = $(step.target);
  target.scrollIntoView({ block: "nearest", behavior: "smooth" });
  target.classList.add("tour-target");
  $("tourCount").textContent = `Extension guide · ${tourStep + 1} of ${TOUR_STEPS.length}`;
  $("tourTitle").textContent = step.title;
  $("tourDescription").textContent = step.description;
  $<HTMLButtonElement>("tourBack").hidden = tourStep === 0;
  $("tourNext").textContent = tourStep === TOUR_STEPS.length - 1 ? "Done" : "Next";
  $("tourOverlay").hidden = false;
  $("tourCard").hidden = false;
  window.removeEventListener("resize", positionTour);
  window.removeEventListener("scroll", positionTour, true);
  window.addEventListener("resize", positionTour);
  window.addEventListener("scroll", positionTour, true);
  requestAnimationFrame(positionTour);
  $("tourNext").focus();
}

async function showTourForFirstUse() {
  const { [TOUR_KEY]: seen } = await chrome.storage.local.get(TOUR_KEY);
  if (!seen && !$("viewMain").hidden) showTour();
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

// ---------- highlight color picker ----------

// The chosen color is kept in chrome.storage.local and read by the service worker
// when Alt+Shift+S saves a selection.
async function renderColorPicker() {
  const { [COLOR_KEY]: stored } = await chrome.storage.local.get(COLOR_KEY);
  const current =
    typeof stored === "string" && Object.keys(HIGHLIGHT_COLORS).includes(stored) ? stored : "yellow";
  const group = $("colorPicker");
  group.replaceChildren();
  for (const [name, hex] of Object.entries(HIGHLIGHT_COLORS)) {
    const label = name[0].toUpperCase() + name.slice(1);
    const swatch = document.createElement("button");
    swatch.type = "button";
    swatch.className = "color-swatch";
    swatch.style.backgroundColor = hex;
    swatch.title = label;
    swatch.setAttribute("role", "radio");
    swatch.setAttribute("aria-label", label);
    swatch.setAttribute("aria-checked", String(name === current));
    swatch.addEventListener("click", async () => {
      await chrome.storage.local.set({ [COLOR_KEY]: name });
      void renderColorPicker();
    });
    group.append(swatch);
  }
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
      const usageIndicator = $("aiUsage");
      usageIndicator.hidden = false;
      usageIndicator.classList.toggle("ai-usage-exhausted", exhausted);
      $("aiUsageCount").textContent = `${usage.used}/${usage.limit}`;
      $("aiUsageToast").textContent = exhausted
        ? "You've used all your AI uses for today. Your allowance resets at midnight UTC."
        : `${usage.remaining} ${usage.remaining === 1 ? "use" : "uses"} left today.`;
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
  const canShare = !!(ws?.role === "owner" && !ws.isDefault);
  const hint = $("settingsHint");
  hint.hidden = canShare;
  hint.textContent = !ws
    ? "Choose a Collection to see its settings."
    : ws.isDefault
      ? "Join links aren't available for your Personal Collection. Choose a Collection you own to manage sharing."
      : ws.role !== "owner"
        ? "Only the Collection owner can manage join links. Other Collection settings are available in the dashboard."
        : "";
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
      $("linkInfo").textContent = got.data.error ?? "Couldn't load the join link. Try again.";
      return;
    }
    applyLink(got.data.collection?.joinLink);
  } catch {
    if (selected()?.id === ws.id) {
      $("linkInfo").textContent = "Couldn't reach Owlet. Check your connection and try again.";
    }
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
  await applyTheme(loggedIn);
  if (!loggedIn) return;
  status("");
  await Promise.all([loadPage(), loadCollections(), loadAi(), loadFeatures(), renderColorPicker()]);
  await showTourForFirstUse();
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
$<HTMLButtonElement>("themeToggle").addEventListener("click", async () => {
  const dark = $<HTMLButtonElement>("themeToggle").getAttribute("aria-pressed") !== "true";
  await chrome.storage.local.set({ [THEME_KEY]: dark ? "dark" : "light" });
  await applyTheme(!$("viewMain").hidden);
});
$("tourBtn").addEventListener("click", () => showTour());
$("tourClose").addEventListener("click", closeTour);
$("tourSkip").addEventListener("click", closeTour);
$("tourBack").addEventListener("click", () => showTour(tourStep - 1));
$("tourNext").addEventListener("click", () => {
  if (tourStep === TOUR_STEPS.length - 1) closeTour();
  else showTour(tourStep + 1);
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !$("tourOverlay").hidden) closeTour();
});
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
      r.data.aiLimitReached || r.data.aiFailed ? "info" : "ok",
      r.data.aiLimitReached
        ? "Saved without AI. Open it for Owlet's Quick Summary; you can generate an AI summary after the daily limit resets."
        : r.data.aiFailed
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
  if (area !== "local") return;
  if (changes[THEME_KEY]) void applyTheme(!$("viewMain").hidden);
  if (changes.token) {
    collections = [];
    void render();
  }
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