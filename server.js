import "dotenv/config";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import morgan from "morgan";
import helmet from "helmet";

// ---- Config ----
const PORT = process.env.PORT || 5124;
const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/yulishop";

// ---- App ----
const app = express();

// Sécurité/headers de base
app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
);

// CORS
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || true,
    credentials: true,
  })
);

// Logs
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

// Body parsers
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// ---- DB ----
mongoose.set("strictQuery", true);
try {
  await mongoose.connect(MONGODB_URI, {});
  console.log("✅ MongoDB connecté:", MONGODB_URI);
} catch (err) {
  console.error("❌ Erreur connexion MongoDB:", err.message);
  process.exit(1);
}

// ---- Routes de base ----
app.get("/", (_req, res) => {
  res.json({ ok: true, name: "YuliShop API", version: "1.0.0" });
});

app.get("/healthz", (_req, res) => {
  const state = mongoose.connection.readyState; // 1 = connected
  res.json({
    ok: true,
    uptime: process.uptime(),
    db: state === 1 ? "connected" : "disconnected",
  });
});

// ---- Routes spécifiques ----
import authRouter from "./src/routes/auth.js";
app.use("/api/auth", authRouter);

import perfumesRouter from "./src/routes/perfumes.js";
app.use("/api/perfumes", perfumesRouter);

import reviewsRoutes from "./src/routes/reviews.js";
app.use("/api", reviewsRoutes);

// ==== Post model & endpoints ====
import Post from "./src/models/post.model.js";

// Créer un post (image)
app.post("/api/uploads", async (req, res) => {
  try {
    const newImage = await Post.create(req.body);
    res.status(201).json({ msg: "New image uploaded...", data: newImage });
  } catch (error) {
    res.status(409).json({ message: error.message });
  }
});

// Lister les posts (images)
app.get("/api/uploads", async (_req, res) => {
  try {
    const data = await Post.find({});
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ---- 404 ----
app.use((req, res, _next) => {
  res.status(404).json({ message: "Route non trouvée", path: req.originalUrl });
});

// ---- Error handler ----
app.use((err, _req, res, _next) => {
  console.error("💥 ERREUR:", err);
  const status = err.status || 500;
  res.status(status).json({
    message: err.message || "Erreur serveur",
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
  });
});

// ---- Start ----
const server = app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
});

// ---- Arrêt propre ----
async function gracefulShutdown(signal) {
  console.log(`\n🛑 Reçu ${signal}. Fermeture en cours...`);
  server.close(async () => {
    console.log("HTTP server fermé.");
    try {
      await mongoose.connection.close();
      console.log("MongoDB déconnecté.");
    } catch (e) {
      console.error("Erreur à la fermeture MongoDB:", e);
    } finally {
      process.exit(signal === "uncaughtException" ? 1 : 0);
    }
  });
  setTimeout(() => {
    console.warn("Forçage de l'arrêt.");
    process.exit(1);
  }, 10_000);
}

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  gracefulShutdown("uncaughtException");
});