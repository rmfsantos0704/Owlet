import { api, clearToken, DASHBOARD_URL, getToken, wake } from "./api";
import { HIGHLIGHT_COLORS } from "./highlightColors";
import { normalizePageUrl } from "./pageUrl";

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

async function injectFeedback(
  tabId: number | undefined,
  frameId: number,
  message: string,
  success: boolean,
  itemId?: string
): Promise<boolean> {
  if (tabId === undefined) return false;
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId, frameIds: [frameId] },
      func: showSelectionFeedback,
      args: [message, success, itemId ?? "", DASHBOARD_URL, HIGHLIGHT_COLORS.yellow],
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

export async function saveSelection(info?: chrome.contextMenus.OnClickData, tab?: chrome.tabs.Tab): Promise<void> {
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
    try {
      let selectedText = "";
      try {
        const [selection] = await chrome.scripting.executeScript({
          target: { tabId, frameIds: [frameId] },
          func: () => window.getSelection()?.toString() ?? "",
        });
        selectedText = typeof selection?.result === "string" ? selection.result : "";
      } catch (error) {
        if (!info?.selectionText) throw error;
      }
      const text = (selectedText || info?.selectionText || "").replace(/\s+/g, " ").trim();
      if (!text) throw new SaveError("Select some text before saving a highlight.");
      if (text.length > 2000) throw new SaveError("Select no more than 2,000 characters.");

      if (!(await getToken())) throw new SaveError("Log in from the Owlet icon first");
      wake();

      const rawUrl = info?.frameUrl || tabUrl;
      let pageUrl: string;
      try {
        pageUrl = normalizePageUrl(rawUrl);
      } catch {
        throw new SaveError("Owlet can only save selections from regular web pages.");
      }
      if (pageUrl.length > 2000) throw new SaveError("This page URL is too long to save in Owlet.");
      const collectionId = await selectedCollectionId();
      const query = new URLSearchParams({ url: pageUrl, collectionId });
      const found = await api(`/research/lookup?${query.toString()}`);
      if (!found.ok) throw new SaveError(messageForStatus(found.status), found.status);

      let itemId = (found.data as LookupResult).id;
      if (!itemId) {
        let page: SavedPage | undefined;
        try {
          await chrome.scripting.executeScript({
            target: { tabId, frameIds: [frameId] },
            files: ["content.js"],
          });
          page = (await chrome.tabs.sendMessage(tabId, { type: "OWLET_EXTRACT" }, { frameId })) as
            | SavedPage
            | undefined;
        } catch (error) {
          console.error("Could not extract the page for the Owlet clip:", error);
          throw new SaveError("Couldn't read this page to clip it.");
        }
        if (!page || typeof page.rawText !== "string" || page.rawText.length < 50) {
          throw new SaveError("Not enough readable text on this page to clip it.");
        }

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
      }

      if (!itemId) throw new SaveError("Couldn't find the Owlet clip for this page.");
      const saved = await api(`/research/${encodeURIComponent(itemId)}/highlights`, {
        method: "POST",
        body: { text, color: "yellow" },
      });
      if (!saved.ok) throw new SaveError(messageForStatus(saved.status), saved.status);
      await report(tabId, frameId, "Saved to Owlet", true, itemId);
    } catch (error) {
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

export function showSelectionFeedback(
  message: string,
  success: boolean,
  itemId: string,
  dashboardUrl: string,
  yellowColor: string
): boolean {
  if (success) {
    const pageWindow = window as Window & {
      Highlight?: new (...ranges: Range[]) => object;
      CSS?: { highlights?: { get(name: string): Iterable<Range> | undefined; set(name: string, value: object): void } };
    };
    const selection = window.getSelection();
    const ranges: Range[] = [];
    if (selection && !selection.isCollapsed && selection.rangeCount > 0) {
      for (let index = 0; index < selection.rangeCount; index += 1) ranges.push(selection.getRangeAt(index).cloneRange());
    }
    if (ranges.length && pageWindow.CSS?.highlights && pageWindow.Highlight) {
      try {
        const registry = pageWindow.CSS.highlights;
        const previous = registry.get("owlet-yellow");
        const combined = [...(previous ?? []), ...ranges];
        registry.set("owlet-yellow", new pageWindow.Highlight(...combined));

        const hasStyle = document.adoptedStyleSheets.some((sheet) => {
          try {
            return Array.from(sheet.cssRules).some((rule) => rule.cssText.includes("::highlight(owlet-yellow)"));
          } catch {
            return false;
          }
        });
        if (!hasStyle) {
          const sheet = new CSSStyleSheet();
          sheet.replaceSync(`::highlight(owlet-yellow) { background-color: ${yellowColor}; }`);
          document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
        }
      } catch {
        // Painting is optional; the saved highlight and toast still work.
      }
    }
  }

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
    `background:${success ? "#102b5c" : "#991b1b"};color:#fff;font:600 14px/1.4 system-ui,sans-serif;` +
    "box-shadow:0 6px 24px rgba(0,0,0,.24);";
  const text = document.createElement("span");
  text.textContent = message;
  box.append(text);
  if (success && itemId) {
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
  setTimeout(() => host.remove(), 4000);
  return true;
}
