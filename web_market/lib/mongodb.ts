import { Db, MongoClient } from "mongodb";

declare global {
  // eslint-disable-next-line no-var
  var mongoClientPromise: Promise<MongoClient> | undefined;
}

function mongoClientPromise() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is required");
  const promise = global.mongoClientPromise || new MongoClient(uri).connect();
  global.mongoClientPromise = promise;
  return promise;
}

export async function mongoDatabase(): Promise<Db> {
  return (await mongoClientPromise()).db(process.env.MONGODB_DB || "bazarek");
}
