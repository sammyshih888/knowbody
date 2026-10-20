import { load } from "cheerio";
import { permittedURL } from "./research/pages.ts";

export interface SearchResult { url: string; title: string; snippet: string }
export type SearchResponse = { results: SearchResult[] } | { error: "SEARCH_UNAVAILABLE" | "SEARCH_LIMIT" };
type SearchFetch = (url: string, init: RequestInit) => Promise<Response>;
const plain = (value: string, length: number) => load(value).text().replace(/\s+/g, " ").trim().slice(0, length);

// Discovery suggests candidates only. It never saves cards or starts a source brief.
export async function searchPages(query: string, signal: AbortSignal, apiKey = process.env.TAVILY_API_KEY,
  request: SearchFetch = fetch): Promise<SearchResponse> {
  if (!apiKey) return { error: "SEARCH_UNAVAILABLE" };
  try {
    const response = await request("https://api.tavily.com/search", {
      method: "POST", redirect: "error", signal: AbortSignal.any([signal, AbortSignal.timeout(6000)]),
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ query, search_depth: "basic", auto_parameters: false, max_results: 5,
        include_answer: false, include_raw_content: false, include_images: false, safe_search: true }),
    });
    if ([429, 432, 433].includes(response.status)) return { error: "SEARCH_LIMIT" };
    if (!response.ok) return { error: "SEARCH_UNAVAILABLE" };
    const data = await response.json() as { results?: unknown };
    if (!Array.isArray(data.results)) return { error: "SEARCH_UNAVAILABLE" };
    const results: SearchResult[] = [];
    for (const row of data.results.slice(0, 20)) {
      if (!row || typeof row.url !== "string" || row.url.length > 2048 || typeof row.title !== "string" || typeof row.content !== "string") continue;
      try {
        const url = permittedURL(row.url).href;
        if (!results.some(result => result.url === url)) results.push({ url, title: plain(row.title, 200) || url, snippet: plain(row.content, 400) });
      } catch { /* A candidate must be a public HTTPS URL that can be selected. */ }
      if (results.length === 5) break;
    }
    return { results };
  } catch { return { error: "SEARCH_UNAVAILABLE" }; }
}
