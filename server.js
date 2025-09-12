import "dotenv/config";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";

// Routes
import authRoutes from "./src/routes/auth.js";
//import productRoutes from "./src/routes/products.js";
//import reviewRoutes from "./src/routes/reviews.js";

// (facultatif) sécurité de base
// import helmet from "helmet";

const app = express();

// Middlewares
app.use(cors({ origin: process.env.CORS_ORIGIN || "http://localhost:5173", credentials: true }));
// app.use(helmet()); // décommente si tu veux
app.use(express.json({ limit: "1mb" }));

// Healthcheck
app.get("/api/health", (_req, res) => res.json({ ok: true }));

// Mount routes
app.use("/api/auth", authRoutes);
///app.use("/api/perfumes",  productRoutes);
app.use("/api/reviews", reviewRoutes);
app.get("/achraf", (_req, res) => res.send("Ywowow ow owow wowo wow owo wowow owow owwoowowwo"));
// Root
app.get("/", (_req, res) => res.send("YuliShop API is running"));

// 404
app.use((req, res) => res.status(404).json({ message: "Not found" }));

// Error handler (évite de crasher sur une erreur asynchrone)
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(err.status || 500).json({ message: err.message || "Server error" });
});

async function start() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) throw new Error("MONGODB_URI manquant dans .env");

    await mongoose.connect(mongoUri);
    console.log("MongoDB connected");

    // 🔎 index texte pour la recherche ?search=
    // (ne plante pas si déjà créé)
    const { default: Perfume } = await import("./src/models/Perfume.js");
    try {
      await Perfume.collection.createIndex({
        name: "text",
        brand: "text",
        description: "text",
      });
      console.log("Text index ready on perfumes (name, brand, description)");
    } catch (e) {
      console.warn("Index text create skipped:", e?.message || e);
    }

    const port = Number(process.env.PORT) || 5000;
    const server = app.listen(port, () =>
      console.log(`Server on http://localhost:${port}`)
    );

    // Arrêt propre
    const shutdown = async (signal) => {
      console.log(`\n${signal} received, closing...`);
      await mongoose.connection.close();
      server.close(() => process.exit(0));
    };
    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
  } catch (e) {
    console.error("Startup failed:", e);
    process.exit(1);
  }
}
start();
