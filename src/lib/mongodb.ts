// import { MongoClient } from "mongodb";

// let client;
// let clientPromise;

// if (!global._mongoClientPromise) {
//   client = new MongoClient(process.env.MONGODB_URI);
//   global._mongoClientPromise = client.connect();
// }
// clientPromise = global._mongoClientPromise;

// export default clientPromise; // used by the adapter

// lib/mongodb.js or lib/mongodb.ts
import { MongoClient, MongoClientOptions } from "mongodb";

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

if (!global._mongoClientPromise) {
  client = new MongoClient(process.env.MONGODB_URI as string);
  global._mongoClientPromise = client.connect();
}

clientPromise = global._mongoClientPromise as Promise<MongoClient>;

export default clientPromise;
