import "dotenv/config";
import { MongoClient } from "mongodb";
import bcrypt from "bcryptjs";
import { USER } from "../db/collections";
import { generateRandomUUID } from "../helpers/generate-random-uuid";

const uri = process.env.MONGODB_URI!;
if (!uri) {
  console.error("MONGODB_URI is not set");
  process.exit(1);
}

const client = new MongoClient(uri);
const db = client.db();

const seedUsers = [
  {
    name: "Admin User",
    email: "yogeshoza33333@gmail.com",
    password: "Yogesh@12345",
    role: "admin" as const,
  },
  {
    name: "Sales User",
    email: "sales@example.com",
    password: "Sales123!@#",
    role: "sales" as const,
  },
];

async function seed() {
  const forceRecreate = process.argv.includes("--force");
  await client.connect();
  const userCol = db.collection(USER);

  for (const seedUser of seedUsers) {
    const existingUser = await userCol.findOne({ email: seedUser.email });

    if (existingUser) {
      if (forceRecreate) {
        await userCol.deleteOne({ email: seedUser.email });
      } else {
        console.log(
          `User "${seedUser.email}" already exists, skipping... (use --force to recreate)`,
        );
        continue;
      }
    }

    const passwordHash = await bcrypt.hash(seedUser.password, 12);
    const now = new Date();
    const userId = generateRandomUUID();
    const newUser = {
      id: userId,
      name: seedUser.name,
      email: seedUser.email.toLowerCase(),
      emailVerified: true,
      role: seedUser.role,
      createdAt: now,
      updatedAt: now,
      passwordHash,
    };
    await userCol.insertOne(newUser);

    console.log(`Created user: ${seedUser.email}`);
  }

  await client.close();
  console.log("\nSeed completed!");
  console.log("\nYou can now sign in with:");
  console.log(
    "Admin - Email: yogeshoza33333@gmail.com, Password: Yogesh@12345",
  );
  console.log("Sales - Email: sales@example.com, Password: Sales123!@#");
}

seed().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
