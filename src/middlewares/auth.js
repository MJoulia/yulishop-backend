// middleware/auth.js
const jwt = require("jsonwebtoken");
const { User } = require("../models/User.js");

// petit util: message uniforme
const ERR = {
  MISSING: { status: 401, msg: "Token manquant" },
  INVALID: { status: 401, msg: "Token invalide ou expiré" },
  UNAUTH:  { status: 401, msg: "Non authentifié" },
  FORBID:  { status: 403, msg: "Accès refusé (rôle insuffisant)" },
};

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
if (!process.env.JWT_SECRET) {
  console.warn("[auth] JWT_SECRET non défini – utilisation d'un secret de dev (à NE PAS utiliser en prod).");
}

/**
 * Exige un JWT "Authorization: Bearer <token>"
 * - Vérifie l'algo et tolère un petit drift d'horloge
 * - Charge l'utilisateur en DB (et refuse si absent/inactif)
 * - Attache req.user = { _id, role, email, ... }
 */
async function requireAuth(req, res, next) {
  try {
    const h = (req.headers.authorization || "").trim();
    const token = h.toLowerCase().startsWith("bearer ") ? h.slice(7) : null;
    if (!token) return res.status(ERR.MISSING.status).json({ message: ERR.MISSING.msg });

    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET, {
        algorithms: ["HS256"],       // adapte à ton algo
        clockTolerance: 30,          // secondes de tolérance
      });
    } catch {
      return res.status(ERR.INVALID.status).json({ message: ERR.INVALID.msg });
    }

    const userId = payload.sub || payload.id || payload.userId;
    if (!userId) return res.status(ERR.INVALID.status).json({ message: ERR.INVALID.msg });

    // Charge l'user (sélection minimale)
    const user = await User.findById(userId).select("_id role email firstName lastName isActive");
    if (!user || user.isActive === false) {
      return res.status(ERR.UNAUTH.status).json({ message: ERR.UNAUTH.msg });
    }

    // Attache un objet user standardisé
    req.user = {
      _id: user._id,
      role: user.role,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    };

    return next();
  } catch (e) {
    console.error("[requireAuth]", e);
    return res.status(ERR.INVALID.status).json({ message: ERR.INVALID.msg });
  }
}

/**
 * Exige un rôle unique (ex: "admin")
 */
function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) return res.status(ERR.UNAUTH.status).json({ message: ERR.UNAUTH.msg });
    if (req.user.role !== role) {
      return res.status(ERR.FORBID.status).json({ message: ERR.FORBID.msg });
    }
    next();
  };
}

/**
 * Exige au moins un rôle parmi la liste (ex: admin OU moderator)
 */
function requireAnyRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(ERR.UNAUTH.status).json({ message: ERR.UNAUTH.msg });
    if (!roles.includes(req.user.role)) {
      return res.status(ERR.FORBID.status).json({ message: ERR.FORBID.msg });
    }
    next();
  };
}

module.exports = {
  requireAuth,
  requireRole,
  requireAnyRole,
};
