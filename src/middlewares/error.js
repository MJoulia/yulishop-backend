import { ZodError } from "zod";
import mongoose from "mongoose";
import config from "../config.js";

export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

/** Wraps an async route so rejected promises reach the error handler. */
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Validates req[source] against a zod schema and replaces it with the parsed value. */
export const validate = (schema, source = "body") => (req, _res, next) => {
  const parsed = schema.safeParse(req[source]);
  if (!parsed.success) return next(parsed.error);
  if (source === "query") req.validatedQuery = parsed.data;
  else req[source] = parsed.data;
  next();
};

export function notFound(req, res) {
  res.status(404).json({ message: "Route not found", path: req.originalUrl });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      message: "Validation failed",
      errors: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
  }
  if (err instanceof mongoose.Error.ValidationError) {
    return res.status(400).json({
      message: "Validation failed",
      errors: Object.values(err.errors).map((e) => ({ path: e.path, message: e.message })),
    });
  }
  if (err instanceof mongoose.Error.CastError) {
    return res.status(400).json({ message: `Invalid ${err.path}` });
  }
  if (err?.code === 11000) {
    return res.status(409).json({ message: "Duplicate value", fields: Object.keys(err.keyPattern || {}) });
  }
  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({ message: "Malformed JSON body" });
  }
  if (err?.name === "MulterError" || err?.message?.startsWith("Only PNG")) {
    return res.status(400).json({ message: err.message });
  }

  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({
    message: status >= 500 ? "Internal server error" : err.message,
    ...(err.details && { details: err.details }),
    ...(!config.isProd && status >= 500 && { stack: err.stack }),
  });
}
