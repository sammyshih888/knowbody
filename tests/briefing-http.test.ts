import { afterAll, afterEach, beforeEach, expect, spyOn, test } from "bun:test";
import { createLocalClient } from "@mit-sdg/sync-engine/client";
import { MongoClient, type Db } from "mongodb";
import { createRuntime } from "../src/runtime.ts";
import { ExchangingConcept } from "../src/concepts/Exchanging.ts";
import { ResearchingConcept, type SourceData } from "../src/concepts/Researching.ts";
import { SharingConcept } from "../src/concepts/Sharing.ts";
import type { KnowbodyWire } from "../generated/wire.ts";
const client = new MongoClient(process.env.MONGODB_URL!, { serverSelectionTimeoutMS: 3000 });
let db: Db;
let runtime: ReturnType<typeof createRuntime>;
let fetches = 0;
const resultFor = (urls: string[]) => ({ sourceData: urls.map((url): SourceData => ({ url, outcome: "READABLE", title: "Fixture page", excerpt: "A public source excerpt for this selected page.", retrievedAt: new Date().toISOString(), pageDate: null, finalUrl: url, linksTo: [] })), findingData: [] });
beforeEach(() => {
  db = client.db(`knowbody_test_${crypto.randomUUID().replaceAll("-", "")}`);
  fetches = 0;
  runtime = createRuntime(db, async urls => { fetches++; return resultFor(urls); });
});
afterEach(async () => {
  await runtime.stop();
  if (!db.databaseName.startsWith("knowbody_test_")) throw Error("Not a test database");
  await db.dropDatabase();
});
afterAll(async () => { await client.close(); });
async function post(path: string, input: Record<string, unknown> = {}, cookie = "") {
  const response = await runtime.handle(new Request(`http://localhost:5173/api${path}`, { method: "POST",
    headers: { "Content-Type": "application/json", Origin: "http://localhost:5173", Cookie: cookie }, body: JSON.stringify(input) }));
  return { status: response.status, body: await response.json() as any, cookie: response.headers.get("set-cookie")?.split(";")[0] ?? "" };
}
async function account(username: string) {
  const user = (await post("/auth/register", { username, password: "test-passphrase" })).body.user as string;
  const cookie = (await post("/auth/sign-in", { username, password: "test-passphrase" })).cookie;
  const card = (await post("/cards/create", { label: `${username} private label`, urls: [`https://www.mit.edu/${username}`], pageTypes: ["Personal site"] }, cookie)).body.card as string;
  return { user, cookie, card };
}
async function pair(a: Awaited<ReturnType<typeof account>>, b: Awaited<ReturnType<typeof account>>) {
  const { exchange, invitation } = (await post("/exchanges/invite", { card: a.card }, a.cookie)).body;
  await post("/exchanges/join", { invitation }, b.cookie);
  await post("/exchanges/offer", { exchange, card: b.card, revision: 1 }, b.cookie);
  return exchange as string;
}
const list = async (cookie: string, exchange: string) => (await post("/exchanges/list", {}, cookie)).body.collection.exchanges.find((row: any) => row.exchange === exchange);
const approve = (cookie: string, exchange: string, revision = 2) => post("/exchanges/approve", { exchange, revision }, cookie);

test("mutual approval gates cards and briefs; offer changes reset consent; ending preserves only owner reports", async () => {
  const a = await account("Christie"), b = await account("Alex"), outsider = await account("Morgan");
  const exchange = await pair(a,b);
  expect((await approve(outsider.cookie, exchange)).status).toBe(409);
  expect((await approve(a.cookie, exchange, 1)).status).toBe(409);
  expect((await approve(a.cookie, exchange)).body.status).toBe("OPEN");
  await runtime.tick(); await runtime.idle();
  expect(fetches).toBe(0);
  expect((await post("/cards/get", { card: b.card }, a.cookie)).status).toBe(404);
  expect((await list(a.cookie, exchange)).shared.card).toBe(null);
  await post("/exchanges/offer", { exchange, card: b.card, revision: 2 }, b.cookie);
  expect((await list(a.cookie, exchange)).summary).toMatchObject({ ownApproved: false, otherApproved: false, revision: 3 });
  expect((await approve(a.cookie, exchange, 2)).status).toBe(409);
  await approve(a.cookie, exchange, 3);
  expect((await approve(b.cookie, exchange, 3)).body.status).toBe("ACTIVE");
  const active = await list(a.cookie, exchange);
  expect(active.shared).toMatchObject({ card: b.card, label: "Alex private label", urls: ["https://www.mit.edu/Alex"] });
  expect(active.ownBrief.details.status).toBe("PENDING");
  const ownReport = active.ownBrief.report, otherReport = active.shared.brief.report;
  expect((await post("/reports/get", { report: a.card }, a.cookie)).status).toBe(404);
  expect((await post("/cards/get", { card: ownReport }, a.cookie)).status).toBe(404);
  expect((await post("/cards/get", { card: b.card }, a.cookie)).status).toBe(200);
  expect((await post("/reports/get", { report: otherReport }, outsider.cookie)).status).toBe(404);
  expect((await post("/reports/get", { report: otherReport }, outsider.cookie)).body).toEqual((await post("/reports/get", { report: "unknown" }, outsider.cookie)).body);
  await runtime.tick(); await runtime.idle();
  expect(fetches).toBe(2);
  expect((await list(a.cookie, exchange)).shared.brief.details.status).toBe("READY");
  expect((await post("/exchanges/offer", { exchange, card: a.card, revision: 3 }, a.cookie)).status).toBe(409);
  await runtime.stop();
  runtime = createRuntime(db, async urls => { fetches++; return resultFor(urls); });
  await runtime.tick(); await runtime.idle();
  expect(fetches).toBe(2);
  expect((await list(a.cookie, exchange)).ownBrief.report).toBe(ownReport);
  expect((await post("/exchanges/end", { exchange }, b.cookie)).status).toBe(200);
  const ended = await list(a.cookie, exchange);
  expect(ended.summary.status).toBe("ENDED");
  expect(ended.shared.card).toBe(null);
  expect(ended.ownBrief.details.status).toBe("READY");
  expect((await post("/cards/get", { card: b.card }, a.cookie)).status).toBe(404);
  expect((await post("/reports/get", { report: otherReport }, a.cookie)).status).toBe(404);
  expect((await post("/reports/get", { report: ownReport }, a.cookie)).status).toBe(200);
  expect((await post("/reports/get", { report: ownReport }, b.cookie)).status).toBe(404);
  expect((await post("/reports/get", { report: otherReport }, b.cookie)).status).toBe(200);
}, 25000);

test("ending during research prevents late publication while independent active scopes still grant cards", async () => {
  const a = await account("Christie"), b = await account("Alex");
  const exchange = await pair(a,b), otherExchange = await pair(a,b);
  await approve(a.cookie, exchange); await approve(b.cookie, exchange);
  await approve(a.cookie, otherExchange); await approve(b.cookie, otherExchange);
  await runtime.stop();
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  runtime = createRuntime(db, async urls => { await gate; return resultFor(urls); });
  const report = (await list(a.cookie, exchange)).ownBrief.report;
  await runtime.tick();
  try {
    expect((await post("/exchanges/end", { exchange }, a.cookie)).status).toBe(200);
    expect((await new ResearchingConcept(db)._get({ report }))[0]?.details.status).toBe("CANCELLED");
    expect((await post("/cards/get", { card: b.card }, a.cookie)).status).toBe(200);
  } finally { release(); }
  await runtime.idle();
  expect((await new ResearchingConcept(db)._get({ report }))[0]?.details.status).toBe("CANCELLED");
  await post("/exchanges/end", { exchange: otherExchange }, b.cookie);
  expect((await post("/cards/get", { card: b.card }, a.cookie)).status).toBe(404);
}, 25000);

test("startup repairs partial activation and cleanup, and reads deny a stale grant immediately", async () => {
  const a = await account("Christie"), b = await account("Alex");
  const exchange = await pair(a,b);
  // Simulate process loss after approval was persisted but before reactions ran.
  const exchanging = new ExchangingConcept(db);
  await exchanging.approve({ user: a.user, exchange, revision: 2 });
  await exchanging.approve({ user: b.user, exchange, revision: 2 });
  await runtime.stop();
  runtime = createRuntime(db, async urls => resultFor(urls));
  await runtime.tick(); await runtime.idle();
  const active = await list(a.cookie, exchange);
  expect(active.shared.card).toBe(b.card);
  expect(active.ownBrief.details.status).toBe("READY");
  await exchanging.end({ user: a.user, exchange });
  // Cleanup has not run, but the access policy already denies the old grant.
  expect((await post("/cards/get", { card: b.card }, a.cookie)).status).toBe(404);
  expect((await post("/reports/get", { report: active.shared.brief.report }, a.cookie)).status).toBe(404);
  await runtime.stop();
  runtime = createRuntime(db, async urls => resultFor(urls));
  await runtime.tick(); await runtime.idle();
  expect(await db.collection("sharing.scopes").findOne({ _id: exchange } as any)).toMatchObject({ revoked: true, grants: [] });
}, 25000);

test("worker discovery retries incomplete sharing and excludes ended reports before cleanup", async () => {
  const worker = createLocalClient<KnowbodyWire>({ invoker: runtime.gateway });
  const work = async () => {
    const outcome = await worker["/_worker/work"]({});
    if ("error" in outcome) throw Error(outcome.error);
    return outcome.work;
  };
  expect(await work()).toEqual({ recoveries: [], reports: [] });
  const a = await account("Christie"), b = await account("Alex");
  const exchange = await pair(a, b);
  await approve(a.cookie, exchange);
  expect(await work()).toEqual({ recoveries: [], reports: [] });
  // Model a crash after the second approval, before its reactions.
  await new ExchangingConcept(db).approve({ user: b.user, exchange, revision: 2 });
  expect(await work()).toEqual({ recoveries: [{ exchange }], reports: [] });

  // Model partial effects through standalone actions: both cards are shared,
  // and both reports exist, but only Christie's report has its sharing grant.
  const sharing = new SharingConcept(db), researching = new ResearchingConcept(db);
  for (const [owner, viewer, name] of [[a, b, "Christie"], [b, a, "Alex"]] as const) {
    await sharing.grant({ owner: owner.user, viewer: viewer.user, item: owner.card, scope: exchange });
    const { report } = await researching.start({ owner: owner.user, context: exchange, urls: [`https://www.mit.edu/${name}`] });
    await sharing.register({ owner: owner.user, item: report });
    if (owner === a) await sharing.grant({ owner: owner.user, viewer: viewer.user, item: report, scope: exchange });
  }
  const incomplete = await work();
  expect(incomplete.recoveries).toEqual([{ exchange }]);
  expect(incomplete.reports).toHaveLength(2);
  expect((await list(a.cookie, exchange)).shared.card).toBe(b.card);
  expect((await list(a.cookie, exchange)).shared.brief.report).toBe(null);
  expect(await worker["/_worker/recover"]({ exchange })).toEqual({ exchange });
  const complete = await work();
  expect(complete.recoveries).toEqual([]);
  expect(complete.reports).toEqual(incomplete.reports);
  expect((await list(a.cookie, exchange)).shared.brief.report).toBeString();
  await worker["/_worker/recover"]({ exchange });
  expect(await work()).toEqual(complete);

  // Ending is persisted first. Pending reports must stop being offered to workers
  // even if cancellation has not run yet.
  await new ExchangingConcept(db).end({ user: a.user, exchange });
  await new SharingConcept(db).revoke({ scope: exchange });
  expect(await new ResearchingConcept(db)._pending()).toHaveLength(2);
  expect(await work()).toEqual({ recoveries: [{ exchange }], reports: [] });
  await worker["/_worker/recover"]({ exchange });
  expect(await work()).toEqual({ recoveries: [], reports: [] });
  expect((await list(a.cookie, exchange)).ownBrief.details.status).toBe("CANCELLED");
}, 25000);

test("worker scheduling limits concurrent fetches and aborts work after ending", async () => {
  const a = await account("Christie"), b = await account("Alex");
  const exchanges = [await pair(a, b), await pair(a, b)];
  for (const exchange of exchanges) {
    await approve(a.cookie, exchange); await approve(b.cookie, exchange);
  }
  await runtime.stop();
  const signals: AbortSignal[] = [];
  runtime = createRuntime(db, (_urls, signal) => new Promise((_resolve, reject) => {
    signals.push(signal);
    signal.addEventListener("abort", () => reject(new Error("Fetch aborted")), { once: true });
  }));
  await runtime.tick();
  expect(signals).toHaveLength(2);
  await runtime.tick();
  expect(signals).toHaveLength(2);
  for (const exchange of exchanges) await post("/exchanges/end", { exchange }, a.cookie);
  await runtime.tick(); await runtime.idle();
  expect(signals.every(signal => signal.aborted)).toBe(true);
  await runtime.tick(); await runtime.idle();
  expect(signals).toHaveLength(2);
}, 25000);

test("worker composition accepts pending active reports and ignores terminal, unknown, or ended reports", async () => {
  const a = await account("Christie"), b = await account("Alex");
  const exchange = await pair(a, b);
  await approve(a.cookie, exchange); await approve(b.cookie, exchange);
  const active = await list(a.cookie, exchange);
  const first = active.ownBrief.report, second = active.shared.brief.report;
  const worker = createLocalClient<KnowbodyWire>({ invoker: runtime.gateway });
  const result = resultFor(["https://www.mit.edu/Christie"]);
  expect(await worker["/_worker/result"]({ report: "unknown", ...result })).toEqual({ stored: false });
  expect(await worker["/_worker/failure"]({ report: "unknown" })).toEqual({ stored: false });
  expect(await worker["/_worker/result"]({ report: first, ...resultFor(["https://www.mit.edu/unselected"]) }))
    .toMatchObject({ error: "INVALID_RESEARCH_RESULT" });
  expect((await list(a.cookie, exchange)).ownBrief.details.status).toBe("PENDING");
  expect(await worker["/_worker/result"]({ report: first, ...result })).toEqual({ stored: true });
  expect(await worker["/_worker/result"]({ report: first, ...result })).toEqual({ stored: false });
  expect(await worker["/_worker/failure"]({ report: first })).toEqual({ stored: false });
  expect(await worker["/_worker/failure"]({ report: second })).toEqual({ stored: true });
  expect(await worker["/_worker/failure"]({ report: second })).toEqual({ stored: false });

  const ending = await pair(a, b);
  await approve(a.cookie, ending); await approve(b.cookie, ending);
  const pending = (await list(a.cookie, ending)).ownBrief.report;
  // End durably without running cleanup: the publication guard must check Exchanging.
  await new ExchangingConcept(db).end({ user: a.user, exchange: ending });
  expect((await new ResearchingConcept(db)._get({ report: pending }))[0]?.details.status).toBe("PENDING");
  expect(await worker["/_worker/result"]({ report: pending, ...result })).toEqual({ stored: false });
  expect(await worker["/_worker/failure"]({ report: pending })).toEqual({ stored: false });
  // A caller cannot replace the report's saved context with another active exchange.
  expect(await runtime.gateway.invoke("/_worker/result", { report: pending, exchange, ...result }))
    .toMatchObject({ ok: false, error: { code: "INVALID_INPUT" } });
  expect((await new ResearchingConcept(db)._get({ report: pending }))[0]?.details.status).toBe("PENDING");
}, 25000);

test("HTTP cannot reach worker boundaries even with an owner's cookie or encoded paths", async () => {
  const a = await account("Christie"), b = await account("Alex");
  const exchange = await pair(a, b);
  await approve(a.cookie, exchange); await approve(b.cookie, exchange);
  const report = (await list(a.cookie, exchange)).ownBrief.report;
  const input = { report, ...resultFor(["https://www.mit.edu/Christie"]) };
  for (const cookie of ["", a.cookie]) {
    for (const path of ["/_worker/result", "/_worker/failure", "/_worker/work", "/_worker/recover",
      "/%5fworker/result", "/_worker%2fresult", "/_worker/result/", "/%255fworker/result",
      "/%5fworker/work", "/_worker%2frecover"]) {
      const response = await post(path, input, cookie);
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: "NOT_FOUND" });
    }
  }
  expect((await list(a.cookie, exchange)).ownBrief.details.status).toBe("PENDING");
  await runtime.tick(); await runtime.idle();
  expect((await list(a.cookie, exchange)).ownBrief.details.status).toBe("READY");
}, 25000);

test("a source worker failure goes through composition and leaves a terminal failed brief", async () => {
  const a = await account("Christie"), b = await account("Alex");
  const exchange = await pair(a, b);
  await approve(a.cookie, exchange); await approve(b.cookie, exchange);
  await runtime.stop();
  runtime = createRuntime(db, async () => { throw new Error("Fixture retrieval failure"); });
  const logged = spyOn(console, "error").mockImplementation(() => {});
  try {
    await runtime.tick(); await runtime.idle();
    const failed = await list(a.cookie, exchange);
    expect(failed.ownBrief.details.status).toBe("FAILED");
    expect(failed.shared.brief.details.status).toBe("FAILED");
    expect(logged).toHaveBeenCalledTimes(2);
    await runtime.tick(); await runtime.idle();
    expect(logged).toHaveBeenCalledTimes(2);
  } finally { logged.mockRestore(); }
}, 25000);

test("card creation answers with a private error when ownership registration is missing", async () => {
  await post("/auth/register", { username: "Christie", password: "test-passphrase" });
  const cookie = (await post("/auth/sign-in", { username: "Christie", password: "test-passphrase" })).cookie;
  await runtime.stop();
  // Model an omitted ownership effect without changing the saved card or its read guard.
  const registration = spyOn(SharingConcept.prototype, "register").mockResolvedValue({});
  try {
    runtime = createRuntime(db);
    const response = await post("/cards/create", { label: "Pages", urls: ["https://www.mit.edu/"], pageTypes: ["Organization page"] }, cookie);
    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: "INTERNAL_ERROR" });
    expect(await db.collection("collecting.cards").countDocuments()).toBe(1);
    expect((await post("/cards/list", {}, cookie)).body.collection.cards).toEqual([]);
  } finally { registration.mockRestore(); }
}, 25000);
