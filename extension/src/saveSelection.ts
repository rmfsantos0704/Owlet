import { api, clearToken, DASHBOARD_URL, getToken, wake } from "./api";
import { HIGHLIGHT_COLORS } from "./highlightColors";
import { normalizePageUrl } from "./pageUrl";
import { paintSavedHighlights } from "./highlightPaint";

type ColorName = keyof typeof HIGHLIGHT_COLORS;

async function selectedHighlightColor(): Promise<ColorName> {
  const { highlightColor } = await chrome.storage.local.get("highlightColor");
  return typeof highlightColor === "string" && Object.keys(HIGHLIGHT_COLORS).includes(highlightColor)
    ? (highlightColor as ColorName)
    : "yellow";
}

type LookupResult = { id: string | null; collectionId: string | null };
type SavedPage = {
  url: string;
  title: string;
  author?: string;
  authors?: string[];
  publishedDate?: string;
  journal?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  doi?: string;
  rawText: string;
};
type CaptureResult = { text: string; paintId: string | null };

class SaveError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message);
  }
}

function messageForStatus(status: number): string {
  if (status === 401) return "Session expired, log in again";
  if (status === 403) return "You can't add to that collection";
  if (status === 429) return "Too many requests, try again soon";
  return "Couldn't save the selection to Owlet";
}

async function withKeepAlive<T>(fn: () => Promise<T>): Promise<T> {
  const timer = setInterval(() => {
    void chrome.runtime.getPlatformInfo().catch(() => {});
  }, 20_000);
  try {
    return await fn();
  } finally {
    clearInterval(timer);
  }
}

async function selectedCollectionId(): Promise<string> {
  const stored = await chrome.storage.local.get("collectionId");
  if (typeof stored.collectionId === "string") return stored.collectionId;

  const response = await api("/collections");
  if (!response.ok) throw new SaveError(messageForStatus(response.status), response.status);
  const eligible = (response.data.collections as { id: string; role: string; isDefault?: boolean }[])
    .filter((collection) => collection.role !== "viewer");
  const fallback = eligible.find((collection) => collection.isDefault) ?? eligible[0];
  if (!fallback) throw new SaveError("Choose an editable collection in the Owlet extension first.");
  return fallback.id;
}

// Remembers which Owlet item belongs to a page, so a second highlight on the same page
// skips the lookup (and the clip) and goes straight to saving the highlight.
// storage.session is wiped when the browser closes, so stale entries don't pile up.
const itemCacheKey = (collectionId: string, pageUrl: string) => `item:${collectionId}:${pageUrl}`;

async function getCachedItem(key: string): Promise<string | null> {
  try {
    const stored = await chrome.storage.session.get(key);
    return typeof stored[key] === "string" ? stored[key] : null;
  } catch {
    return null;
  }
}
async function setCachedItem(key: string, itemId: string): Promise<void> {
  try {
    await chrome.storage.session.set({ [key]: itemId });
  } catch {
    /* cache is optional */
  }
}
async function clearCachedItem(key: string): Promise<void> {
  try {
    await chrome.storage.session.remove(key);
  } catch {
    /* cache is optional */
  }
}

async function injectFeedback(
  tabId: number | undefined,
  frameId: number,
  message: string,
  success: boolean,
  itemId?: string,
  pending = false
): Promise<boolean> {
  if (tabId === undefined) return false;
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId, frameIds: [frameId] },
      func: showSelectionFeedback,
      args: [message, success, itemId ?? "", DASHBOARD_URL, pending],
    });
    return result?.result === true;
  } catch (error) {
    console.error("Could not show Owlet feedback in the page:", error);
    return false;
  }
}

async function showBadgeFallback(success: boolean): Promise<void> {
  try {
    await chrome.action.setBadgeBackgroundColor({ color: success ? "#047857" : "#b91c1c" });
    await chrome.action.setBadgeText({ text: success ? "✓" : "!" });
    setTimeout(() => {
      void chrome.action.setBadgeText({ text: "" }).catch((error) => {
        console.error("Could not clear the Owlet status badge:", error);
      });
    }, 2000);
  } catch (error) {
    console.error("Could not show Owlet status in the extension badge:", error);
  }
}

async function report(
  tabId: number | undefined,
  frameId: number,
  message: string,
  success: boolean,
  itemId?: string
) {
  if (!(await injectFeedback(tabId, frameId, message, success, itemId))) {
    await showBadgeFallback(success);
  }
}

async function removePaint(tabId: number, frameId: number, paintId: string): Promise<void> {
  try {
    await chrome.scripting.executeScript({
      target: { tabId, frameIds: [frameId] },
      func: unpaintSelection,
      args: [paintId],
    });
  } catch (error) {
    console.error("Could not remove the Owlet highlight after a failed save:", error);
  }
}

// After a save, repaint the page from the saved highlights so a highlight made over an older one
// replaces it on screen (the newest highlight wins where they overlap). Purely visual; failures are ignored.
async function repaintSaved(tabId: number, frameId: number, itemId: string): Promise<void> {
  try {
    const response = await api(`/research/${encodeURIComponent(itemId)}/highlights`);
    if (!response.ok || !Array.isArray(response.data.highlights)) return;
    await chrome.scripting.executeScript({
      target: { tabId, frameIds: [frameId] },
      func: paintSavedHighlights,
      args: [response.data.highlights as { text: string; color: string }[], HIGHLIGHT_COLORS],
    });
  } catch (error) {
    console.error("Could not refresh the Owlet highlights on the page:", error);
  }
}

async function extractPage(tabId: number, frameId: number): Promise<SavedPage> {
  let page: SavedPage | undefined;
  try {
    await chrome.scripting.executeScript({
      target: { tabId, frameIds: [frameId] },
      files: ["content.js"],
    });
    page = (await chrome.tabs.sendMessage(tabId, { type: "OWLET_EXTRACT" }, { frameId })) as SavedPage | undefined;
  } catch (error) {
    console.error("Could not extract the page for the Owlet clip:", error);
    throw new SaveError("Couldn't read this page to clip it.");
  }
  if (!page || typeof page.rawText !== "string" || page.rawText.length < 50) {
    throw new SaveError("Not enough readable text on this page to clip it.");
  }
  return page;
}

export async function saveSelection(
  info?: chrome.contextMenus.OnClickData,
  tab?: chrome.tabs.Tab,
  colorOverride?: ColorName
): Promise<void> {
  const tabId = tab?.id;
  const frameId = info?.frameId ?? 0;
  const tabUrl = tab?.url ?? "";
  if (tabId === undefined) {
    await showBadgeFallback(false);
    return;
  }
  if (!/^https?:\/\//i.test(tabUrl)) {
    await report(tabId, frameId, "Owlet can only save selections from regular web pages.", false);
    return;
  }

  await withKeepAlive(async () => {
    let paintId: string | null = null;
    try {
      // Everything before the first network call is local, so the highlight shows up right away.
      if (!(await getToken())) throw new SaveError("Log in from the Owlet icon first");
      wake(); // start waking a sleeping server while we paint

      const color = colorOverride ?? (await selectedHighlightColor());

      // Read the selection and paint it in one step.
      let text = "";
      try {
        const [captured] = await chrome.scripting.executeScript({
          target: { tabId, frameIds: [frameId] },
          func: captureAndPaintSelection,
          args: [color, HIGHLIGHT_COLORS[color]],
        });
        const result = captured?.result as CaptureResult | undefined;
        text = result?.text ?? "";
        paintId = result?.paintId ?? null;
      } catch (error) {
        if (!info?.selectionText) throw error;
      }
      text = (text || info?.selectionText || "").replace(/\s+/g, " ").trim();
      if (!text) throw new SaveError("Select some text before saving a highlight.");
      if (text.length > 2000) throw new SaveError("Select no more than 2,000 characters.");

      await injectFeedback(tabId, frameId, "Saving…", true, undefined, true);

      const rawUrl = info?.frameUrl || tabUrl;
      let pageUrl: string;
      try {
        pageUrl = normalizePageUrl(rawUrl);
      } catch {
        throw new SaveError("Owlet can only save selections from regular web pages.");
      }
      if (pageUrl.length > 2000) throw new SaveError("This page URL is too long to save in Owlet.");

      const collectionId = await selectedCollectionId();
      const cacheKey = itemCacheKey(collectionId, pageUrl);
      let itemId: string | null = await getCachedItem(cacheKey);
      const wasCached = itemId !== null;

      if (!itemId) {
        // Read the page while the lookup request is in flight; thrown away if the page is already clipped.
        const extraction = extractPage(tabId, frameId).then(
          (page) => ({ page, error: undefined as unknown }),
          (error: unknown) => ({ page: undefined, error })
        );

        const query = new URLSearchParams({ url: pageUrl, collectionId });
        const found = await api(`/research/lookup?${query.toString()}`);
        if (!found.ok) throw new SaveError(messageForStatus(found.status), found.status);
        itemId = (found.data as LookupResult).id;

        if (!itemId) {
          const { page, error } = await extraction;
          if (!page) throw error;

          const stored = await chrome.storage.local.get("aiSettings");
          const aiSettings = stored.aiSettings as Record<string, unknown> | undefined;
          const validAiSettings =
            ["paragraph", "bullets", "academic", "simple"].includes(String(aiSettings?.format)) &&
            ["short", "medium", "detailed"].includes(String(aiSettings?.length)) &&
            typeof aiSettings?.instructions === "string";
          const clipped = await api("/research/clip", {
            method: "POST",
            body: {
              ...page,
              collectionId,
              ...(validAiSettings ? { aiSettings } : {}),
            },
          });
          if (clipped.status === 409 && typeof clipped.data.id === "string") {
            itemId = clipped.data.id;
          } else if (clipped.ok && typeof clipped.data.item?._id === "string") {
            itemId = clipped.data.item._id;
          } else {
            throw new SaveError(messageForStatus(clipped.status), clipped.status);
          }
        } else {
          void extraction; // already clipped: ignore the extraction result
        }
      }

      if (!itemId) throw new SaveError("Couldn't find the Owlet clip for this page.");
      const saved = await api(`/research/${encodeURIComponent(itemId)}/highlights`, {
        method: "POST",
        body: { text, color },
      });
      if (!saved.ok) {
        // The remembered item may have been deleted on the server; forget it so the next try re-checks.
        if (wasCached) await clearCachedItem(cacheKey);
        throw new SaveError(messageForStatus(saved.status), saved.status);
      }
      await setCachedItem(cacheKey, itemId);
      await report(tabId, frameId, "Saved to Owlet", true, itemId);
      await repaintSaved(tabId, frameId, itemId);
    } catch (error) {
      // The save failed, so take back the highlight we painted early.
      if (paintId) await removePaint(tabId, frameId, paintId);

      if (error instanceof SaveError) {
        if (error.status === 401) await clearToken();
        await report(tabId, frameId, error.message, false);
        return;
      }
      console.error("Could not save the selected text to Owlet:", error);
      const networkFailure =
        error instanceof TypeError ||
        (error instanceof DOMException && ["AbortError", "TimeoutError"].includes(error.name));
      await report(tabId, frameId, networkFailure ? "Can't reach Owlet" : "Couldn't save the selection to Owlet", false);
    }
  });
}

// ---------------------------------------------------------------------------------------------
// The functions below run inside the page via chrome.scripting.executeScript: each must be
// self-contained. Do not reference imports or module-level variables in here.
// ---------------------------------------------------------------------------------------------

// Reads the current selection and, if it is a valid highlight, paints it immediately.
export function captureAndPaintSelection(colorName: string, colorHex: string): CaptureResult {
  const selection = window.getSelection();
  const text = (selection?.toString() ?? "").replace(/\s+/g, " ").trim();
  if (!text || text.length > 2000 || !selection || selection.isCollapsed || selection.rangeCount === 0) {
    return { text, paintId: null };
  }

  const pageWindow = window as Window & {
    Highlight?: new (...ranges: Range[]) => object;
    CSS?: { highlights?: { get(name: string): Iterable<Range> | undefined; set(name: string, value: object): void } };
    __owletPaints?: Record<string, { name: string; ranges: Range[] }>;
  };
  if (!pageWindow.CSS?.highlights || !pageWindow.Highlight) return { text, paintId: null };

  try {
    const ranges: Range[] = [];
    for (let index = 0; index < selection.rangeCount; index += 1) ranges.push(selection.getRangeAt(index).cloneRange());

    const name = `owlet-${colorName}`;
    const registry = pageWindow.CSS.highlights;
    registry.set(name, new pageWindow.Highlight(...(registry.get(name) ?? []), ...ranges));

    const hasStyle = document.adoptedStyleSheets.some((sheet) => {
      try {
        return Array.from(sheet.cssRules).some((rule) => rule.cssText.includes(`::highlight(${name})`));
      } catch {
        return false;
      }
    });
    if (!hasStyle) {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(`::highlight(${name}) { background-color: ${colorHex}; }`);
      document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
    }

    const paintId = Math.random().toString(36).slice(2) + Date.now().toString(36);
    (pageWindow.__owletPaints ??= {})[paintId] = { name, ranges };
    return { text, paintId };
  } catch {
    // Painting is optional; the save and the toast still work.
    return { text, paintId: null };
  }
}

// Takes back a highlight painted by captureAndPaintSelection (used when the save fails).
export function unpaintSelection(paintId: string): void {
  const pageWindow = window as Window & {
    Highlight?: new (...ranges: Range[]) => object;
    CSS?: { highlights?: { get(name: string): Iterable<Range> | undefined; set(name: string, value: object): void } };
    __owletPaints?: Record<string, { name: string; ranges: Range[] }>;
  };
  const entry = pageWindow.__owletPaints?.[paintId];
  if (!entry || !pageWindow.CSS?.highlights || !pageWindow.Highlight) return;
  try {
    const registry = pageWindow.CSS.highlights;
    const keep = [...(registry.get(entry.name) ?? [])].filter((range) => !entry.ranges.includes(range));
    registry.set(entry.name, new pageWindow.Highlight(...keep));
  } catch {
    /* nothing to undo */
  }
  delete pageWindow.__owletPaints?.[paintId];
}

export function showSelectionFeedback(
  message: string,
  success: boolean,
  itemId: string,
  dashboardUrl: string,
  pending: boolean
): boolean {
  document.querySelector("[data-owlet-toast]")?.remove();
  const root = document.body ?? document.documentElement;
  if (!root) return false;

  const host = document.createElement("div");
  host.setAttribute("data-owlet-toast", "");
  host.setAttribute("role", "status");
  host.setAttribute("aria-live", "polite");
  host.style.cssText =
    "all:initial;position:fixed;top:16px;right:16px;z-index:2147483647;max-width:360px;";
  const shadow = host.attachShadow({ mode: "closed" });
  const box = document.createElement("div");
  box.style.cssText =
    `box-sizing:border-box;display:flex;align-items:center;gap:14px;padding:12px 16px;border-radius:10px;` +
    `background:${pending ? "#334155" : success ? "#102b5c" : "#991b1b"};color:#fff;font:600 14px/1.4 system-ui,sans-serif;` +
    "box-shadow:0 6px 24px rgba(0,0,0,.24);";
  const text = document.createElement("span");
  text.textContent = message;
  box.append(text);
  if (success && !pending && itemId) {
    const link = document.createElement("a");
    link.textContent = "View";
    link.href = `${dashboardUrl}/item/${encodeURIComponent(itemId)}`;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.style.cssText = "color:#a5f3fc;text-decoration:underline;white-space:nowrap;";
    box.append(link);
  }
  shadow.append(box);
  root.append(host);
  // A "Saving…" toast stays until the result replaces it (the long timeout is only a safety net).
  setTimeout(() => host.remove(), pending ? 180_000 : 4000);
  return true;
}