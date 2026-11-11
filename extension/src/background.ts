import { saveSelection } from "./saveSelection";
import { HIGHLIGHT_COLORS } from "./highlightColors";
import { wake } from "./api";

const MENU_ID = "owlet-save-selection";
const COLOR_PREFIX = `${MENU_ID}:`;

type ColorName = keyof typeof HIGHLIGHT_COLORS;
const isColorName = (value: string): value is ColorName => value in HIGHLIGHT_COLORS;

// Chrome context menus can't show real colors, so each item gets the closest emoji.
const MENU_EMOJI: Record<ColorName, string> = {
  yellow: "🟨",
  orange: "🟧",
  red: "🟥",
  pink: "💗",
  purple: "🟪",
  blue: "🟦",
  teal: "🔹",
  green: "🟩",
  lime: "🍏",
  cyan: "💠",
  indigo: "🔷",
  fuchsia: "🌺",
  gray: "⚪",
};

function createColorItems() {
  for (const name of Object.keys(HIGHLIGHT_COLORS) as ColorName[]) {
    chrome.contextMenus.create(
      {
        id: `${COLOR_PREFIX}${name}`,
        parentId: MENU_ID,
        title: `${MENU_EMOJI[name]}  ${name[0].toUpperCase() + name.slice(1)}`,
        contexts: ["selection"],
      },
      () => {
        if (chrome.runtime.lastError) {
          console.error(`Could not register the Owlet ${name} menu item:`, chrome.runtime.lastError.message);
        }
      }
    );
  }
}

chrome.runtime.onInstalled.addListener(() => {
  wake();
  chrome.contextMenus.removeAll(() => {
    if (chrome.runtime.lastError) {
      console.error("Could not clear the Owlet selection menu:", chrome.runtime.lastError.message);
      return;
    }
    chrome.contextMenus.create(
      {
        id: MENU_ID,
        title: "Save selection to Owlet",
        contexts: ["selection"],
      },
      () => {
        if (chrome.runtime.lastError) {
          console.error("Could not register the Owlet selection menu:", chrome.runtime.lastError.message);
          return;
        }
        createColorItems();
      }
    );
  });
});

// Browser just started: wake the free-tier server before the first highlight.
chrome.runtime.onStartup.addListener(() => {
  wake();
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const id = String(info.menuItemId);
  if (!id.startsWith(COLOR_PREFIX)) return; // the parent item has children, so clicking it does nothing
  const color = id.slice(COLOR_PREFIX.length);
  if (!isColorName(color)) return;
  void saveSelection(info, tab, color);
});

chrome.commands.onCommand.addListener((command) => {
  if (command !== "save-selection") return;
  void chrome.tabs
    .query({ active: true, currentWindow: true })
    .then(([tab]) => saveSelection(undefined, tab))
    .catch((error) => console.error("Could not read the active tab for the Owlet shortcut:", error));
});