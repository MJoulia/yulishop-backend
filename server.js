import mongoose from "mongoose";
import config from "./src/config.js";
import { connectDb } from "./src/db.js";
import { createApp } from "./src/app.js";

try {
  await connectDb(config.mongoUri);
  console.log("MongoDB connected");
} catch (err) {
  console.error("MongoDB connection failed:", err.message);
  process.exit(1);
}

const server = createApp().listen(config.port, () => {
  console.log(`YuliShop API listening on port ${config.port} (${config.env})`);
});

async function shutdown(signal, code = 0) {
  console.log(`${signal} received, shutting down`);
  const force = setTimeout(() => process.exit(1), 10_000);
  force.unref();
  server.close(async () => {
    await mongoose.connection.close().catch(() => {});
    process.exit(code);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("unhandledRejection", (reason) => console.error("Unhandled rejection:", reason));
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
  shutdown("uncaughtException", 1);
});
