import express from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import morgan from "morgan";
import mongoose from "mongoose";
import rateLimit from "express-rate-limit";
import swaggerUi from "swagger-ui-express";
import { readFileSync } from "node:fs";
import YAML from "yaml";

import config from "./config.js";
import authRouter from "./routes/auth.js";
import perfumesRouter from "./routes/perfumes.js";
import reviewsRouter from "./routes/reviews.js";
import ordersRouter from "./routes/orders.js";
import adminPerfumesRouter from "./routes/admin.perfumes.js";
import adminOrdersRouter from "./routes/admin.orders.js";
import { notFound, errorHandler } from "./middlewares/error.js";

const openapi = YAML.parse(readFileSync(new URL("../openapi.yaml", import.meta.url), "utf8"));

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(
    cors({
      origin(origin, cb) {
        // Allow same-origin / server-to-server requests (no Origin header) and the configured front ends.
        if (!origin || config.corsOrigins.includes(origin)) return cb(null, true);
        return cb(null, false);
      },
    })
  );
  app.use(compression());
  if (!config.isTest) app.use(morgan(config.isProd ? "combined" : "dev"));
  app.use(express.json({ limit: "1mb" }));

  // Brute-force protection on login/register.
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: config.isTest ? 1000 : 20,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { message: "Too many attempts, please try again later" },
  });

  app.get("/", (_req, res) => res.json({ ok: true, name: "YuliShop API", version: "2.0.0", docs: "/api/docs" }));
  app.get("/healthz", (_req, res) => {
    const db = mongoose.connection.readyState === 1 ? "connected" : "disconnected";
    res.status(db === "connected" ? 200 : 503).json({ ok: db === "connected", uptime: process.uptime(), db });
  });

  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openapi));
  app.get("/api/openapi.json", (_req, res) => res.json(openapi));

  app.use("/api/auth", authLimiter, authRouter);
  app.use("/api/perfumes", perfumesRouter);
  app.use("/api", reviewsRouter);
  app.use("/api/orders", ordersRouter);
  app.use("/api/admin/perfumes", adminPerfumesRouter);
  app.use("/api/admin/orders", adminOrdersRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
