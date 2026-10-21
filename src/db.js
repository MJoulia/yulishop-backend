import mongoose from "mongoose";

mongoose.set("strictQuery", true);

// NoSQL-injection protection lives in the zod schemas: every value taken from the request is
// validated as a plain string/number, so payloads like ?brand[$ne]=x are rejected with 400.
export async function connectDb(uri) {
  await mongoose.connect(uri);
  return mongoose.connection;
}
