import { createHash, randomBytes } from "node:crypto";
import type { Collection, Db } from "mongodb";

export class UnknownSession extends Error {}
interface Session { _id: string; subject: string; expiresAt: Date }
const digest = (token: string) => createHash("sha256").update(token).digest("hex");

export class SessioningConcept {
  private readonly sessions: Collection<Session>;
  private indexes?: Promise<string>;
  constructor(db: Db, private readonly clock: () => Date = () => new Date()) {
    this.sessions = db.collection<Session>("sessioning.sessions");
  }

  async start({ subject }: { subject: string }): Promise<{ session: string; expiresAt: Date }> {
    await (this.indexes ??= this.sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }).catch(error => {
      this.indexes = undefined;
      throw error;
    }));
    const session = randomBytes(32).toString("base64url");
    const expiresAt = new Date(this.clock().getTime() + 30 * 60 * 1000);
    await this.sessions.insertOne({ _id: digest(session), subject, expiresAt });
    return { session, expiresAt };
  }

  async current({ session }: { session: string | null }): Promise<{ subject: string }> {
    const record = session ? await this.sessions.findOne({ _id: digest(session), expiresAt: { $gt: this.clock() } }) : null;
    if (!record) throw new UnknownSession("Please sign in to continue.");
    return { subject: record.subject };
  }

  async end({ session }: { session: string | null }): Promise<{ ended: boolean }> {
    if (session) await this.sessions.deleteOne({ _id: digest(session) });
    return { ended: true };
  }
}
