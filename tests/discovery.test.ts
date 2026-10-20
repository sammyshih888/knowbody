import { afterAll, afterEach, beforeEach, expect, test } from "bun:test";
import { MongoClient, type Db } from "mongodb";
import { searchPages } from "../src/discovery.ts";
import { createRuntime } from "../src/runtime.ts";

test("search uses basic requests, filters candidates, and never returns the API key or an AI answer", async () => {
  const requests: RequestInit[] = [];
  const result = await searchPages("Rachel Andrew", new AbortController().signal, "fixture-secret", async (url, init) => {
    expect(url).toBe("https://api.tavily.com/search");
    requests.push(init);
    return Response.json({ answer: "Not source evidence", results: [
      { url: "https://rachelandrew.co.uk/about#bio", title: "<b>About Rachel</b>", content: "Public &amp; selected" },
      { url: "https://rachelandrew.co.uk/about", title: "Duplicate", content: "Duplicate" },
      { url: "http://plain-http.org/", title: "No", content: "No" },
      { url: "https://127.0.0.1/", title: "No", content: "No" },
      { url: "javascript:alert(1)", title: "No", content: "No" },
      { url: "https://example.com/", title: "No", content: "No" },
      { url: "https://www.mit.edu/", title: 5, content: "No" },
    ] });
  });
  expect(result).toEqual({ results: [{ url: "https://rachelandrew.co.uk/about", title: "About Rachel", snippet: "Public & selected" }] });
  expect(requests).toHaveLength(1);
  expect(JSON.parse(requests[0]!.body as string)).toMatchObject({ query: "Rachel Andrew", search_depth: "basic",
    auto_parameters: false, include_answer: false, include_raw_content: false, max_results: 5 });
  expect(JSON.stringify(result)).not.toContain("fixture-secret");
});

test("missing keys, quota exhaustion, and failed providers do not invoke a paid fallback or expose errors", async () => {
  let calls = 0;
  const response = async () => { calls++; return Response.json({ results: [] }); };
  expect(await searchPages("query", new AbortController().signal, "", response)).toEqual({ error: "SEARCH_UNAVAILABLE" });
  expect(calls).toBe(0);
  for (const status of [429, 432, 433, 401, 500]) {
    expect(await searchPages("query", new AbortController().signal, "fixture-secret", async () => {
      calls++; return Response.json({ detail: "private provider error" }, { status });
    })).toEqual({ error: [429, 432, 433].includes(status) ? "SEARCH_LIMIT" : "SEARCH_UNAVAILABLE" });
  }
  expect(calls).toBe(5);
  expect(await searchPages("query", new AbortController().signal, "fixture-secret", async () => { throw Error("private network error"); }))
    .toEqual({ error: "SEARCH_UNAVAILABLE" });
  expect(await searchPages("query", new AbortController().signal, "fixture-secret", async () => Response.json({})))
    .toEqual({ error: "SEARCH_UNAVAILABLE" });
});

const client = new MongoClient(process.env.MONGODB_URL!, { serverSelectionTimeoutMS: 3000 });
let db: Db;
let runtime: ReturnType<typeof createRuntime> | undefined;
beforeEach(() => { db = client.db(`knowbody_test_${crypto.randomUUID().replaceAll("-", "")}`); });
afterEach(async () => {
  await runtime?.stop(); runtime = undefined;
  if (!db.databaseName.startsWith("knowbody_test_")) throw Error("Not a test database");
  await db.dropDatabase();
});
afterAll(async () => { await client.close(); });

async function post(path: string, body: unknown, cookie = "", origin = "http://localhost:5173") {
  const response = await runtime!.handle(new Request(`http://localhost:5173/api${path}`, { method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json", Cookie: cookie }, body: JSON.stringify(body) }));
  return { status: response.status, body: await response.json() as any, cookie: response.headers.get("set-cookie")?.split(";")[0] ?? "" };
}

test("discovery authenticates and validates before searching, keeps candidates unsaved, and limits repeated requests", async () => {
  const queries: string[] = [];
  runtime = createRuntime(db, undefined, async query => {
    queries.push(query); return { results: [{ url: "https://www.mit.edu/", title: "Candidate", snippet: "A suggestion" }] };
  });
  await post("/auth/register", { username: "Christie", password: "test-passphrase" });
  const { cookie } = await post("/auth/sign-in", { username: "Christie", password: "test-passphrase" });
  expect((await post("/search", { query: "Christie" })).status).toBe(401);
  expect((await post("/search", { query: "Christie" }, cookie, "https://untrusted.org")).status).toBe(403);
  for (const body of [{ query: " " }, { query: "x".repeat(161) }, { query: "Christie", user: "someone" }, {}])
    expect((await post("/search", body, cookie)).status).toBe(400);
  for (const path of ["/_discovery/authorize", "/%5fdiscovery/authorize", "/search/", "/%73earch"])
    expect((await post(path, { query: "Christie" }, cookie)).status).toBe(404);
  expect(queries).toEqual([]);
  expect((await post("/search", { query: " Christie school " }, cookie)).body.results).toHaveLength(1);
  expect(queries).toEqual(["Christie school"]);
  expect((await post("/search", { query: "Christie school" }, cookie)).status).toBe(429);
  expect(queries).toHaveLength(1);
  expect((await post("/cards/list", {}, cookie)).body.collection.cards).toEqual([]);
  expect(await db.collection("researching.contexts").countDocuments()).toBe(0);
  expect(await db.collection("sharing.items").countDocuments()).toBe(0);
});

test("a slow search does not hold the state-change queue", async () => {
  let release!: () => void, started!: () => void;
  const waiting = new Promise<void>(resolve => { release = resolve; });
  const fetching = new Promise<void>(resolve => { started = resolve; });
  runtime = createRuntime(db, undefined, async () => { started(); await waiting; return { results: [] }; });
  await post("/auth/register", { username: "Alex", password: "test-passphrase" });
  const { cookie } = await post("/auth/sign-in", { username: "Alex", password: "test-passphrase" });
  const search = post("/search", { query: "Alex school" }, cookie);
  await fetching;
  try { expect((await post("/auth/sign-out", {}, cookie)).status).toBe(200); }
  finally { release(); }
  expect((await search).status).toBe(200);
  expect((await post("/search", { query: "Alex school" }, cookie)).status).toBe(401);
});
