export function normalizePageUrl(rawUrl: string): string {
  const url = new URL(rawUrl);
  for (const key of [...url.searchParams.keys()]) {
    const name = key.toLowerCase();
    if (
      name.startsWith("utm_") ||
      ["fbclid", "gclid", "dclid", "msclkid", "mc_cid", "mc_eid", "igshid", "ref_src", "vero_id", "_ga"].includes(name)
    ) {
      url.searchParams.delete(key);
    }
  }
  url.searchParams.sort();
  url.hash = "";
  return url.toString();
}
