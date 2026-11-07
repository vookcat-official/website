import { MongoClient } from "mongodb";

const globalForMongo = globalThis as typeof globalThis & {
  mongoClientPromise?: Promise<MongoClient>;
};

function getMongoClient() {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) throw new Error("Missing required environment variable: MONGODB_URI");

  if (!globalForMongo.mongoClientPromise) {
    const client = new MongoClient(uri);
    globalForMongo.mongoClientPromise = client.connect().catch((error: unknown) => {
      globalForMongo.mongoClientPromise = undefined;
      throw error;
    });
  }
  return globalForMongo.mongoClientPromise;
}

export async function getDatabase() {
  const client = await getMongoClient();
  const name = process.env.MONGODB_DB?.trim() || "vookcat";
  return client.db(name);
}
