import jwt from "jsonwebtoken";
import config from "../config.js";
import User from "../models/User.js";

const ERR = {
  MISSING: { status: 401, message: "Missing token" },
  INVALID: { status: 401, message: "Invalid or expired token" },
  FORBID: { status: 403, message: "Insufficient role" },
};

export function signToken(user) {
  return jwt.sign({ sub: String(user._id), role: user.role }, config.jwtSecret, {
    algorithm: "HS256",
    expiresIn: config.jwtExpiresIn,
  });
}

function readBearer(req) {
  const h = (req.headers.authorization || "").trim();
  return h.toLowerCase().startsWith("bearer ") ? h.slice(7).trim() : null;
}

async function loadUser(token) {
  const payload = jwt.verify(token, config.jwtSecret, { algorithms: ["HS256"], clockTolerance: 30 });
  if (!payload.sub) return null;
  const user = await User.findById(payload.sub).select("_id role email firstName lastName isActive");
  return user && user.isActive !== false ? user : null;
}

/** Requires "Authorization: Bearer <token>" and attaches req.user. */
export async function requireAuth(req, res, next) {
  const token = readBearer(req);
  if (!token) return res.status(ERR.MISSING.status).json({ message: ERR.MISSING.message });
  try {
    const user = await loadUser(token);
    if (!user) return res.status(ERR.INVALID.status).json({ message: ERR.INVALID.message });
    req.user = user;
    next();
  } catch {
    res.status(ERR.INVALID.status).json({ message: ERR.INVALID.message });
  }
}

/** Attaches req.user when a valid token is present, but never rejects. */
export async function optionalAuth(req, _res, next) {
  const token = readBearer(req);
  if (token) {
    try {
      req.user = (await loadUser(token)) || undefined;
    } catch {
      req.user = undefined;
    }
  }
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(ERR.MISSING.status).json({ message: ERR.MISSING.message });
    if (!roles.includes(req.user.role)) return res.status(ERR.FORBID.status).json({ message: ERR.FORBID.message });
    next();
  };
}
