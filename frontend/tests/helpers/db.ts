import { MongoClient } from "mongodb";
import path from "path";
import fs from "fs";

function getDbInfo(): { mongoUri: string; dbName: string } {
  const dbInfoPath = path.join(__dirname, "../.test-db-info.json");
  return JSON.parse(fs.readFileSync(dbInfoPath, "utf-8"));
}

async function withDb<T>(fn: (db: ReturnType<MongoClient["db"]>) => Promise<T>): Promise<T> {
  const { mongoUri, dbName } = getDbInfo();
  const client = new MongoClient(mongoUri);
  try {
    await client.connect();
    return await fn(client.db(dbName));
  } finally {
    await client.close();
  }
}

export async function getPasswordResetToken(
  email: string,
): Promise<string | null> {
  return withDb(async (db) => {
    const user = await db
      .collection("users")
      .findOne({ email: email.toLowerCase() });
    return user?.password_reset_token ?? null;
  });
}

export async function getInviteToken(email: string): Promise<string | null> {
  return withDb(async (db) => {
    const user = await db
      .collection("users")
      .findOne({ email: email.toLowerCase() });
    if (!user) return null;
    const membership = await db.collection("memberships").findOne({
      user_id: user._id.toString(),
      invitation_status: "pending",
    });
    return membership?.invite_token ?? null;
  });
}
