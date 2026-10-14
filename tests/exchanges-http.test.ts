import { afterAll, afterEach, beforeAll, beforeEach, expect, test } from "bun:test";
import { MongoClient, type Db } from "mongodb";
import { createGateway } from "@mit-sdg/sync-engine/boundary";
import { createHttpHandler } from "@mit-sdg/sync-engine-http/handler";
import { assembleApplication } from "../src/assembly.ts";
import { policy } from "../src/http.ts";
import { CollectingConcept, InvalidCard } from "../src/concepts/Collecting.ts";

const client = new MongoClient(process.env.MONGODB_URL ?? "mongodb://dev:dev@127.0.0.1:27018/knowbody?authSource=admin", { serverSelectionTimeoutMS: 3000 });
let db: Db;
beforeAll(async () => { await client.connect(); });
beforeEach(() => { db = client.db(`knowbody_test_${crypto.randomUUID().replaceAll("-", "")}`); });
afterEach(async () => {
  if (!db.databaseName.startsWith("knowbody_test_")) throw new Error("Refusing to drop a non-test database");
  await db.dropDatabase();
});
afterAll(async () => { await client.close(); });

test("page types are fixed, match the URLs, and never contain free-form preview text", async () => {
  const collecting = new CollectingConcept(db);
  for (const pageTypes of [[], ["https://www.mit.edu/alex"], ["Alex's secret label"], ["Personal site", "Organization page"]]) {
    await expect(collecting.create({ owner: "owner", label: "Secret label", urls: ["https://www.mit.edu/"], pageTypes })).rejects.toThrow(InvalidCard);
  }
  const { card } = await collecting.create({ owner: "owner", label: "Secret label", urls: ["https://www.mit.edu/"], pageTypes: ["Organization page"] });
  expect(await collecting._offerPreview({ owner: "owner", card })).toEqual([{ preview: "Organization page" }]);
  expect(await collecting._offerPreview({ owner: "other", card })).toEqual([]);
  await collecting.archive({ owner: "owner", card });
  expect(await collecting._offerPreview({ owner: "owner", card })).toEqual([]);
});

test("three accounts can invite, join, and offer without revealing private selections", async () => {
  let application = assembleApplication(db);
  let gateway = createGateway({ application });
  let handler = createHttpHandler({ application, gateway, policy });
  const post = async (path: string, input: Record<string, unknown> = {}, cookie = "") => {
    const response = await handler(new Request(`http://localhost:5173/api${path}`, {
      method: "POST", headers: { "Content-Type": "application/json", Origin: "http://localhost:5173", Cookie: cookie }, body: JSON.stringify(input),
    }));
    return { status: response.status, body: await response.json() as any, cookie: response.headers.get("set-cookie")?.split(";")[0] ?? "" };
  };
  const account = async (username: string) => {
    const registered = await post("/auth/register", { username, password: "local-test-passphrase" });
    const signed = await post("/auth/sign-in", { username, password: "local-test-passphrase" });
    return { user: registered.body.user as string, cookie: signed.cookie };
  };
  try {
    const christie = await account("Christie"), alex = await account("Alex"), morgan = await account("Morgan");
    const cardFor = async (cookie: string, label: string, path: string, pageType: string) => {
      const result = await post("/cards/create", { label, urls: [`https://www.mit.edu/${path}`], pageTypes: [pageType] }, cookie);
      expect(result.status).toBe(200);
      return result.body.card as string;
    };
    const firstCard = await cardFor(christie.cookie, "Secret Christie label", "christie-private", "Personal site");
    const secondCard = await cardFor(alex.cookie, "Secret Alex label", "alex-private", "Organization page");
    const replacement = await cardFor(alex.cookie, "Replacement label", "alex-next", "Creative work");
    expect((await post("/exchanges/invite", { card: firstCard })).status).toBe(401);
    expect((await post("/exchanges/invite", { card: firstCard }, alex.cookie)).status).toBe(404);
    expect((await post("/exchanges/invite", { card: firstCard, preview: "https://www.mit.edu/" }, christie.cookie)).status).toBe(400);
    expect((await post("/exchanges/invite", { card: firstCard, first: alex.user }, christie.cookie)).status).toBe(400);
    const invited = await post("/exchanges/invite", { card: firstCard }, christie.cookie);
    expect(invited.status).toBe(200);
    const { exchange, invitation } = invited.body;
    const unclaimed = (await post("/exchanges/list", {}, christie.cookie)).body.collection.exchanges;
    expect(unclaimed).toHaveLength(1);
    expect(unclaimed[0].summary).toMatchObject({ invitation, ownItem: firstCard, revision: 1 });
    expect(unclaimed[0].partner).toEqual({ username: null });
    expect((await post("/exchanges/join", { invitation }, christie.cookie)).status).toBe(409);
    expect((await post("/exchanges/join", { invitation }, alex.cookie)).body).toEqual({ exchange });
    expect((await post("/exchanges/join", { invitation }, morgan.cookie)).status).toBe(409);
    expect((await post("/exchanges/list", {}, morgan.cookie)).body).toEqual({ collection: { exchanges: [] } });
    const joined = (await post("/exchanges/list", {}, alex.cookie)).body;
    expect(joined.collection.exchanges[0]).toMatchObject({ partner: { username: "Christie" }, summary: { invitation: null, ownItem: null, otherPreview: "Personal site", ownApproved: false } });
    for (const secret of [firstCard, invitation, "christie-private", "Secret Christie label", "https://"]) expect(JSON.stringify(joined)).not.toContain(secret);
    expect((await post("/exchanges/offer", { exchange, card: firstCard, revision: 1 }, alex.cookie)).status).toBe(404);
    expect((await post("/exchanges/offer", { exchange, card: secondCard, revision: 1 }, alex.cookie)).body).toEqual({ exchange, revision: 2 });
    const offered = (await post("/exchanges/list", {}, christie.cookie)).body;
    expect(offered.collection.exchanges[0]).toMatchObject({ partner: { username: "Alex" }, summary: { otherPreview: "Organization page", revision: 2, invitation: null } });
    for (const secret of [secondCard, "alex-private", "Secret Alex label"]) expect(JSON.stringify(offered)).not.toContain(secret);
    expect((await post("/cards/get", { card: secondCard }, christie.cookie)).status).toBe(404);
    expect((await post("/exchanges/offer", { exchange, card: replacement, revision: 1 }, alex.cookie)).status).toBe(409);
    expect((await post("/exchanges/offer", { exchange, card: replacement, revision: 2 }, alex.cookie)).body).toEqual({ exchange, revision: 3 });

    await gateway.beginDrain();
    application = assembleApplication(db);
    gateway = createGateway({ application });
    handler = createHttpHandler({ application, gateway, policy });
    expect((await post("/exchanges/list", {}, christie.cookie)).body.collection.exchanges[0].summary).toMatchObject({ revision: 3, otherPreview: "Creative work" });
    expect((await post("/exchanges/end", { exchange }, morgan.cookie)).status).toBe(409);
    expect((await post("/exchanges/end", { exchange }, alex.cookie)).status).toBe(200);
    expect((await post("/exchanges/list", {}, christie.cookie)).body.collection.exchanges[0].summary.status).toBe("ENDED");
    expect((await post("/exchanges/offer", { exchange, card: firstCard, revision: 3 }, christie.cookie)).status).toBe(409);
    expect((await post("/exchanges/join", { invitation }, morgan.cookie)).status).toBe(409);
    expect(await db.collection("sharing.scopes").countDocuments({ revoked: false })).toBe(0);
    await new CollectingConcept(db).archive({ owner: christie.user, card: firstCard });
    expect((await post("/exchanges/invite", { card: firstCard }, christie.cookie)).status).toBe(404);
  } finally { await gateway.beginDrain(); }
}, 25000);
