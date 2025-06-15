// types/global.d.ts

export {};

declare global {
  var _mongoClientPromise: Promise<import("mongodb").MongoClient> | undefined;
}
