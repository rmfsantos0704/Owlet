export type SharedClip = {
  title: string;
  highlight: string;   // the selected text, "" if only a link was shared
  sourceUrl: string;   // the page it came from
};

const URL_RE = /https?:\/\/\S+/gi;

export function parseShare(params: URLSearchParams): SharedClip {
  const title = params.get("title")?.trim() ?? "";
  const text = params.get("text")?.trim() ?? "";
  const urlParam = params.get("url")?.trim() ?? "";

  // Pull any URL out of `text`; whatever remains is the highlight.
  const found = text.match(URL_RE) ?? [];
  const highlight = text
    .replace(URL_RE, "")
    .replace(/^["“”']+|["“”']+$/g, "") // strip wrapping quotes some apps add
    .trim();

  const sourceUrl = urlParam || found[found.length - 1] || "";
  return { title, highlight, sourceUrl };
}