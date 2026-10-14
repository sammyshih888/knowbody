import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { MongoClient, type Db } from "mongodb";
import { createGateway } from "@mit-sdg/sync-engine/boundary";
import { createHttpHandler } from "@mit-sdg/sync-engine-http/handler";
import { AuthenticatingConcept, InvalidCredentials, InvalidRegistration, UsernameTaken } from "../src/concepts/Authenticating.ts";
import { CollectingConcept, InvalidCard, CardNotOwned } from "../src/concepts/Collecting.ts";
import { SharingConcept, NotItemOwner, ItemRegistered } from "../src/concepts/Sharing.ts";
import { SessioningConcept, UnknownSession } from "../src/concepts/Sessioning.ts";
import { assembleApplication } from "../src/assembly.ts";
import { policy } from "../src/http.ts";

const client = new MongoClient(process.env.MONGODB_URL ?? "mongodb://dev:dev@127.0.0.1:27018/knowbody?authSource=admin", { serverSelectionTimeoutMS: 3000 });
let db: Db;
const links = ["https://www.mit.edu/", "https://www.csail.mit.edu/"];

beforeAll(async () => { await client.connect(); });
beforeEach(() => { db = client.db(`knowbody_test_${crypto.randomUUID().replaceAll("-", "")}`); });
afterEach(async () => {
  if (!db.databaseName.startsWith("knowbody_test_")) throw new Error("Refusing to drop a non-test database");
  await db.dropDatabase();
});
afterAll(async () => { await client.close(); });

describe("Authenticating", () => {
  test("registers, persists a hash, and authenticates after reconstruction", async () => {
    const auth = new AuthenticatingConcept(db);
    const registered = await auth.register({ username: "Christie", password: "test-passphrase" });
    const stored = await db.collection("authenticating.users").findOne({ username: "Christie" });
    expect(stored?.passwordHash).toStartWith("$argon2id$");
    expect(stored).not.toHaveProperty("password");
    const restarted = new AuthenticatingConcept(db);
    expect(await restarted.authenticate({ username: "Christie", password: "test-passphrase" })).toEqual(registered);
    expect(await restarted._get(registered)).toEqual([{ username: "Christie" }]);
    expect(await restarted._get({ user: "unknown" })).toEqual([]);
    await expect(auth.authenticate({ username: "Christie", password: "wrong" })).rejects.toThrow(InvalidCredentials);
    await expect(auth.authenticate({ username: "Nobody", password: "wrong" })).rejects.toThrow(InvalidCredentials);
  });

  test("a unique database index rejects concurrent duplicate usernames", async () => {
    const attempts = await Promise.allSettled([
      new AuthenticatingConcept(db).register({ username: "Alex", password: "one" }),
      new AuthenticatingConcept(db).register({ username: "Alex", password: "two" }),
    ]);
    expect(attempts.filter(result => result.status === "fulfilled")).toHaveLength(1);
    const failure = attempts.find(result => result.status === "rejected");
    expect(failure?.status === "rejected" && failure.reason instanceof UsernameTaken).toBe(true);
    expect(await db.collection("authenticating.users").countDocuments()).toBe(1);
  });

  test("refuses empty credentials and invalid usernames without creating users", async () => {
    const auth = new AuthenticatingConcept(db);
    await expect(auth.register({ username: "", password: "password" })).rejects.toThrow(InvalidRegistration);
    await expect(auth.register({ username: "Christie", password: "" })).rejects.toThrow(InvalidRegistration);
    await expect(auth.register({ username: "two names", password: "password" })).rejects.toThrow(InvalidRegistration);
    expect(await db.collection("authenticating.users").countDocuments()).toBe(0);
  });
});

describe("Collecting", () => {
  test("saves fixed selections, isolates owner queries, and archives without changing links", async () => {
    const collecting = new CollectingConcept(db);
    expect(await collecting._byOwner({ owner: "Christie" })).toEqual([]);
    const { card } = await collecting.create({ owner: "Christie", label: " My pages ", urls: links });
    await collecting.create({ owner: "Christie", label: "Another selection", urls: [links[0]!] });
    const restarted = new CollectingConcept(db);
    expect(await restarted._get({ card })).toEqual([{ owner: "Christie", label: "My pages", urls: links, pageTypes: ["Public webpage", "Public webpage"], archived: false }]);
    expect(await restarted._byOwner({ owner: "Alex" })).toEqual([]);
    await expect(restarted.archive({ owner: "Alex", card })).rejects.toThrow(CardNotOwned);
    await restarted.archive({ owner: "Christie", card });
    expect((await restarted._get({ card }))[0]).toMatchObject({ urls: links, archived: true });
    expect((await restarted._byOwner({ owner: "Christie" })).map(row => row.label)).toEqual(["Another selection", "My pages"]);
  });

  test("rejects invalid URLs and duplicate normalized pages", async () => {
    const collecting = new CollectingConcept(db);
    for (const urls of [[], [links[0]!, links[0]!], ["https://www.mit.edu", "https://www.mit.edu/#about"],
      ["http://www.mit.edu/"], ["https://localhost/"], ["https://127.0.0.1/"],
      ["https://user:password@www.mit.edu/"], ["javascript:alert(1)"], ["https://example.com"],
      Array.from({ length: 6 }, (_, i) => `https://www.mit.edu/${i}`)]) {
      await expect(collecting.create({ owner: "owner", label: "Pages", urls })).rejects.toThrow(InvalidCard);
    }
    await expect(collecting.create({ owner: "owner", label: "  ", urls: links })).rejects.toThrow(InvalidCard);
    expect(await collecting._byOwner({ owner: "owner" })).toEqual([]);
  });
});

describe("Sharing", () => {
  test("revoking one scope preserves another and the owner's access", async () => {
    const sharing = new SharingConcept(db);
    const owner = "Christie", viewer = "Alex", item = "card";
    expect(await sharing._readable({ viewer: owner, item })).toEqual({ allowed: false });
    await sharing.register({ owner, item });
    await sharing.grant({ owner, viewer, item, scope: "first" });
    await sharing.grant({ owner, viewer, item, scope: "first" });
    await sharing.grant({ owner, viewer, item, scope: "second" });
    expect(await sharing._scopes({ viewer, item })).toEqual([{ scope: "first" }, { scope: "second" }]);
    await sharing.revoke({ scope: "first" });
    expect(await new SharingConcept(db)._readable({ viewer, item })).toEqual({ allowed: true });
    await sharing.revoke({ scope: "second" });
    expect(await sharing._readable({ viewer, item })).toEqual({ allowed: false });
    expect(await sharing._readable({ viewer: owner, item })).toEqual({ allowed: true });
  });

  test("ownership cannot be replaced and nonowners cannot grant access", async () => {
    const sharing = new SharingConcept(db);
    await sharing.register({ owner: "Christie", item: "card" });
    await expect(sharing.register({ owner: "Alex", item: "card" })).rejects.toThrow(ItemRegistered);
    await expect(sharing.grant({ owner: "Alex", viewer: "Alex", item: "card", scope: "x" })).rejects.toThrow(NotItemOwner);
    await expect(sharing.grant({ owner: "Alex", viewer: "Alex", item: "missing", scope: "x" })).rejects.toThrow(NotItemOwner);
  });
});

describe("Sessioning", () => {
  test("sessions persist, expire on time, and end independently", async () => {
    let now = new Date("2099-01-01T12:00:00Z");
    const sessions = new SessioningConcept(db, () => now);
    const first = await sessions.start({ subject: "Christie" });
    const second = await sessions.start({ subject: "Christie" });
    expect(first.session).not.toBe(second.session);
    const stored = await db.collection("sessioning.sessions").findOne({ subject: "Christie" });
    expect(String(stored?._id)).not.toBe(first.session);
    expect(await new SessioningConcept(db, () => now).current(first)).toEqual({ subject: "Christie" });
    await sessions.end(first);
    await expect(sessions.current(first)).rejects.toThrow(UnknownSession);
    expect(await sessions.current(second)).toEqual({ subject: "Christie" });
    now = new Date("2099-01-01T12:30:00Z");
    await expect(sessions.current(second)).rejects.toThrow(UnknownSession);
    await expect(sessions.current({ session: null })).rejects.toThrow(UnknownSession);
    expect(await sessions.end({ session: null })).toEqual({ ended: true });
  });
});

describe("HTTP composition", () => {
  test("empty database to private card, restart, second account, and sign-out", async () => {
    let application = assembleApplication(db);
    let gateway = createGateway({ application });
    let handler = createHttpHandler({ application, gateway, policy });
    const post = async (path: string, input: Record<string, unknown> = {}, cookie = "", origin = "http://localhost:5173") => {
      const response = await handler(new Request(`http://localhost:5173/api${path}`, {
        method: "POST", headers: { "Content-Type": "application/json", Origin: origin, Cookie: cookie }, body: JSON.stringify(input),
      }));
      return { response, body: await response.json() as Record<string, unknown>, cookie: response.headers.get("set-cookie")?.split(";")[0] ?? "" };
    };
    try {
      expect((await post("/cards/list")).body).toMatchObject({ error: "UNAUTHORIZED" });
      expect((await post("/auth/register", { username: "Christie", password: "test-passphrase" })).response.status).toBe(200);
      const signedIn = await post("/auth/sign-in", { username: "Christie", password: "test-passphrase" });
      expect(signedIn.response.status).toBe(200);
      expect(signedIn.response.headers.get("set-cookie")).toContain("HttpOnly");
      expect(signedIn.response.headers.get("set-cookie")).toContain("Secure");
      expect(signedIn.body).not.toHaveProperty("session");
      expect(signedIn.body).not.toHaveProperty("expiresAt");
      const christie = signedIn.cookie;
      expect(christie).toStartWith("__Host-");
      expect((await post("/auth/current", {}, christie)).body).toMatchObject({ username: "Christie" });
      expect((await post("/cards/list", {}, christie)).body).toEqual({ collection: { cards: [] } });
      expect((await post("/cards/create", { label: "Pages", urls: links, owner: "Alex" }, christie)).response.status).toBe(400);
      expect((await post("/cards/create", { label: "Pages", urls: ["http://localhost"] }, christie)).response.status).toBe(400);
      const created = await post("/cards/create", { label: "My pages", urls: links, pageTypes: ["Personal site", "Organization page"] }, christie);
      expect(created.response.status).toBe(200);
      const card = String(created.body.card);
      expect((await post("/cards/get", { card }, christie)).body).toMatchObject({ details: { card, label: "My pages", urls: links } });
      expect((await post("/cards/list", {}, christie)).body).toMatchObject({ collection: { cards: [{ card }] } });

      await gateway.beginDrain();
      application = assembleApplication(db);
      gateway = createGateway({ application });
      handler = createHttpHandler({ application, gateway, policy });
      expect((await post("/cards/get", { card }, christie)).body).toMatchObject({ details: { urls: links } });

      await post("/auth/register", { username: "Alex", password: "alex-passphrase" });
      const alex = (await post("/auth/sign-in", { username: "Alex", password: "alex-passphrase" })).cookie;
      expect((await post("/cards/list", {}, alex)).body).toEqual({ collection: { cards: [] } });
      const denied = await post("/cards/get", { card }, alex);
      expect(denied.response.status).toBe(404);
      expect(denied.body).toEqual((await post("/cards/get", { card: "unknown" }, alex)).body);
      expect((await post("/cards/get", { card, session: christie.split("=")[1] })).body).toMatchObject({ error: "UNAUTHORIZED" });
      expect((await post("/cards/create", { label: "Forged", urls: links }, christie, "https://attacker.test")).response.status).toBe(403);
      const out = await post("/auth/sign-out", {}, christie);
      expect(out.response.status).toBe(200);
      expect((await post("/cards/list", {}, christie)).body).toMatchObject({ error: "UNAUTHORIZED" });
      expect((await post("/auth/current", {}, alex)).response.status).toBe(200);
      // A valid session must still receive an answer if its account is absent.
      await db.collection("authenticating.users").deleteOne({ username: "Alex" });
      const missingAccount = await post("/auth/current", {}, alex);
      expect(missingAccount.response.status).toBe(401);
      expect(missingAccount.body).toEqual({ error: "UNAUTHORIZED" });
    } finally { await gateway.beginDrain(); }
  }, 20000);
});
