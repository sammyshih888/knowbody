import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { checkServerIdentity } from "node:tls";
import { isIP } from "node:net";
import ipaddr from "ipaddr.js";
import { loadBuffer } from "cheerio";
import type { FindingData, SourceData } from "../concepts/Researching.ts";

export interface PageResponse { status: number; headers: Record<string, string | undefined>; body: Buffer }
export interface PageIO {
  resolve(hostname: string): Promise<{ address: string; family: number }[]>;
  request(url: URL, address: string, family: number, signal: AbortSignal): Promise<PageResponse>;
}
const MAX_BYTES = 1024 * 1024;
const clean = (value: string) => value.replace(/\s+/g, " ").trim();
export function publicAddress(address: string): boolean {
  try { return ipaddr.process(address).range() === "unicast"; } catch { return false; }
}
export function permittedURL(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.port || !url.hostname.includes(".") ||
      isIP(url.hostname) || url.hostname.includes(":") || /(?:^|\.)(?:localhost|local|internal|test|invalid|example)$/.test(url.hostname) ||
      /(?:^|\.)example\.(?:com|net|org)$/.test(url.hostname)) throw new Error("Unavailable address");
  url.hash = "";
  return url;
}
const productionIO: PageIO = {
  resolve: hostname => lookup(hostname, { all: true, verbatim: true }),
  request: (url, address, family, signal) => new Promise((resolve, reject) => {
    // Connect to the vetted IP, while verifying TLS against the selected hostname.
    const req = request({ hostname: address, family, port: 443, path: url.pathname + url.search,
      servername: url.hostname, checkServerIdentity: (_, cert) => checkServerIdentity(url.hostname, cert),
      agent: false, signal, method: "GET", headers: { Host: url.hostname,
        "User-Agent": "Knowbody/0.1 (selected public page brief)", Accept: "text/html, application/xhtml+xml", "Accept-Encoding": "identity" },
    }, response => {
      const headers = Object.fromEntries(Object.entries(response.headers).map(([key, value]) => [key, Array.isArray(value) ? value.join(", ") : value]));
      const chunks: Buffer[] = [];
      let size = 0;
      response.on("error", reject);
      response.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_BYTES) { response.destroy(new Error("Page too large")); return; }
        chunks.push(chunk);
      });
      response.on("end", () => resolve({ status: response.statusCode ?? 0, headers, body: Buffer.concat(chunks) }));
    });
    req.on("error", reject);
    req.end();
  }),
};
function bounded<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason ?? new Error("Cancelled"));
    if (signal.aborted) { abort(); return; }
    signal.addEventListener("abort", abort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
  });
}
interface Extracted { source: SourceData; outgoing: string[] }
async function readPage(original: string, signal: AbortSignal, io: PageIO): Promise<Extracted> {
  const unavailable = (): Extracted => ({ source: { url: original, outcome: "UNAVAILABLE", title: null, excerpt: "",
    retrievedAt: new Date().toISOString(), pageDate: null, finalUrl: null, linksTo: [] }, outgoing: [] });
  const deadline = AbortSignal.any([signal, AbortSignal.timeout(12000)]);
  try {
    let url = permittedURL(original);
    const hostname = url.hostname;
    for (let redirects = 0; redirects <= 3; redirects++) {
      deadline.throwIfAborted();
      const addresses = await bounded(io.resolve(url.hostname), deadline);
      if (!addresses.length || addresses.some(row => !publicAddress(row.address))) return unavailable();
      const chosen = addresses.find(row => row.family === 4) ?? addresses[0]!;
      const response = await bounded(io.request(url, chosen.address, chosen.family, deadline), deadline);
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        if (!response.headers.location || redirects === 3) return unavailable();
        const next = permittedURL(new URL(response.headers.location, url).href);
        if (next.hostname !== hostname) return unavailable();
        url = next;
        continue;
      }
      if (response.status < 200 || response.status >= 300 || response.body.length > MAX_BYTES ||
          !/^(text\/html|application\/xhtml\+xml)(?:;|$)/i.test(response.headers["content-type"] ?? "") ||
          ![undefined, "identity"].includes(response.headers["content-encoding"])) return unavailable();
      const $ = loadBuffer(response.body);
      const title = clean($("title").first().text()).slice(0, 200) || null;
      const pageDate = clean($("meta[property='article:published_time'], meta[name='date'], meta[name='DC.date.issued']").first().attr("content") ??
        $("time[datetime]").first().attr("datetime") ?? "").slice(0, 80) || null;
      let linkBase = url;
      try { linkBase = new URL($("base[href]").first().attr("href") ?? url.href, url); } catch { /* Use the document URL for an invalid base. */ }
      const outgoing = $("a[href]").map((_, element) => {
        try { const target = new URL($(element).attr("href")!, linkBase); target.hash = ""; return target.href; } catch { return ""; }
      }).get().filter(Boolean);
      $("script,style,nav,footer,header,aside,form,noscript,iframe,svg,[hidden],[aria-hidden='true']").remove();
      const main = $("main,article,[role='main']").first();
      const content = main.length ? main : $("body");
      const paragraphs = content.find("p").map((_, element) => clean($(element).text())).get().filter(text => text.length >= 40);
      const text = paragraphs.length ? paragraphs.join("\n\n") : clean(content.text());
      if (text.length < 40) return unavailable();
      const excerpt = text.length > 800 ? text.slice(0, 799).trimEnd() + "…" : text;
      return { source: { url: original, outcome: "READABLE", title, excerpt, retrievedAt: new Date().toISOString(),
        pageDate, finalUrl: url.href, linksTo: [] }, outgoing };
    }
  } catch { /* Network, access, parse, and deadline failures have the same neutral outcome. */ }
  return unavailable();
}
export async function collectSources(urls: string[], signal: AbortSignal, io: PageIO = productionIO): Promise<{ sourceData: SourceData[]; findingData: FindingData[] }> {
  const pages = await Promise.all(urls.map(url => readPage(url, signal, io)));
  const readable = pages.filter(page => page.source.outcome === "READABLE");
  for (const page of readable) {
    page.source.linksTo = readable.filter(other => other !== page && page.outgoing.some(url => url === other.source.url || url === other.source.finalUrl)).map(other => other.source.url);
  }
  const findingData: FindingData[] = readable.flatMap(page => page.source.linksTo.map(to => ({ kind: "LINK" as const,
    sourceURLs: [page.source.url, to], explanation: "The first selected page contains a link to the second selected page." })));
  return { sourceData: pages.map(page => page.source), findingData };
}
