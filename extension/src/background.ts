import { saveSelection } from "./saveSelection";

const MENU_ID = "owlet-save-selection";

chrome.runtime.onInstalled.addListener(() => {
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
        }
      }
    );
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_ID) return;
  void saveSelection(info, tab);
});

chrome.commands.onCommand.addListener((command) => {
  if (command !== "save-selection") return;
  void chrome.tabs
    .query({ active: true, currentWindow: true })
    .then(([tab]) => saveSelection(undefined, tab))
    .catch((error) => console.error("Could not read the active tab for the Owlet shortcut:", error));
});
