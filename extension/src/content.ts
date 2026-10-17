import { Readability } from "@mozilla/readability";

const w = window as Window & { __owletReady?: boolean };

if (!w.__owletReady) {
  w.__owletReady = true;

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type !== "OWLET_EXTRACT") return;

    const meta = (names: string[]) => {
      for (const n of names) {
        const el = document.querySelector<HTMLMetaElement>(`meta[name="${n}"], meta[property="${n}"]`);
        if (el?.content) return el.content.trim();
      }
      return undefined;
    };

    const clean = (s: string) => s.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
    const selection = window.getSelection()?.toString().trim() ?? "";
    const article = new Readability(document.cloneNode(true) as Document).parse();

    const author = (meta(["author", "article:author"]) || article?.byline || "").replace(/^by\s+/i, "").trim();
    const body = selection.length >= 50 ? selection : article?.textContent || document.body.innerText;

    sendResponse({
      url: location.href.split("#")[0],
      title: (article?.title || document.title || "Untitled").trim().slice(0, 500),
      author: author ? author.slice(0, 200) : undefined,
      publishedDate: meta(["article:published_time", "date", "pubdate"])?.slice(0, 100),
      rawText: clean(body).slice(0, 200000),
    });
  });
}