// Where the extension opens when its toolbar icon is clicked: the small popup (default) or Chrome's side panel.
// The choice lives in chrome.storage.local so the popup, the side panel and the service worker all agree.
export type OpenMode = "popup" | "panel";
export const OPEN_MODE_KEY = "openMode";

export async function getOpenMode(): Promise<OpenMode> {
  const { [OPEN_MODE_KEY]: mode } = await chrome.storage.local.get(OPEN_MODE_KEY);
  return mode === "panel" ? "panel" : "popup";
}

// Points the toolbar icon at the popup or the side panel. Safe to call as often as you like.
export async function applyOpenMode(mode?: OpenMode): Promise<void> {
  const current = mode ?? (await getOpenMode());
  // the side panel shows the same page as the popup, with ?panel=1 so it can lay itself out full width
  const popupPath = chrome.runtime.getManifest().action?.default_popup ?? "popup.html";
  try {
    await chrome.sidePanel.setOptions({ path: `${popupPath}?panel=1`, enabled: true });
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: current === "panel" });
    // an empty popup makes the icon open the side panel instead
    await chrome.action.setPopup({ popup: current === "panel" ? "" : popupPath });
  } catch (error) {
    console.error("Could not set where the Owlet extension opens:", error);
  }
}