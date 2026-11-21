import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { E2E_USER } from "./constants";

/** Resets the E2E database and seeds one verified account. */
export default async function globalSetup() {
  const uri = process.env.E2E_MONGODB_URI ?? "mongodb://127.0.0.1:27017/ielts_e2e";
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 });
  const db = mongoose.connection.db!;
  for (const name of ["users", "practiceattempts", "usages", "payments", "adminauditlogs", "mocktests", "contentitems", "audioclips"]) {
    await db.collection(name).deleteMany({});
  }
  await db.collection("users").insertOne({
    email: E2E_USER.email,
    password: await bcrypt.hash(E2E_USER.password, 10),
    emailVerified: true,
    tokenVersion: 0,
    plan: "free",
    targetBand: 7,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await mongoose.disconnect();
}
