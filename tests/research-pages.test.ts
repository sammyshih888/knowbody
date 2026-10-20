import { expect, test } from "bun:test";
import { collectSources, permittedURL, publicAddress, type PageIO, type PageResponse } from "../src/research/pages.ts";
const a = "https://www.mit.edu/about", b = "https://www.mit.edu/research";
const html = (body: string): PageResponse => ({ status: 200, headers: { "content-type": "text/html; charset=utf-8" }, body: Buffer.from(body) });
const paragraph = "This is a selected public page with enough useful text for a source excerpt. ";
function fixture(responses: Record<string, PageResponse>, addresses = ["93.184.216.34"]) {
  const calls: string[] = [];
  const io: PageIO = { resolve: async () => addresses.map(address => ({ address, family: 4 })), request: async url => {
    calls.push(url.href); return responses[url.href] ?? { status: 404, headers: {}, body: Buffer.alloc(0) };
  } };
  return { io, calls };
}
test("source dates reject placeholders and invalid calendars, and never substitute retrieval time", async () => {
  for (const value of ["0001-01-01", "2025-02-30", "2025-13-01", "yesterday", "", "2025"]) {
    const { io } = fixture({ [a]: html(`<meta name="date" content="${value}"><main><p>${paragraph}</p></main><footer><time datetime="2025-01-01">Copyright</time></footer>`) });
    const source = (await collectSources([a], new AbortController().signal, io)).sourceData[0]!;
    expect(source.pageDate).toBeNull();
    expect(source.outcome).toBe("READABLE");
    expect(Number.isFinite(Date.parse(source.retrievedAt))).toBe(true);
  }
  const { io } = fixture({ [a]: html(`<meta name="date" content="0001-01-01"><main><time datetime="2024-02-29T10:30:00Z">Published February 29</time><p>${paragraph}</p></main>`) });
  expect((await collectSources([a], new AbortController().signal, io)).sourceData[0]?.pageDate).toBe("2024-02-29");
});
test("source excerpts strip executable text and cite only direct links between selected readable pages", async () => {
  const { io, calls } = fixture({ [a]: html(`<title>About &amp; people</title><meta property="article:published_time" content="2025-01-01"><main><p>${paragraph}</p><script>steal secrets</script><a href="/research#topic">Research</a><a href="https://elsewhere.org/">unselected</a></main>`), [b]: html(`<p>${paragraph}</p>`) });
  const result = await collectSources([a,b], new AbortController().signal, io);
  expect(calls.sort()).toEqual([a,b]);
  expect(result.sourceData[0]).toMatchObject({ title: "About & people", excerpt: paragraph.trim(), pageDate: "2025-01-01", linksTo: [b], outcome: "READABLE" });
  expect(result.findingData.filter(finding => finding.kind === "LINK")).toEqual([{ kind: "LINK", sourceURLs: [a,b], explanation: "The first selected page contains a link to the second selected page." }]);
});
test("same-host redirects retain provenance; other hosts, protocols, credentials, and ports are never fetched", async () => {
  const { io, calls } = fixture({ [a]: { status: 302, headers: { location: "/about-us" }, body: Buffer.alloc(0) }, "https://www.mit.edu/about-us": html(`<p>${paragraph}</p>`) });
  expect((await collectSources([a], new AbortController().signal, io)).sourceData[0]).toMatchObject({ url: a, finalUrl: "https://www.mit.edu/about-us", outcome: "READABLE" });
  expect(calls).toHaveLength(2);
  for (const location of ["https://other.mit.edu/", "http://www.mit.edu/", "https://me:secret@www.mit.edu/", "https://www.mit.edu:8443/"]) {
    const blocked = fixture({ [a]: { status: 302, headers: { location }, body: Buffer.alloc(0) } });
    expect((await collectSources([a], new AbortController().signal, blocked.io)).sourceData[0]?.outcome).toBe("UNAVAILABLE");
    expect(blocked.calls).toEqual([a]);
  }
});
test("selected URLs resolving to the same page are not treated as independent comparisons", async () => {
  const { io } = fixture({ [a]: { status: 302, headers: { location: b }, body: Buffer.alloc(0) },
    [b]: html(`<p>${paragraph}</p><a href="${a}">About</a>`) });
  const result = await collectSources([a, b], new AbortController().signal, io);
  expect(result.sourceData.map(source => source.finalUrl)).toEqual([b, b]);
  expect(result.sourceData.every(source => source.outcome === "READABLE")).toBe(true);
  expect(result.findingData).toEqual([]);
});
test("a document base changes relative link targets without fetching that base or unselected pages", async () => {
  const { io, calls } = fixture({ [a]: html(`<base href="https://elsewhere.org/"><p>${paragraph}</p><a href="/research">Research</a>`), [b]: html(`<p>${paragraph}</p>`) });
  const result = await collectSources([a,b], new AbortController().signal, io);
  expect(result.findingData.filter(finding => finding.kind === "LINK")).toEqual([]);
  expect(calls.sort()).toEqual([a,b]);
});
test("matching wording preserves case and punctuation and requires a substantial exact excerpt", async () => {
  const { io, calls } = fixture({ [a]: html(`<nav><p>${paragraph}</p></nav><main><p>I share a small introduction before the matching passage below.</p><p>${paragraph}</p></main>`),
    [b]: html(`<main><p>${paragraph.replaceAll(" ", "\n   ")}</p></main>`) });
  const result = await collectSources([a, b], new AbortController().signal, io);
  expect(result.findingData.filter(finding => finding.kind === "SAME_TEXT")).toMatchObject([
    { sourceURLs: [a, b], quotes: [paragraph.trim(), paragraph.trim()] },
  ]);
  expect(calls.sort()).toEqual([a, b]);
  for (const changed of [paragraph.toUpperCase(), paragraph.replace(".", "!"), "A short quote."]) {
    const different = fixture({ [a]: html(`<p>${paragraph}</p>`), [b]: html(`<p>${changed}</p>`) });
    expect((await collectSources([a, b], new AbortController().signal, different.io)).findingData.filter(finding => finding.kind === "SAME_TEXT")).toEqual([]);
  }
});
test("topic comparisons quote differing passages without calling them contradictions or fetching more pages", async () => {
  const first = "I work as a designer at Acorn and enjoy drawing outside work.";
  const second = "I worked here before starting my current career as an engineer.";
  const { io, calls } = fixture({ [a]: html(`<meta name="date" content="2023-10-01"><p>${first}</p>`),
    [b]: html(`<p>An opening paragraph without a useful topic to compare here.</p><p>${second}</p>`) });
  const result = await collectSources([a, b, "https://www.mit.edu/unavailable"], new AbortController().signal, io);
  const comparisons = result.findingData.filter(finding => finding.kind === "PASSAGES");
  expect(comparisons).toHaveLength(1);
  expect(comparisons[0]).toMatchObject({ sourceURLs: [a, b], quotes: [first, second] });
  expect(result.sourceData.map(source => source.pageDate)).toEqual(["2023-10-01", null, null]);
  expect(calls).toHaveLength(3);
  expect(result.findingData.every(finding => !finding.sourceURLs.includes("https://www.mit.edu/unavailable"))).toBe(true);
});
test("rejects private, reserved, mixed DNS answers and validates again after a redirect", async () => {
  for (const address of ["127.0.0.1", "10.0.0.1", "169.254.169.254", "100.64.0.1", "192.168.1.1", "0.0.0.0", "::1", "::ffff:127.0.0.1", "fc00::1", "fe80::1", "192.0.2.1"]) expect(publicAddress(address)).toBe(false);
  expect(publicAddress("1.1.1.1")).toBe(true);
  expect(publicAddress("2606:4700:4700::1111")).toBe(true);
  for (const address of ["https://127.0.0.1/", "https://[::1]/", "https://localhost/", "https://foo.local/", "https://example.com/", "file:///etc/passwd"]) expect(() => permittedURL(address)).toThrow();
  const mixed = fixture({}, ["93.184.216.34", "127.0.0.1"]);
  expect((await collectSources([a], new AbortController().signal, mixed.io)).sourceData[0]?.outcome).toBe("UNAVAILABLE");
  expect(mixed.calls).toEqual([]);
  const redirected = fixture({ [a]: { status: 302, headers: { location: "/final" }, body: Buffer.alloc(0) } });
  let count = 0;
  redirected.io.resolve = async () => [{ address: ++count === 1 ? "93.184.216.34" : "127.0.0.1", family: 4 }];
  expect((await collectSources([a], new AbortController().signal, redirected.io)).sourceData[0]?.outcome).toBe("UNAVAILABLE");
  expect(redirected.calls).toEqual([a]);
});
test("redirect loops, non-HTML, oversized, empty, unavailable and cancelled pages give neutral outcomes", async () => {
  for (const response of [{ status: 301, headers: { location: a }, body: Buffer.alloc(0) },
    { ...html(paragraph), headers: { "content-type": "application/pdf" } }, html("<script>no visible content</script>"),
    html("x".repeat(1024*1024+1)), { status: 403, headers: {}, body: Buffer.alloc(0) }]) {
    const { io, calls } = fixture({ [a]: response });
    const result = await collectSources([a], new AbortController().signal, io);
    expect(result.sourceData[0]).toMatchObject({ outcome: "UNAVAILABLE", excerpt: "", linksTo: [] });
    expect(result.findingData).toEqual([]);
    expect(calls.length).toBeLessThanOrEqual(4);
  }
  const { io, calls } = fixture({});
  const controller = new AbortController(); controller.abort();
  expect((await collectSources([a], controller.signal, io)).sourceData[0]?.outcome).toBe("UNAVAILABLE");
  expect(calls).toEqual([]);
});
