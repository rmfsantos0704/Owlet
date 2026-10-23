// A one-time message to show on the login page after being signed out (e.g. "Your account was deleted").
const KEY = "owlet.loginNotice";
export const setLoginNotice = (message: string) => sessionStorage.setItem(KEY, message);
export const peekLoginNotice = () => sessionStorage.getItem(KEY) ?? undefined;
export const clearLoginNotice = () => sessionStorage.removeItem(KEY);