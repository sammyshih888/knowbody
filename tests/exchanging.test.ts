import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { MongoClient, type Db } from "mongodb";
import { ExchangingConcept, InvitationUnavailable, OfferUnavailable, ApprovalUnavailable, EndUnavailable, InvalidInvitation } from "../src/concepts/Exchanging.ts";

const client = new MongoClient(process.env.MONGODB_URL ?? "mongodb://dev:dev@127.0.0.1:27018/knowbody?authSource=admin", { serverSelectionTimeoutMS: 3000 });
let db: Db;
let exchanges: ExchangingConcept;
beforeAll(async () => { await client.connect(); });
beforeEach(() => {
  db = client.db(`knowbody_test_${crypto.randomUUID().replaceAll("-", "")}`);
  exchanges = new ExchangingConcept(db);
});
afterEach(async () => {
  if (!db.databaseName.startsWith("knowbody_test_")) throw new Error("Refusing to drop a non-test database");
  await db.dropDatabase();
});
afterAll(async () => { await client.close(); });

const open = () => exchanges.open({ first: "Christie", item: "christie-card", preview: "Personal site" });
const offer = (exchange: string, revision: number, user = "Alex", item = "alex-card") =>
  exchanges.offer({ user, exchange, item, preview: "Organization page", revision });

describe("Exchanging", () => {
  test("empty state through joining, changed offers, mutual approval, persistence, and ending", async () => {
    expect(await exchanges._byUser({ user: "Christie" })).toEqual([]);
    const { exchange, invitation } = await open();
    expect(invitation).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect((await exchanges._byUser({ user: "Christie" }))[0]?.summary).toMatchObject({
      invitation, ownItem: "christie-card", otherPreview: null, revision: 1, status: "OPEN", ownApproved: false,
    });
    expect(await exchanges._counterparty({ user: "Christie", exchange })).toEqual([]);
    await expect(exchanges.join({ user: "Christie", invitation })).rejects.toThrow(InvitationUnavailable);
    await exchanges.join({ user: "Alex", invitation });
    expect(await exchanges._counterparty({ user: "Christie", exchange })).toEqual([{ other: "Alex" }]);
    const joined = (await exchanges._byUser({ user: "Alex" }))[0]!.summary;
    expect(joined).toMatchObject({ ownItem: null, otherPreview: "Personal site", revision: 1, ownApproved: false, invitation: null });
    expect(JSON.stringify(joined)).not.toContain("christie-card");
    await expect(exchanges.approve({ user: "Christie", exchange, revision: 1 })).rejects.toThrow(ApprovalUnavailable);
    await offer(exchange, 1);
    expect(await exchanges.approve({ user: "Christie", exchange, revision: 2 })).toEqual({ exchange, status: "OPEN" });
    await offer(exchange, 2, "Alex", "alex-new-card");
    expect((await exchanges._byUser({ user: "Christie" }))[0]!.summary).toMatchObject({ revision: 3, ownApproved: false, otherApproved: false });
    await expect(exchanges.approve({ user: "Alex", exchange, revision: 2 })).rejects.toThrow(ApprovalUnavailable);
    await exchanges.approve({ user: "Christie", exchange, revision: 3 });
    expect(await exchanges.approve({ user: "Alex", exchange, revision: 3 })).toEqual({ exchange, status: "ACTIVE" });
    await expect(offer(exchange, 3)).rejects.toThrow(OfferUnavailable);
    const restarted = new ExchangingConcept(db);
    expect((await restarted._byUser({ user: "Alex" }))[0]!.summary).toMatchObject({ status: "ACTIVE", ownItem: "alex-new-card", ownApproved: true, otherApproved: true });
    await restarted.end({ user: "Alex", exchange });
    await expect(restarted.end({ user: "Christie", exchange })).rejects.toThrow(EndUnavailable);
    await expect(restarted.join({ user: "Other", invitation })).rejects.toThrow(InvitationUnavailable);
    await expect(restarted.approve({ user: "Christie", exchange, revision: 3 })).rejects.toThrow(ApprovalUnavailable);
    expect((await restarted._byUser({ user: "Christie" }))[0]!.summary.status).toBe("ENDED");
  });

  test("only one account can claim an invitation, including concurrent joins", async () => {
    const { invitation, exchange } = await open();
    const attempts = await Promise.allSettled(["Alex", "Morgan"].map(user => exchanges.join({ user, invitation })));
    expect(attempts.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(attempts.filter(result => result.status === "rejected")).toHaveLength(1);
    expect(await exchanges._counterparty({ user: "Christie", exchange })).toHaveLength(1);
    expect(await exchanges._byUser({ user: "Outsider" })).toEqual([]);
    expect(await exchanges._counterparty({ user: "Outsider", exchange })).toEqual([]);
    await expect(offer(exchange, 1, "Outsider")).rejects.toThrow(OfferUnavailable);
    await expect(exchanges.end({ user: "Outsider", exchange })).rejects.toThrow(EndUnavailable);
  });

  test("concurrent offers cannot both replace the same revision", async () => {
    const { invitation, exchange } = await open();
    await exchanges.join({ user: "Alex", invitation });
    const attempts = await Promise.allSettled([offer(exchange, 1), offer(exchange, 1, "Christie", "new-card")]);
    expect(attempts.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(attempts.filter(result => result.status === "rejected")).toHaveLength(1);
    expect((await exchanges._byUser({ user: "Alex" }))[0]!.summary.revision).toBe(2);
  });

  test("concurrent approvals activate once; duplicate approval alone never activates", async () => {
    const { invitation, exchange } = await open();
    await exchanges.join({ user: "Alex", invitation });
    await offer(exchange, 1);
    await exchanges.approve({ user: "Christie", exchange, revision: 2 });
    expect(await exchanges.approve({ user: "Christie", exchange, revision: 2 })).toEqual({ exchange, status: "OPEN" });
    await expect(exchanges.approve({ user: "Outsider", exchange, revision: 2 })).rejects.toThrow(ApprovalUnavailable);
    await offer(exchange, 2);
    const approvals = await Promise.all(["Christie", "Alex"].map(user => exchanges.approve({ user, exchange, revision: 3 })));
    expect(approvals.filter(result => result.status === "ACTIVE")).toHaveLength(1);
    expect((await exchanges._byUser({ user: "Christie" }))[0]!.summary).toMatchObject({ status: "ACTIVE", ownApproved: true, otherApproved: true });
  });

  test("racing approval against offer change cannot approve a new selection", async () => {
    const { invitation, exchange } = await open();
    await exchanges.join({ user: "Alex", invitation });
    await offer(exchange, 1);
    await exchanges.approve({ user: "Christie", exchange, revision: 2 });
    const attempts = await Promise.allSettled([
      exchanges.approve({ user: "Alex", exchange, revision: 2 }), offer(exchange, 2, "Christie", "changed-card"),
    ]);
    expect(attempts.filter(result => result.status === "fulfilled")).toHaveLength(1);
    const summary = (await exchanges._byUser({ user: "Christie" }))[0]!.summary;
    if (summary.status === "ACTIVE") expect(summary).toMatchObject({ revision: 2, ownItem: "christie-card" });
    else expect(summary).toMatchObject({ revision: 3, ownItem: "changed-card", ownApproved: false, otherApproved: false });
  });

  test("ending an unclaimed invitation prevents later joining or offer changes", async () => {
    const { invitation, exchange } = await open();
    await exchanges.end({ user: "Christie", exchange });
    await expect(exchanges.join({ user: "Alex", invitation })).rejects.toThrow(InvitationUnavailable);
    await expect(offer(exchange, 1, "Christie")).rejects.toThrow(OfferUnavailable);
    await expect(exchanges.open({ first: "Christie", item: "card", preview: " " })).rejects.toThrow(InvalidInvitation);
  });
});
