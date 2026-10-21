import express from "express";
import multer from "multer";
import Perfume from "../models/Perfume.js";
import Review from "../models/Review.js";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { asyncHandler, validate } from "../middlewares/error.js";
import { perfumeSchema, perfumeUpdateSchema, perfumeListQuery, idParam } from "../validation.js";
import { buildPerfumeFilter } from "./perfumes.js";

const router = express.Router();
router.use(requireAuth, requireRole("admin"));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = ["image/png", "image/jpeg", "image/webp"].includes(file.mimetype);
    cb(ok ? null : new Error("Only PNG/JPEG/WEBP allowed"), ok);
  },
});

const toDataUri = (file) => `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;

async function perfumeOr404(req, res) {
  const perfume = await Perfume.findById(req.params.id);
  if (!perfume) res.status(404).json({ message: "Perfume not found" });
  return perfume;
}

/* GET /api/admin/perfumes?search= */
router.get(
  "/",
  validate(perfumeListQuery, "query"),
  asyncHandler(async (req, res) => {
    const q = req.validatedQuery;
    // Admin search is a forgiving substring match on name/brand instead of the text index.
    const { search, ...rest } = q;
    const where = buildPerfumeFilter(rest);
    if (search) {
      const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      where.$or = [{ name: rx }, { brand: rx }];
    }
    res.json(await Perfume.find(where).sort({ updatedAt: -1 }).skip(q.offset).limit(q.limit).lean());
  })
);

/* POST /api/admin/perfumes */
router.post(
  "/",
  validate(perfumeSchema),
  asyncHandler(async (req, res) => {
    const doc = await Perfume.create(req.body);
    res.status(201).json(doc);
  })
);

/* PUT /api/admin/perfumes/:id */
router.put(
  "/:id",
  validate(idParam, "params"),
  validate(perfumeUpdateSchema),
  asyncHandler(async (req, res) => {
    const doc = await perfumeOr404(req, res);
    if (!doc) return;
    Object.assign(doc, req.body);
    await doc.save();
    res.json(doc);
  })
);

/* DELETE /api/admin/perfumes/:id — also removes its reviews */
router.delete(
  "/:id",
  validate(idParam, "params"),
  asyncHandler(async (req, res) => {
    const doc = await perfumeOr404(req, res);
    if (!doc) return;
    await Promise.all([doc.deleteOne(), Review.deleteMany({ perfume: doc._id })]);
    res.json({ ok: true });
  })
);

/* POST /api/admin/perfumes/:id/images (multipart field "image") */
router.post(
  "/:id/images",
  validate(idParam, "params"),
  upload.single("image"),
  asyncHandler(async (req, res) => {
    const perfume = await perfumeOr404(req, res);
    if (!perfume) return;
    if (!req.file) return res.status(400).json({ message: "Missing file 'image'" });
    if (perfume.images.length >= 10) return res.status(400).json({ message: "Max 10 images" });
    perfume.images.push(toDataUri(req.file));
    await perfume.save();
    res.status(201).json({ ok: true, count: perfume.images.length, index: perfume.images.length - 1 });
  })
);

/* DELETE /api/admin/perfumes/:id/images/:index */
router.delete(
  "/:id/images/:index",
  asyncHandler(async (req, res) => {
    const idx = Number(req.params.index);
    if (!Number.isInteger(idx) || idx < 0) return res.status(400).json({ message: "Invalid index" });
    const perfume = await perfumeOr404(req, res);
    if (!perfume) return;
    if (!perfume.images[idx]) return res.status(404).json({ message: "Image index not found" });
    perfume.images.splice(idx, 1);
    await perfume.save();
    res.json({ ok: true, count: perfume.images.length });
  })
);

export default router;
