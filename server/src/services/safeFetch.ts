import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import zlib from "node:zlib";
import type { Readable } from "node:stream";

// Downloads a web page for the "save a link" feature. This is a server fetching an address a user typed,
// so it must never be able to reach the server's own network: private and internal addresses are refused,
// on the first request, on every redirect, and again at connection time (so a hostname can't switch to an
// internal address after it was checked).

export type FetchFailure = "BAD_URL" | "BLOCKED" | "TIMEOUT" | "TOO_LARGE" | "HTTP" | "NOT_HTML" | "PDF" | "NETWORK";

export class FetchPageError extends Error {
  constructor(message: string, readonly code: FetchFailure, readonly status?: number) {
    super(message);
    this.name = "FetchPageError";
  }
}

const MAX_BYTES = 3 * 1024 * 1024; // of page source, after decompression
const TOTAL_MS = 8000; // for the whole download, redirects included
const MAX_REDIRECTS = 4;
const USER_AGENT = "Mozilla/5.0 (compatible; OwletBot/1.0; reading a page a user asked to save)";

// addresses a public website can never have
const blocked = new net.BlockList();
for (const [address, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12],
  ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24],
  ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) {
  blocked.addSubnet(address, prefix, "ipv4");
}
for (const [address, prefix] of [
  ["::", 128], ["::1", 128], ["64:ff9b::", 96], ["100::", 64], ["2001:db8::", 32], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8],
] as const) {
  blocked.addSubnet(address, prefix, "ipv6");
}

function isPublicAddress(address: string): boolean {
  let ip = address;
  let family = net.isIP(ip);
  if (!family) return false;
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip); // an IPv4 address written as IPv6
  if (mapped) {
    ip = mapped[1];
    family = 4;
  } else if (/^::ffff:/i.test(ip)) {
    return false; // the other spelling of the same thing: refuse
  }
  return !blocked.check(ip, family === 4 ? "ipv4" : "ipv6");
}

// used while connecting: the address the hostname resolves to right now must be public
function safeLookup(hostname: string, options: any, callback: any) {
  dns.lookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) return callback(error);
    // `all: true` always yields an array at runtime, but the overloads can't be resolved
    // through the spread of an `any` options object, so go through `unknown`.
    const list = addresses as unknown as dns.LookupAddress[];
    if (!list.length || list.some((a) => !isPublicAddress(a.address))) {
      return callback(new FetchPageError("That address isn't allowed.", "BLOCKED"));
    }
    if (options?.all) return callback(null, list);
    callback(null, list[0].address, list[0].family);
  });
}

function parseUrl(raw: string): URL {
  try {
    return new URL(raw);
  } catch {
    throw new FetchPageError("That doesn't look like a web address.", "BAD_URL");
  }
}

function assertAllowed(url: URL) {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new FetchPageError("Only http and https links can be saved.", "BAD_URL");
  }
  if (url.username || url.password) throw new FetchPageError("Links with a username or password can't be saved.", "BAD_URL");
  if (url.port && url.port !== "80" && url.port !== "443") throw new FetchPageError("Owlet can't open that address.", "BLOCKED");
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new FetchPageError("Owlet can't open that address.", "BLOCKED");
  }
  if (net.isIP(host) && !isPublicAddress(host)) throw new FetchPageError("Owlet can't open that address.", "BLOCKED");
}

type Response = { status: number; location?: string; contentType: string; body: Buffer };

function requestOnce(url: URL, ms: number): Promise<Response> {
  return new Promise((resolve, reject) => {
    const lib = url.protocol === "https:" ? https : http;
    let finished = false;
    const done = (fn: () => void) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      fn();
    };
    const request = lib.request(
      url,
      {
        method: "GET",
        lookup: safeLookup as any,
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
          "Accept-Language": "en;q=0.9,*;q=0.5",
          "Accept-Encoding": "gzip, deflate, br",
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const contentType = String(res.headers["content-type"] ?? "");
        if (status >= 300 && status < 400) {
          res.resume();
          return done(() => resolve({ status, location: res.headers.location, contentType, body: Buffer.alloc(0) }));
        }
        if (status < 200 || status >= 300) {
          res.resume();
          return done(() => resolve({ status, contentType, body: Buffer.alloc(0) }));
        }
        if (/application\/pdf/i.test(contentType)) {
          res.resume();
          return done(() => reject(new FetchPageError("That link is a PDF.", "PDF")));
        }
        if (contentType && !/text\/html|application\/xhtml\+xml/i.test(contentType)) {
          res.resume();
          return done(() => reject(new FetchPageError("That link isn't a web page.", "NOT_HTML")));
        }

        const encoding = String(res.headers["content-encoding"] ?? "").toLowerCase();
        let stream: Readable = res;
        if (encoding === "gzip" || encoding === "x-gzip") stream = res.pipe(zlib.createGunzip());
        else if (encoding === "deflate") stream = res.pipe(zlib.createInflate());
        else if (encoding === "br") stream = res.pipe(zlib.createBrotliDecompress());

        const chunks: Buffer[] = [];
        let size = 0;
        stream.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_BYTES) {
            request.destroy();
            return done(() => reject(new FetchPageError("That page is too large to save.", "TOO_LARGE")));
          }
          chunks.push(chunk);
        });
        stream.on("end", () => done(() => resolve({ status, contentType, body: Buffer.concat(chunks) })));
        stream.on("error", () => done(() => reject(new FetchPageError("Owlet couldn't read that page.", "NETWORK"))));
      }
    );
    const timer = setTimeout(() => {
      request.destroy();
      done(() => reject(new FetchPageError("That page took too long to load.", "TIMEOUT")));
    }, ms);
    request.on("error", (error) => {
      done(() =>
        reject(
          error instanceof FetchPageError
            ? error
            : new FetchPageError("Owlet couldn't reach that site.", "NETWORK")
        )
      );
    });
    request.end();
  });
}

function httpError(status: number): FetchPageError {
  if (status === 401 || status === 403 || status === 429) {
    return new FetchPageError("That site wouldn't let Owlet read the page. It may need a login or block automatic readers.", "HTTP", status);
  }
  if (status === 404 || status === 410) return new FetchPageError("That page wasn't found.", "HTTP", status);
  return new FetchPageError(`The site answered with an error (${status}).`, "HTTP", status);
}

function decode(body: Buffer, contentType: string): string {
  let label = /charset=["']?([^;\s"']+)/i.exec(contentType)?.[1];
  if (!label) label = /<meta[^>]+charset=["']?([\w-]+)/i.exec(body.subarray(0, 4096).toString("latin1"))?.[1];
  try {
    return new TextDecoder(label ?? "utf-8").decode(body);
  } catch {
    return body.toString("utf8");
  }
}

export type FetchedPage = { html: string; finalUrl: string };

export async function fetchPage(rawUrl: string): Promise<FetchedPage> {
  const deadline = Date.now() + TOTAL_MS;
  let url = parseUrl(rawUrl.trim());
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    assertAllowed(url);
    const left = deadline - Date.now();
    if (left <= 0) throw new FetchPageError("That page took too long to load.", "TIMEOUT");
    const r = await requestOnce(url, left);
    if (r.status >= 300 && r.status < 400 && r.location) {
      url = parseUrl(new URL(r.location, url).toString());
      continue;
    }
    if (r.status < 200 || r.status >= 300) throw httpError(r.status);
    return { html: decode(r.body, r.contentType), finalUrl: url.toString() };
  }
  throw new FetchPageError("That link redirected too many times.", "HTTP");
}