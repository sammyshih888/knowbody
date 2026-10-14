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
test("source excerpts strip executable text and cite only direct links between selected readable pages", async () => {
  const { io, calls } = fixture({ [a]: html(`<title>About &amp; people</title><meta property="article:published_time" content="2025-01-01"><main><p>${paragraph}</p><script>steal secrets</script><a href="/research#topic">Research</a><a href="https://elsewhere.org/">unselected</a></main>`), [b]: html(`<p>${paragraph}</p>`) });
  const result = await collectSources([a,b], new AbortController().signal, io);
  expect(calls.sort()).toEqual([a,b]);
  expect(result.sourceData[0]).toMatchObject({ title: "About & people", excerpt: paragraph.trim(), pageDate: "2025-01-01", linksTo: [b], outcome: "READABLE" });
  expect(result.findingData).toEqual([{ kind: "LINK", sourceURLs: [a,b], explanation: "The first selected page contains a link to the second selected page." }]);
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
test("a document base changes relative link targets without fetching that base or unselected pages", async () => {
  const { io, calls } = fixture({ [a]: html(`<base href="https://elsewhere.org/"><p>${paragraph}</p><a href="/research">Research</a>`), [b]: html(`<p>${paragraph}</p>`) });
  const result = await collectSources([a,b], new AbortController().signal, io);
  expect(result.findingData).toEqual([]);
  expect(calls.sort()).toEqual([a,b]);
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
