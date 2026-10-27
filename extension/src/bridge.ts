// Content script for the Owlet dashboard. Keeps the dashboard's login and the extension's login in step:
// log in (or out) on one and the other follows.
//
// Each side keeps a "last changed" stamp next to its token, so when they disagree the newer change wins.
// The stamp also lets a logout win over an old token that is still sitting on the other side.

const TOKEN = "token"; // the dashboard's localStorage key (see services/api.ts)
const PAGE_STAMP = "owlet.tokenAt"; // written by this script, in the dashboard's localStorage
const RELOADS = "owlet.bridgeReloads"; // loop guard, in sessionStorage
const JWT = /^[\w-]+\.[\w-]+\.[\w-]+$/;

const clean = (t: unknown) => (typeof t === "string" && JWT.test(t) ? t : null);

function pageToken(): string | null {
  try {
    return clean(localStorage.getItem(TOKEN));
  } catch {
    return null;
  }
}
function pageStamp(): number {
  try {
    return Number(localStorage.getItem(PAGE_STAMP)) || 0;
  } catch {
    return 0;
  }
}
function writePage(token: string | null, at: number) {
  try {
    if (token) localStorage.setItem(TOKEN, token);
    else localStorage.removeItem(TOKEN);
    localStorage.setItem(PAGE_STAMP, String(at));
  } catch {
    /* storage blocked */
  }
}

async function readExt() {
  const { token, tokenAt } = await chrome.storage.local.get(["token", "tokenAt"]);
  return { token: clean(token), at: typeof tokenAt === "number" ? tokenAt : 0 };
}
async function writeExt(token: string | null, at: number) {
  if (token) {
    await chrome.storage.local.set({ token, tokenAt: at });
  } else {
    await chrome.storage.local.set({ tokenAt: at }); // stamp first, so listeners see it when the token goes
    await chrome.storage.local.remove("token");
  }
}

// The page has to reload to notice a token that changed behind its back. Never more than 3 times in 15 s.
function reloadPage() {
  try {
    const now = Date.now();
    const recent = (JSON.parse(sessionStorage.getItem(RELOADS) ?? "[]") as number[]).filter((t) => now - t < 15_000);
    if (recent.length >= 3) return;
    sessionStorage.setItem(RELOADS, JSON.stringify([...recent, now]));
  } catch {
    /* no sessionStorage: reload anyway, the tokens will match next time */
  }
  location.reload();
}

let lastPage: string | null = pageToken();

// the dashboard logged in, logged out, or dropped an expired token
function onPageChange(token: string | null) {
  if (token === lastPage) return;
  lastPage = token;
  const at = Date.now();
  writePage(token, at);
  void writeExt(token, at);
}

// 1. When the dashboard opens: if the two sides disagree, the newer change wins.
async function initialSync() {
  const ext = await readExt();
  const page = pageToken();
  const at = pageStamp();
  if (page === ext.token) return;

  const pageWins = at !== ext.at ? at > ext.at : page !== null; // tie: whoever holds a token, the page first
  if (pageWins) {
    await writeExt(page, at || Date.now());
  } else {
    lastPage = ext.token;
    writePage(ext.token, ext.at || Date.now());
    reloadPage();
  }
}

// 2. Live changes made on the dashboard (announced by pageHook.ts).
window.addEventListener("message", (e) => {
  if (e.source !== window || e.origin !== location.origin || e.data?.owletBridge !== true) return;
  onPageChange(clean(e.data.token));
});
// backup for anything the hook can't see
setInterval(() => onPageChange(pageToken()), 2000);

// 3. Live changes made in the extension (login or logout in the popup).
chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area !== "local" || !changes.token) return;
  const next = clean(changes.token.newValue);
  if (next === pageToken()) {
    lastPage = next; // this was the dashboard's own change coming back
    return;
  }
  const { tokenAt } = await chrome.storage.local.get("tokenAt");
  lastPage = next;
  writePage(next, typeof tokenAt === "number" ? tokenAt : Date.now());
  reloadPage();
});

void initialSync();
