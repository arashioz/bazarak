import { Db, MongoClient } from "mongodb";

declare global {
  // eslint-disable-next-line no-var
  var bazarakMapMongoClient: Promise<MongoClient> | undefined;
}

// Match the web_market backend exactly. In Docker both apps receive the same
// MONGODB_URI; its fallback resolves the Compose service named `mongo`.
const uri = () => process.env.MONGODB_URI || "mongodb://mongo:27017/bazarek";

export const mapDatabase = async (): Promise<Db> => {
  global.bazarakMapMongoClient ||= new MongoClient(uri()).connect();
  return global.bazarakMapMongoClient.then((client) => client.db(process.env.MONGODB_DB || "bazarek"));
};

export type AppState = { _id: "primary"; customers?: unknown[]; mobileServices?: unknown };
