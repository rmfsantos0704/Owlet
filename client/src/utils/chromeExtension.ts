const value = import.meta.env.VITE_CHROME_EXTENSION_URL;

export const chromeExtensionUrl = (() => {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
})();
