// import clientPromise from "./mongodb.js";
// import bcrypt from "bcryptjs";

// export async function findUserByEmail(email) {
//   const db = (await clientPromise).db();
//   return db.collection("users").findOne({ email });
// }

// export async function createUser({ email, password }) {
//   const db = (await clientPromise).db();
//   const hashed = await bcrypt.hash(password, 12);
//   const res = await db
//     .collection("users")
//     .insertOne({ email, password: hashed });
//   return { _id: res.insertedId, email };
// }

// export async function verifyUser({ email, password }) {
//   const user = await findUserByEmail(email);
//   if (!user) return null;
//   const match = await bcrypt.compare(password, user.password);
//   return match ? user : null;
// }
// lib/userModel.ts
import clientPromise from "./mongodb";
import bcrypt from "bcryptjs";
import { ObjectId, Db, Collection } from "mongodb";

// Define the User interface
interface User {
  _id?: ObjectId;
  email: string;
  password: string;
  maps: ObjectId[];
}

async function getUsersCollection(): Promise<Collection<User>> {
  const db = (await clientPromise).db();
  return db.collection<User>("users");
}

export async function findUserByEmail(email: string) {
  const users = await getUsersCollection();
  return users.findOne({ email });
}

export async function createUser({
  email,
  password,
}: {
  email: string;
  password: string;
}) {
  const users = await getUsersCollection();
  const hashed = await bcrypt.hash(password, 12);
  const res = await users.insertOne({ email, password: hashed, maps: [] });
  return { _id: res.insertedId, email, maps: [] };
}

export async function verifyUser({
  email,
  password,
}: {
  email: string;
  password: string;
}) {
  const user = await findUserByEmail(email);
  if (!user) return null;
  const match = await bcrypt.compare(password, user.password);
  return match ? user : null;
}

export async function addMapToUserByEmail(email: string, mapId: string) {
  const users = await getUsersCollection();
  const result = await users.updateOne(
    { email },
    { $push: { maps: new ObjectId(mapId) } }
  );
  if (result.matchedCount === 0) {
    throw new Error(`No user found with email "${email}"`);
  }
}
