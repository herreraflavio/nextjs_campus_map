// lib/mongodb.js or lib/mongodb.ts
import { MongoClient } from "mongodb";

const MONGO_CONNECT_RETRY_DELAYS_MS = [200, 700, 1500];

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mongoUri(): string {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not configured");
  }
  return uri;
}

async function connectWithRetry(): Promise<MongoClient> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= MONGO_CONNECT_RETRY_DELAYS_MS.length; attempt += 1) {
    const client = new MongoClient(mongoUri());

    try {
      return await client.connect();
    } catch (error) {
      lastError = error;
      await client.close().catch(() => undefined);

      const retryDelay = MONGO_CONNECT_RETRY_DELAYS_MS[attempt];
      if (retryDelay == null) break;

      console.warn(
        `[mongodb] Connection attempt ${attempt + 1} failed; retrying in ${retryDelay}ms.`,
        error,
      );
      await delay(retryDelay);
    }
  }

  console.error("[mongodb] Connection failed after retries.", lastError);
  throw lastError instanceof Error
    ? lastError
    : new Error("MongoDB connection failed");
}

function createConnectionPromise(): Promise<MongoClient> {
  return connectWithRetry().catch((error) => {
    global._mongoClientPromise = undefined;
    throw error;
  });
}

export function getMongoClient(): Promise<MongoClient> {
  if (!global._mongoClientPromise) {
    global._mongoClientPromise = createConnectionPromise();
  }

  return global._mongoClientPromise;
}

const clientPromise = getMongoClient();

export default clientPromise;
