import { MongoClient } from "mongodb";

const globalForMongo = globalThis as typeof globalThis & {
  mongoClientPromise?: Promise<MongoClient>;
};

function getMongoClient() {
  const url = process.env.MONGODB_URL?.trim();
  if (!url) throw new Error("Missing required environment variable: MONGODB_URL");

  if (!globalForMongo.mongoClientPromise) {
    const client = new MongoClient(url);
    globalForMongo.mongoClientPromise = client.connect().catch((error: unknown) => {
      globalForMongo.mongoClientPromise = undefined;
      throw error;
    });
  }
  return globalForMongo.mongoClientPromise;
}

export async function getDatabase() {
  const client = await getMongoClient();
  return client.db();
}
