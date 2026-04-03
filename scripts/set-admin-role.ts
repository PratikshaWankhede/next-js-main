import "dotenv/config";
import { MongoClient } from "mongodb";
import { USER } from "../db/collections";

const uri = process.env.MONGODB_URI!;
if (!uri) {
  console.error("MONGODB_URI is not set");
  process.exit(1);
}

const client = new MongoClient(uri);
const db = client.db();

async function main() {
  const email = process.argv[2] ?? "admin@example.com";
  await client.connect();

  const result = await db
    .collection(USER)
    .findOneAndUpdate(
      { email },
      { $set: { role: "admin", updatedAt: new Date() } },
      { returnDocument: "after" },
    );

  await client.close();

  if (result) {
    const r = result as unknown as { email: string; role: string };
    console.log(`Updated ${r.email} role to: ${r.role}`);
  } else {
    console.log(`No user found with email: ${email}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
