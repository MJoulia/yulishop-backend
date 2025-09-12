// src/routes/perfumes.js
import { Router } from "express";

import Review from "../models/Review.js";

const router = Router();

/* -------------------- Helpers -------------------- */
const isObjectId = (v = "") => /^[0-9a-fA-F]{24}$/.test(String(v));

function slugify(str) {
  return String(str)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/* -------------------- GET /api/perfumes -------------------- */

router.get("/", async (req, res, next) => {
  try {
    const {
      search,
      brand,
      family,
      minPriceCents,
      maxPriceCents,
      sort = "rating",
      limit = 20,
      offset = 0,
    } = req.query;

    const where = {};
    if (brand) where.brand = brand;

    if (family) {
      const list = String(family).split(",").map((s) => s.trim()).filter(Boolean);
      if (list.length) where.olfactoryFamilies = { $in: list };
    }

    // full‑text: pense à créer l'index dans server.js
    if (search) where.$text = { $search: String(search) };

    // Filtres prix (champ simple). Si tu utilises des variantes, filtre côté agrégations.
    if (minPriceCents || maxPriceCents) {
      where.priceCents = {};
      if (minPriceCents) where.priceCents.$gte = Number(minPriceCents);
      if (maxPriceCents) where.priceCents.$lte = Number(maxPriceCents);
    }

    const sortMap = {
      rating: { ratingAvg: -1, ratingCount: -1 },
      price_asc: { priceCents: 1, ratingAvg: -1 },
      price_desc: { priceCents: -1, ratingAvg: -1 },
      recent: { createdAt: -1 },
    };

    const docs = await Perfume.find(where)
      .sort(sortMap[sort] || sortMap.rating)
      .skip(Math.max(0, Number(offset)))
      .limit(Math.min(100, Math.max(1, Number(limit))));

    res.json(docs);
  } catch (err) {
    next(err);
  }
});

/* -------------------- GET /api/perfumes/:idOrSlug -------------------- */
router.get("/:idOrSlug", async (req, res, next) => {
  try {
    const { idOrSlug } = req.params;
    const doc = await Perfume.findOne(
      isObjectId(idOrSlug) ? { _id: idOrSlug } : { slug: idOrSlug }
    );
    if (!doc) return res.status(404).json({ message: "Parfum introuvable" });
    res.json(doc);
  } catch (err) {
    next(err);
  }
});

/* -------- GET /api/perfumes/:idOrSlug/reviews (liste paginée) -------- */
/**
 * Query params:
 *  - status=visible|hidden|pending (défaut: visible)
 *  - rating=1..5 (optionnel)
 *  - sort=recent|best (défaut: recent)
 *  - limit (<=100), offset
 */
router.get("/:idOrSlug/reviews", async (req, res, next) => {
  try {
    const { idOrSlug } = req.params;
    const perfume = await Perfume.findOne(
      isObjectId(idOrSlug) ? { _id: idOrSlug } : { slug: idOrSlug }
    );
    if (!perfume) return res.status(404).json({ message: "Parfum introuvable" });

    const {
      status = "visible",
      rating,
      sort = "recent",
      limit = 20,
      offset = 0,
    } = req.query;

    const where = { perfume: perfume._id, status };
    if (rating) where.rating = Number(rating);

    const sortMap = {
      recent: { createdAt: -1 },
      best: { rating: -1, createdAt: -1 },
    };

    const items = await Review.find(where)
      .sort(sortMap[sort] || sortMap.recent)
      .skip(Math.max(0, Number(offset)))
      .limit(Math.min(100, Math.max(1, Number(limit))));

    const total = await Review.countDocuments(where);
    res.json({ items, total });
  } catch (err) {
    next(err);
  }
});