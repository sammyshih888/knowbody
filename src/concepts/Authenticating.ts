import { MongoServerError, type Collection, type Db } from "mongodb";

export class InvalidRegistration extends Error {}
export class UsernameTaken extends Error {}
export class InvalidCredentials extends Error {}
interface User { _id: string; username: string; passwordHash: string }

export class AuthenticatingConcept {
  private readonly users: Collection<User>;
  private indexes?: Promise<string>;
  constructor(db: Db) { this.users = db.collection<User>("authenticating.users"); }

  async register({ username, password }: { username: string; password: string }): Promise<{ user: string }> {
    if (!/^[A-Za-z0-9_-]{1,32}$/.test(username) || !password || password.length > 128) {
      throw new InvalidRegistration("Use a username of 1 to 32 letters, numbers, underscores, or hyphens and a password of 1 to 128 characters.");
    }
    await (this.indexes ??= this.users.createIndex({ username: 1 }, { unique: true }).catch(error => {
      this.indexes = undefined;
      throw error;
    }));
    const user = crypto.randomUUID();
    const passwordHash = await Bun.password.hash(password, { algorithm: "argon2id" });
    try {
      await this.users.insertOne({ _id: user, username, passwordHash });
    } catch (error) {
      if (error instanceof MongoServerError && error.code === 11000) throw new UsernameTaken("That username is already registered.");
      throw error;
    }
    return { user };
  }

  async authenticate({ username, password }: { username: string; password: string }): Promise<{ user: string }> {
    const user = await this.users.findOne({ username });
    if (!user || !(await Bun.password.verify(password, user.passwordHash))) {
      throw new InvalidCredentials("The username or password is incorrect.");
    }
    return { user: user._id };
  }

  async _get({ user }: { user: string }): Promise<{ username: string }[]> {
    const record = await this.users.findOne({ _id: user }, { projection: { username: 1 } });
    return record ? [{ username: record.username }] : [];
  }
}
