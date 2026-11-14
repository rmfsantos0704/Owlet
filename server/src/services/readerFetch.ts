import { FetchPageError, type FetchedPage } from "./safeFetch.js";

// Fallback for pages Owlet's own download can't read. A hosted "reader" opens the page in a real browser
// (running its JavaScript, from its own network address) and hands back the finished HTML, which then goes
// through the same extraction as any other page.
//
// This sends the page's address to a third party (Jina Reader by default). Turn it off with READER_FALLBACK=off.
//   READER_FALLBACK          "off" / "0" / "false" disables it (on by default)
//   READER_API_KEY           optional; keyed requests get a higher rate limit than anonymous ones
//   READER_BASE_URL          default https://r.jina.ai/
//   READER_TIMEOUT_SECONDS   default 25 (5 to 60)

const BASE = (process.env.READER_BASE_URL?.trim() || "https://r.jina.ai/").replace(/\/*$/, "/");
const MAX_BYTES = 3 * 1024 * 1024; // of page source, same cap as the direct download

export function readerEnabled(): boolean {
  return !/^(0|false|off|no)$/i.test((process.env.READER_FALLBACK ?? "on").trim());
}

function timeoutSeconds(): number {
  const n = Number(process.env.READER_TIMEOUT_SECONDS);
  return Number.isFinite(n) && n >= 5 ? Math.min(n, 60) : 25;
}

async function readCapped(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) {
    const text = await res.text();
    if (text.length > MAX_BYTES) throw new FetchPageError("That page is too large to save.", "TOO_LARGE");
    return text;
  }
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) {
      await reader.cancel();
      throw new FetchPageError("That page is too large to save.", "TOO_LARGE");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export async function fetchViaReader(rawUrl: string): Promise<FetchedPage> {
  const target = new URL(rawUrl);
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    throw new FetchPageError("Only http and https links can be saved.", "BAD_URL");
  }
  target.hash = ""; // fragments (including Chrome's #:~:text=) never leave this server

  const seconds = timeoutSeconds();
  const key = process.env.READER_API_KEY?.trim();

  let res: Response;
  try {
    res = await fetch(BASE + target.toString(), {
      method: "GET",
      signal: AbortSignal.timeout(seconds * 1000),
      headers: {
        Accept: "text/html",
        // ask for the rendered page's HTML (the second name is the newer spelling of the same header)
        "x-respond-with": "html",
        "X-Return-Format": "html",
        // how long the reader waits for the page to finish loading; our own timeout is a little longer
        "x-timeout": String(Math.max(5, seconds - 5)),
        ...(key ? { Authorization: `Bearer ${key}` } : {}),
      },
    });
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new FetchPageError("The reader service took too long.", "TIMEOUT");
    }
    throw new FetchPageError("Couldn't reach the reader service.", "NETWORK");
  }

  if (!res.ok) {
    await res.body?.cancel().catch(() => {});
    throw new FetchPageError(`The reader service answered with an error (${res.status}).`, "HTTP", res.status);
  }
  if (/application\/json/i.test(res.headers.get("content-type") ?? "")) {
    await res.body?.cancel().catch(() => {});
    throw new FetchPageError("The reader service sent an unexpected answer.", "NETWORK");
  }

  let html: string;
  try {
    html = await readCapped(res);
  } catch (error) {
    if (error instanceof FetchPageError) throw error;
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new FetchPageError("The reader service took too long.", "TIMEOUT");
    }
    throw new FetchPageError("Couldn't read the reader service's answer.", "NETWORK");
  }
  return { html, finalUrl: target.toString() };
}