import { MongoServerError, type Collection, type Db } from "mongodb";

export class ItemRegistered extends Error {}
export class NotItemOwner extends Error {}
interface OwnedItem { _id: string; owner: string }
interface Scope { _id: string; revoked: boolean; grants: { item: string; viewer: string }[] }

export class SharingConcept {
  private readonly items: Collection<OwnedItem>;
  private readonly scopes: Collection<Scope>;
  constructor(db: Db) {
    this.items = db.collection<OwnedItem>("sharing.items");
    this.scopes = db.collection<Scope>("sharing.scopes");
  }

  async register({ owner, item }: { owner: string; item: string }): Promise<Record<string, never>> {
    try {
      await this.items.insertOne({ _id: item, owner });
    } catch (error) {
      if (error instanceof MongoServerError && error.code === 11000) {
        if (await this.items.findOne({ _id: item, owner })) return {};
        throw new ItemRegistered("This item already has another owner.");
      }
      throw error;
    }
    return {};
  }

  async grant({ owner, viewer, item, scope }: { owner: string; viewer: string; item: string; scope: string }): Promise<Record<string, never>> {
    if (!(await this.items.findOne({ _id: item, owner }))) throw new NotItemOwner("Only the owner can grant access.");
    await this.scopes.updateOne({ _id: scope }, { $setOnInsert: { revoked: false, grants: [] } }, { upsert: true });
    await this.scopes.updateOne({ _id: scope, revoked: false }, { $addToSet: { grants: { item, viewer } } });
    return {};
  }

  async revoke({ scope }: { scope: string }): Promise<Record<string, never>> {
    // Revocation and grants change the same document. A late grant cannot
    // resurrect a permanently closed scope, including after a restart.
    await this.scopes.updateOne({ _id: scope }, { $set: { revoked: true, grants: [] } }, { upsert: true });
    return {};
  }

  async _readable({ viewer, item }: { viewer: string; item: string }): Promise<{ allowed: boolean }> {
    const owned = await this.items.findOne({ _id: item });
    if (!owned) return { allowed: false };
    return { allowed: owned.owner === viewer || !!(await this.scopes.findOne({ revoked: false, grants: { $elemMatch: { item, viewer } } })) };
  }

  async _owned({ viewer, item }: { viewer: string; item: string }): Promise<{ owned: boolean }> {
    return { owned: !!(await this.items.findOne({ _id: item, owner: viewer })) };
  }

  async _scopes({ viewer, item }: { viewer: string; item: string }): Promise<{ scope: string }[]> {
    if (!(await this.items.findOne({ _id: item }))) return [];
    return (await this.scopes.find({ revoked: false, grants: { $elemMatch: { item, viewer } } }).sort({ _id: 1 }).toArray())
      .map(row => ({ scope: row._id }));
  }

  async _revoked({ scope }: { scope: string }): Promise<{ revoked: boolean }> {
    return { revoked: !!(await this.scopes.findOne({ _id: scope, revoked: true })) };
  }
}
