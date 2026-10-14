import { randomBytes } from "node:crypto";
import type { Collection, Db } from "mongodb";

export class InvalidInvitation extends Error {}
export class InvitationUnavailable extends Error {}
export class OfferUnavailable extends Error {}
export class ApprovalUnavailable extends Error {}
export class EndUnavailable extends Error {}

type Status = "OPEN" | "ACTIVE" | "ENDED";
interface Exchange {
  _id: string; invitation: string; first: string; second: string | null;
  firstItem: string; firstPreview: string; secondItem: string | null; secondPreview: string | null;
  revision: number; approvals: string[]; status: Status;
}
export interface ExchangeSummary {
  invitation: string | null; ownItem: string | null; ownPreview: string | null;
  otherPreview: string | null; revision: number; status: Status;
  ownApproved: boolean; otherApproved: boolean;
}
const validPreview = (preview: string) => typeof preview === "string" && preview.trim().length > 0 && preview.length <= 200;

export class ExchangingConcept {
  private readonly exchanges: Collection<Exchange>;
  private indexes?: Promise<string>;
  constructor(db: Db) { this.exchanges = db.collection<Exchange>("exchanging.exchanges"); }

  async open({ first, item, preview }: { first: string; item: string; preview: string }): Promise<{ exchange: string; invitation: string }> {
    if (!item || !validPreview(preview)) throw new InvalidInvitation("Choose an item with a short preview.");
    await (this.indexes ??= this.exchanges.createIndex({ invitation: 1 }, { unique: true }).catch(error => {
      this.indexes = undefined;
      throw error;
    }));
    const exchange = crypto.randomUUID();
    const invitation = randomBytes(32).toString("base64url");
    await this.exchanges.insertOne({ _id: exchange, invitation, first, second: null,
      firstItem: item, firstPreview: preview, secondItem: null, secondPreview: null,
      revision: 1, approvals: [], status: "OPEN" });
    return { exchange, invitation };
  }

  async join({ user, invitation }: { user: string; invitation: string }): Promise<{ exchange: string }> {
    const row = await this.exchanges.findOneAndUpdate(
      { invitation, status: "OPEN", second: null, first: { $ne: user } },
      { $set: { second: user } }, { returnDocument: "after" });
    if (!row) throw new InvitationUnavailable("This invitation cannot be joined. It may already be claimed or ended.");
    return { exchange: row._id };
  }

  async offer({ user, exchange, item, preview, revision }: {
    user: string; exchange: string; item: string; preview: string; revision: number;
  }): Promise<{ exchange: string; revision: number }> {
    if (!item || !validPreview(preview) || !Number.isSafeInteger(revision) || revision < 1)
      throw new OfferUnavailable("The offer could not be changed. Reload the current exchange and try again.");
    // The revision, participant, and status are checked in the write itself.
    const first = await this.exchanges.findOneAndUpdate(
      { _id: exchange, status: "OPEN", revision, first: user },
      { $set: { firstItem: item, firstPreview: preview, approvals: [] }, $inc: { revision: 1 } },
      { returnDocument: "after" });
    const row = first ?? await this.exchanges.findOneAndUpdate(
      { _id: exchange, status: "OPEN", revision, second: user },
      { $set: { secondItem: item, secondPreview: preview, approvals: [] }, $inc: { revision: 1 } },
      { returnDocument: "after" });
    if (!row) throw new OfferUnavailable("The offer could not be changed. Reload the current exchange and try again.");
    return { exchange, revision: row.revision };
  }

  async approve({ user, exchange, revision }: { user: string; exchange: string; revision: number }): Promise<{ exchange: string; status: Status }> {
    const row = await this.exchanges.findOneAndUpdate(
      { _id: exchange, status: "OPEN", revision, secondItem: { $ne: null }, $or: [{ first: user }, { second: user }] },
      [
        { $set: { approvals: { $setUnion: ["$approvals", { $literal: [user] }] } } },
        { $set: { status: { $cond: [{ $eq: [{ $size: "$approvals" }, 2] }, "ACTIVE", "OPEN"] } } },
      ], { returnDocument: "after" });
    if (!row) throw new ApprovalUnavailable("The exchange cannot be approved at this revision.");
    return { exchange, status: row.status };
  }

  async end({ user, exchange }: { user: string; exchange: string }): Promise<{ exchange: string }> {
    const row = await this.exchanges.findOneAndUpdate(
      { _id: exchange, status: { $in: ["OPEN", "ACTIVE"] }, $or: [{ first: user }, { second: user }] },
      { $set: { status: "ENDED" } }, { returnDocument: "after" });
    if (!row) throw new EndUnavailable("This exchange cannot be ended by this account.");
    return { exchange };
  }

  async _byUser({ user }: { user: string }): Promise<{ exchange: string; summary: ExchangeSummary }[]> {
    const rows = await this.exchanges.find({ $or: [{ first: user }, { second: user }] }).sort({ _id: 1 }).toArray();
    return rows.map(row => {
      const isFirst = row.first === user;
      const other = isFirst ? row.second : row.first;
      return { exchange: row._id, summary: {
        invitation: isFirst && row.status === "OPEN" && !row.second ? row.invitation : null,
        ownItem: isFirst ? row.firstItem : row.secondItem,
        ownPreview: isFirst ? row.firstPreview : row.secondPreview,
        otherPreview: isFirst ? row.secondPreview : row.firstPreview,
        revision: row.revision, status: row.status,
        ownApproved: row.approvals.includes(user), otherApproved: !!other && row.approvals.includes(other),
      } };
    });
  }

  async _counterparty({ user, exchange }: { user: string; exchange: string }): Promise<{ other: string }[]> {
    const row = await this.exchanges.findOne({ _id: exchange, $or: [{ first: user }, { second: user }] });
    if (!row) return [];
    const other = row.first === user ? row.second : row.first;
    return other ? [{ other }] : [];
  }

  async synchronize({ exchange }: { exchange: string }): Promise<{ exchange: string; status: Status | null }> {
    const row = await this.exchanges.findOne({ _id: exchange });
    return { exchange, status: row?.status ?? null };
  }

  async _lifecycle(): Promise<{ exchange: string; status: Status }[]> {
    return (await this.exchanges.find({ status: { $in: ["ACTIVE", "ENDED"] } }).sort({ _id: 1 }).toArray())
      .map(row => ({ exchange: row._id, status: row.status }));
  }

  async _active({ exchange }: { exchange: string }): Promise<{ active: boolean }> {
    return { active: !!(await this.exchanges.findOne({ _id: exchange, status: "ACTIVE" })) };
  }

  async _participant({ user, exchange }: { user: string; exchange: string }): Promise<{ participant: boolean }> {
    return { participant: !!(await this.exchanges.findOne({ _id: exchange, $or: [{ first: user }, { second: user }] })) };
  }

  async _approvalPair({ user, exchange, revision }: { user: string; exchange: string; revision: number }):
    Promise<{ first: string; second: string; firstItem: string; secondItem: string }[]> {
    const row = await this.exchanges.findOne({ _id: exchange, revision, status: "OPEN", $or: [{ first: user }, { second: user }] });
    return row?.second && row.secondItem ? [{ first: row.first, second: row.second, firstItem: row.firstItem, secondItem: row.secondItem }] : [];
  }

  async _offers({ exchange }: { exchange: string }): Promise<{ owner: string; viewer: string; item: string }[]> {
    const row = await this.exchanges.findOne({ _id: exchange, status: "ACTIVE" });
    return row?.second && row.secondItem ? [
      { owner: row.first, viewer: row.second, item: row.firstItem },
      { owner: row.second, viewer: row.first, item: row.secondItem },
    ] : [];
  }

  async _otherOffer({ user, exchange }: { user: string; exchange: string }): Promise<{ owner: string; card: string }[]> {
    return (await this._offers({ exchange })).filter(row => row.viewer === user).map(row => ({ owner: row.owner, card: row.item }));
  }
}
