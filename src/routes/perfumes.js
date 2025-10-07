import express from "express";
import multer from "multer";
import Perfume from "../models/Perfume.js";
import Review from "../models/Review.js";

const router = express.Router();

/* -------------------- Multer (upload en mémoire) -------------------- */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ["image/png", "image/jpeg", "image/webp"].includes(file.mimetype);
    cb(ok ? null : new Error("Only PNG/JPEG/WEBP allowed"), ok);
  },
});

/* -------------------- Helpers -------------------- */
const isObjectId = (v = "") => /^[0-9a-fA-F]{24}$/.test(String(v));
const findByIdOrSlug = (idOrSlug) =>
  Perfume.findOne(isObjectId(idOrSlug) ? { _id: idOrSlug } : { slug: idOrSlug });

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

    if (search) where.$text = { $search: String(search) };

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
    const perfume = await findByIdOrSlug(idOrSlug);
    if (!perfume) {
      return res.status(404).json({ message: "Parfum introuvable" });
    }
    res.json(perfume);
  } catch (err) {
    console.error("Erreur GET perfume:", err);
    next(err);
  }
});

/* -------- GET /api/perfumes/:idOrSlug/reviews (liste paginée) -------- */
router.get("/:idOrSlug/reviews", async (req, res, next) => {
  try {
    const { idOrSlug } = req.params;
    const perfume = await findByIdOrSlug(idOrSlug);
    if (!perfume) {
      return res.status(404).json({ message: "Parfum introuvable" });
    }

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

/* -------- GET /api/perfumes/:idOrSlug/reviews/me -------- */
router.get("/:idOrSlug/reviews/me", async (req, res, next) => {
  try {
    const { idOrSlug } = req.params;
    const perfume = await findByIdOrSlug(idOrSlug);
    if (!perfume) {
      return res.status(404).json({ message: "Parfum introuvable" });
    }

    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ message: "Non authentifié" });
    }

    const review = await Review.findOne({ perfume: perfume._id, user: userId });
    
    if (!review) {
      return res.status(404).json({ message: "Aucun avis trouvé" });
    }

    res.json(review);
  } catch (err) {
    next(err);
  }
});

/* -------------------- POST /api/perfumes -------------------- */
router.post("/", async (req, res, next) => {
  try {
    const {
      slug,
      name,
      brand,
      description,
      olfactoryFamilies,
      genderTarget,
      concentration,
      topNotes,
      heartNotes,
      baseNotes,
      images,
      variants,
    } = req.body || {};

    if (!name || !brand) {
      return res.status(400).json({ message: "name et brand sont requis" });
    }

    const doc = await Perfume.create({
      slug,
      name,
      brand,
      description,
      olfactoryFamilies,
      genderTarget,
      concentration,
      topNotes,
      heartNotes,
      baseNotes,
      images,
      variants,
    });

    res.status(201).json(doc);
  } catch (err) {
    if (err.code === 11000 && err?.keyPattern?.slug) {
      return res.status(409).json({ message: "Slug déjà utilisé" });
    }
    next(err);
  }
});

/* -------------------- PUT /api/perfumes/:idOrSlug -------------------- */
router.put("/:idOrSlug", async (req, res, next) => {
  try {
    const { idOrSlug } = req.params;
    const doc = await findByIdOrSlug(idOrSlug);
    if (!doc) {
      return res.status(404).json({ message: "Parfum introuvable" });
    }

    Object.assign(doc, req.body || {});
    await doc.validate();
    await doc.save();

    res.json(doc);
  } catch (err) {
    if (err.code === 11000 && err?.keyPattern?.slug) {
      return res.status(409).json({ message: "Slug déjà utilisé" });
    }
    next(err);
  }
});

/* ==================== ROUTES IMAGES ==================== */

router.post("/:idOrSlug/images", upload.single("image"), async (req, res, next) => {
  try {
    const perfume = await findByIdOrSlug(req.params.idOrSlug);
    if (!perfume) {
      return res.status(404).json({ message: "Parfum introuvable" });
    }
    if (!req.file) {
      return res.status(400).json({ message: "Missing file 'image'" });
    }

    const base64 = req.file.buffer.toString("base64");
    const dataUri = `data:${req.file.mimetype};base64,${base64}`;

    perfume.images = perfume.images || [];
    perfume.images.push(dataUri);
    await perfume.save();

    res.json({ ok: true, images: perfume.images, index: perfume.images.length - 1 });
  } catch (err) {
    next(err);
  }
});

router.put("/:idOrSlug/images/:index", upload.single("image"), async (req, res, next) => {
  try {
    const idx = Number(req.params.index);
    if (!Number.isInteger(idx) || idx < 0) {
      return res.status(400).json({ message: "Invalid index" });
    }

    const perfume = await findByIdOrSlug(req.params.idOrSlug);
    if (!perfume) {
      return res.status(404).json({ message: "Parfum introuvable" });
    }
    if (!req.file) {
      return res.status(400).json({ message: "Missing file 'image'" });
    }
    if (!perfume.images || !perfume.images[idx]) {
      return res.status(404).json({ message: "Image index not found" });
    }

    const base64 = req.file.buffer.toString("base64");
    const dataUri = `data:${req.file.mimetype};base64,${base64}`;

    perfume.images[idx] = dataUri;
    await perfume.save();

    res.json({ ok: true, images: perfume.images });
  } catch (err) {
    next(err);
  }
});

router.delete("/:idOrSlug/images/:index", async (req, res, next) => {
  try {
    const idx = Number(req.params.index);
    if (!Number.isInteger(idx) || idx < 0) {
      return res.status(400).json({ message: "Invalid index" });
    }

    const perfume = await findByIdOrSlug(req.params.idOrSlug);
    if (!perfume) {
      return res.status(404).json({ message: "Parfum introuvable" });
    }
    if (!perfume.images || !perfume.images[idx]) {
      return res.status(404).json({ message: "Image index not found" });
    }

    perfume.images.splice(idx, 1);
    await perfume.save();

    res.json({ ok: true, images: perfume.images });
  } catch (err) {
    next(err);
  }
});

export default router;