import clientPromise from "./mongodb.js";
import bcrypt from "bcryptjs";

export async function findUserByEmail(email) {
  const db = (await clientPromise).db();
  return db.collection("users").findOne({ email });
}

export async function createUser({ email, password }) {
  const db = (await clientPromise).db();
  const hashed = await bcrypt.hash(password, 12);
  const res = await db
    .collection("users")
    .insertOne({ email, password: hashed });
  return { _id: res.insertedId, email };
}

export async function verifyUser({ email, password }) {
  const user = await findUserByEmail(email);
  if (!user) return null;
  const match = await bcrypt.compare(password, user.password);
  return match ? user : null;
}
