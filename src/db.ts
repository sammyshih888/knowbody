import { MongoClient } from "mongodb";

// Construction opens no connection, so design checks can run without MongoDB.
export const client = new MongoClient(process.env.MONGODB_URL ??
  "mongodb://dev:dev@127.0.0.1:27018/knowbody?authSource=admin", { serverSelectionTimeoutMS: 5000 });
export const db = client.db();
