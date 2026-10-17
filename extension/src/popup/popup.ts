import { api, getToken, setToken, clearToken } from "../api";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

function msg(text: string, error = false) {
  const el = $("msg");
  el.textContent = text;
  el.style.color = error ? "#b00020" : "#1b5e20";
}

async function render() {
  const loggedIn = !!(await getToken());
  $("login").classList.toggle("hidden", loggedIn);
  $("clipper").classList.toggle("hidden", !loggedIn);
}

$("loginBtn").addEventListener("click", async () => {
  const email = $<HTMLInputElement>("email").value.trim();
  const password = $<HTMLInputElement>("password").value;
  const r = await api("/auth/login", { method: "POST", body: { email, password } });
  if (!r.ok) return msg(r.data.error ?? "Login failed", true);
  await setToken(r.data.token);
  msg("");
  render();
});

$("logoutBtn").addEventListener("click", async () => {
  await clearToken();
  msg("");
  render();
});

$("clipBtn").addEventListener("click", async () => {
  msg("Clipping…");
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return msg("No active tab", true);

    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
    const page = await chrome.tabs.sendMessage(tab.id, { type: "OWLET_EXTRACT" });
    if (!page || page.rawText.length < 50) return msg("Not enough text on this page", true);

    const r = await api("/research/clip", { method: "POST", body: page });
    if (r.status === 401) {
      await clearToken();
      render();
      return msg("Session expired, log in again", true);
    }
    if (r.status === 409) return msg("Already clipped", true);
    if (!r.ok) return msg(r.data.error ?? "Clip failed", true);
    msg(r.data.aiFailed ? "Saved (AI summary failed)" : "Saved with AI summary ✓");
  } catch {
    msg("Can't clip this page. Try a normal website.", true);
  }
});

render();