import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI!;
if (!uri) {
  throw new Error("MONGODB_URI is not set");
}

const client = new MongoClient(uri);

// NextAuth's MongoDB adapter expects a Promise<MongoClient>.
export const mongoClientPromise = client.connect().then(() => client);

export const db = client.db();
export { client as mongoClient };
