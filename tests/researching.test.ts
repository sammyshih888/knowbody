import { afterAll, afterEach, beforeEach, expect, test } from "bun:test";
import { MongoClient, type Db } from "mongodb";
import { ResearchingConcept, InvalidResearch, InvalidResearchResult, type SourceData, type FindingData } from "../src/concepts/Researching.ts";
import { SharingConcept } from "../src/concepts/Sharing.ts";
const client = new MongoClient(process.env.MONGODB_URL!, { serverSelectionTimeoutMS: 3000 });
let db: Db;
beforeEach(() => { db = client.db(`knowbody_test_${crypto.randomUUID().replaceAll("-", "")}`); });
afterEach(async () => { if (!db.databaseName.startsWith("knowbody_test_")) throw Error("Not a test database"); await db.dropDatabase(); });
afterAll(async () => { await client.close(); });
const urls = ["https://www.mit.edu/about", "https://www.mit.edu/research"];
const sources = (): SourceData[] => urls.map((url, i) => ({ url, outcome: "READABLE", title: "Page", excerpt: "Some source text.", retrievedAt: new Date().toISOString(), finalUrl: url, pageDate: null, linksTo: i ? [] : [urls[1]!] }));
test("reports resume once per owner and context, validate evidence, and preserve terminal results", async () => {
  const research = new ResearchingConcept(db);
  const input = { owner: "a", context: "x", urls };
  const results = await Promise.all(Array.from({ length: 8 }, () => research.start(input)));
  expect(new Set(results.map(row => row.report)).size).toBe(1);
  const { report } = results[0]!;
  await expect(research.start({ ...input, urls: [urls[0]!] })).rejects.toThrow(InvalidResearch);
  await expect(research.finish({ report, sourceData: sources().slice(0,1), findingData: [] })).rejects.toThrow(InvalidResearchResult);
  await expect(research.finish({ report, sourceData: sources(), findingData: [{ kind: "LINK", sourceURLs: [...urls].reverse(), explanation: "Unsupported" }] })).rejects.toThrow(InvalidResearchResult);
  const offsite = sources(); offsite[0]!.finalUrl = "https://evil.org/";
  await expect(research.finish({ report, sourceData: offsite, findingData: [] })).rejects.toThrow(InvalidResearchResult);
  expect(await research.finish({ report, sourceData: sources(), findingData: [{ kind: "LINK", sourceURLs: urls, explanation: "A links to B." }] })).toEqual({ stored: true });
  await research.cancelContext({ context: "x" });
  expect((await new ResearchingConcept(db)._get({ report }))[0]?.details.status).toBe("READY");
  expect(await research.finish({ report, sourceData: [], findingData: [] })).toEqual({ stored: false });
  expect(await research.fail({ report })).toEqual({ stored: false });
});
test("context cancellation prevents late starts and finishes, including concurrent races", async () => {
  const research = new ResearchingConcept(db);
  await research.cancelContext({ context: "closed" });
  await expect(research.start({ owner: "a", context: "closed", urls })).rejects.toThrow(InvalidResearch);
  const { report } = await research.start({ owner: "a", context: "race", urls });
  await Promise.all([research.cancelContext({ context: "race" }), research.finish({ report, sourceData: sources(), findingData: [] })]);
  expect(["READY", "CANCELLED"]).toContain((await research._get({ report }))[0]?.details.status);
  expect(await research._pending()).toEqual([]);
  expect(await research.finish({ report, sourceData: sources(), findingData: [] })).toEqual({ stored: false });
  await expect(research.start({ owner: "b", context: "race", urls })).rejects.toThrow(InvalidResearch);
});
test("comparison evidence must quote the corresponding readable sources and matching text must match", async () => {
  const research = new ResearchingConcept(db);
  const report = await research.start({ owner: "a", context: "comparison", urls });
  const first = "I work as a designer at Acorn and enjoy drawing outside work.";
  const second = "I work as an engineer at Cedar and enjoy building small projects.";
  const sourceData = sources().map((source, index) => ({ ...source, passages: [index ? second : first] }));
  const comparison: FindingData = { kind: "PASSAGES", sourceURLs: urls, quotes: [first, second], explanation: "Work excerpts to compare." };
  for (const finding of [
    { ...comparison, quotes: [second, first] },
    { ...comparison, sourceURLs: [urls[0]!, "https://other.org/"] },
    { ...comparison, quotes: [first, "Invented wording that does not appear in this source page."] },
    { ...comparison, kind: "SAME_TEXT" as const },
    { ...comparison, quotes: undefined },
  ]) {
    await expect(research.finish({ ...report, sourceData, findingData: [finding] })).rejects.toThrow(InvalidResearchResult);
    expect((await research._get(report))[0]?.details).toMatchObject({ status: "PENDING", sources: [], findings: [] });
  }
  await expect(research.finish({ ...report, sourceData: sourceData.map(source => ({ ...source, finalUrl: urls[0]! })), findingData: [comparison] }))
    .rejects.toThrow(InvalidResearchResult);
  expect((await research._get(report))[0]?.details).toMatchObject({ status: "PENDING", sources: [], findings: [] });
  expect(await research.finish({ ...report, sourceData, findingData: [comparison] })).toEqual({ stored: true });
  expect((await new ResearchingConcept(db)._get(report))[0]?.details.findings).toEqual([comparison]);
  const matching = await research.start({ owner: "a", context: "matching", urls });
  const repeated = sourceData.map(source => ({ ...source, passages: [first] }));
  expect(await research.finish({ ...matching, sourceData: repeated, findingData: [
    { kind: "SAME_TEXT", sourceURLs: urls, quotes: [first, first], explanation: "The wording matches apart from spacing." },
  ] })).toEqual({ stored: true });
});
test("cancelling one report blocks its late result without cancelling another report in the context", async () => {
  const research = new ResearchingConcept(db);
  const first = await research.start({ owner: "a", context: "shared", urls });
  const second = await research.start({ owner: "b", context: "shared", urls });
  await research.cancel(first);
  expect((await research._get(first))[0]?.details.status).toBe("CANCELLED");
  expect(await research.finish({ ...first, sourceData: sources(), findingData: [] })).toEqual({ stored: false });
  expect((await research._get(second))[0]?.details.status).toBe("PENDING");
  expect(await research._cancelled({ context: "shared" })).toEqual({ cancelled: false });
  expect(await research.finish({ ...second, sourceData: sources(), findingData: [] })).toEqual({ stored: true });
  await research.cancel(second);
  expect((await research._get(second))[0]?.details.status).toBe("READY");
  expect(await research.cancel({ report: "unknown" })).toEqual({});
});
test("an unavailable page allows partial results but cannot support a finding", async () => {
  const research = new ResearchingConcept(db);
  const report = await research.start({ owner: "a", context: "partial", urls });
  const partial = sources();
  partial[1] = { ...partial[1]!, outcome: "UNAVAILABLE", excerpt: "", linksTo: [] };
  await expect(research.finish({ ...report, sourceData: partial,
    findingData: [{ kind: "LINK", sourceURLs: urls, explanation: "A links to B." }] })).rejects.toThrow(InvalidResearchResult);
  expect((await research._get(report))[0]?.details.status).toBe("PENDING");
  expect(await research.finish({ ...report, sourceData: partial, findingData: [] })).toEqual({ stored: true });
  const saved = (await new ResearchingConcept(db)._get(report))[0]?.details;
  expect(saved?.status).toBe("READY");
  expect(saved?.sources).toEqual(partial);
  expect(saved?.findings).toEqual([]);
});
test("scope tombstones block late and racing grants while other scopes remain usable", async () => {
  const sharing = new SharingConcept(db);
  await Promise.all(Array.from({ length: 8 }, () => sharing.register({ owner: "a", item: "card" })));
  await sharing.revoke({ scope: "closed" });
  await sharing.grant({ owner: "a", viewer: "b", item: "card", scope: "closed" });
  expect(await sharing._readable({ viewer: "b", item: "card" })).toEqual({ allowed: false });
  await Promise.all([sharing.grant({ owner: "a", viewer: "b", item: "card", scope: "race" }), sharing.revoke({ scope: "race" })]);
  expect(await sharing._scopes({ viewer: "b", item: "card" })).toEqual([]);
  await sharing.grant({ owner: "a", viewer: "b", item: "card", scope: "other" });
  expect(await sharing._scopes({ viewer: "b", item: "card" })).toEqual([{ scope: "other" }]);
});
