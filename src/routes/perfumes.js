import express from "express";
import Perfume from "../models/Perfume.js";
import { asyncHandler, validate } from "../middlewares/error.js";
import { perfumeListQuery } from "../validation.js";

// Public, read-only catalogue. Writes live in admin.perfumes.js.
const router = express.Router();

const isObjectId = (v = "") => /^[0-9a-fA-F]{24}$/.test(String(v));
export const findByIdOrSlug = (idOrSlug) =>
  Perfume.findOne(isObjectId(idOrSlug) ? { _id: idOrSlug } : { slug: String(idOrSlug) });

const SORTS = {
  rating: { ratingAvg: -1, ratingCount: -1 },
  price_asc: { priceCents: 1, ratingAvg: -1 },
  price_desc: { priceCents: -1, ratingAvg: -1 },
  recent: { createdAt: -1 },
};

export function buildPerfumeFilter({ search, brand, family, minPriceCents, maxPriceCents }) {
  const where = {};
  if (brand) where.brand = brand;
  if (family) {
    const list = family.split(",").map((s) => s.trim()).filter(Boolean);
    if (list.length) where.olfactoryFamilies = { $in: list };
  }
  if (search) where.$text = { $search: search };
  if (minPriceCents !== undefined || maxPriceCents !== undefined) {
    where.priceCents = {};
    if (minPriceCents !== undefined) where.priceCents.$gte = minPriceCents;
    if (maxPriceCents !== undefined) where.priceCents.$lte = maxPriceCents;
  }
  return where;
}

/* GET /api/perfumes — returns an array; the total is in the X-Total-Count header. */
router.get(
  "/",
  validate(perfumeListQuery, "query"),
  asyncHandler(async (req, res) => {
    const q = req.validatedQuery;
    const where = buildPerfumeFilter(q);
    const [docs, total] = await Promise.all([
      Perfume.find(where).sort(SORTS[q.sort]).skip(q.offset).limit(q.limit).lean(),
      Perfume.countDocuments(where),
    ]);
    res.set("X-Total-Count", String(total));
    res.json(docs);
  })
);

/* GET /api/perfumes/:idOrSlug */
router.get(
  "/:idOrSlug",
  asyncHandler(async (req, res) => {
    const perfume = await findByIdOrSlug(req.params.idOrSlug).lean();
    if (!perfume) return res.status(404).json({ message: "Perfume not found" });
    res.json(perfume);
  })
);

export default router;
