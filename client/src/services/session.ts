const TOKEN_KEY = "token";
const PAGE_STAMP_KEY = "owlet.tokenAt";

export function setSessionToken(token: string) {
  localStorage.setItem(PAGE_STAMP_KEY, String(Date.now()));
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearSessionToken() {
  localStorage.setItem(PAGE_STAMP_KEY, String(Date.now()));
  localStorage.removeItem(TOKEN_KEY);
}
