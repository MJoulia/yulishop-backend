import "dotenv/config";

const env = process.env.NODE_ENV || "development";
const isProd = env === "production";

function required(name, devFallback) {
  const value = process.env[name];
  if (value) return value;
  if (isProd) throw new Error(`Missing required environment variable ${name}`);
  return devFallback;
}

const config = {
  env,
  isProd,
  isTest: env === "test",
  port: Number(process.env.PORT) || 5124,
  mongoUri: required("MONGODB_URI", "mongodb://127.0.0.1:27017/yulishop"),
  jwtSecret: required("JWT_SECRET", "dev-only-secret-change-me"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  // Comma-separated list of allowed front-end origins, e.g. "https://yulishop.vercel.app"
  corsOrigins: (process.env.CORS_ORIGIN || "http://localhost:5173")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  shipping: {
    standardCents: 490,
    expressCents: 990,
    freeFromCents: 5000,
  },
};

export default config;
