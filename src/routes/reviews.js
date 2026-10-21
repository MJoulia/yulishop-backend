import express from "express";
import Review from "../models/Review.js";
import Order from "../models/Order.js";
import { requireAuth } from "../middlewares/auth.js";
import { asyncHandler, validate } from "../middlewares/error.js";
import { reviewListQuery, reviewSchema, reviewUpdateSchema, idParam } from "../validation.js";
import { findByIdOrSlug } from "./perfumes.js";

const router = express.Router();

async function perfumeOr404(req, res) {
  const perfume = await findByIdOrSlug(req.params.idOrSlug);
  if (!perfume) res.status(404).json({ message: "Perfume not found" });
  return perfume;
}

/* GET /api/perfumes/:idOrSlug/reviews?page=&limit= — public, visible reviews only */
router.get(
  "/perfumes/:idOrSlug/reviews",
  validate(reviewListQuery, "query"),
  asyncHandler(async (req, res) => {
    const perfume = await perfumeOr404(req, res);
    if (!perfume) return;
    const { rating, sort, page, limit } = req.validatedQuery;
    const where = { perfume: perfume._id, status: "visible" };
    if (rating) where.rating = rating;
    const order = sort === "best" ? { rating: -1, createdAt: -1 } : { createdAt: -1 };
    const [reviews, total] = await Promise.all([
      Review.find(where).sort(order).skip((page - 1) * limit).limit(limit).select("-user").lean(),
      Review.countDocuments(where),
    ]);
    res.json({ reviews, total, page, limit });
  })
);

/* GET /api/perfumes/:idOrSlug/reviews/me — the caller's own review */
router.get(
  "/perfumes/:idOrSlug/reviews/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const perfume = await perfumeOr404(req, res);
    if (!perfume) return;
    const review = await Review.findOne({ perfume: perfume._id, user: req.user._id }).lean();
    if (!review) return res.status(404).json({ message: "No review yet" });
    res.json(review);
  })
);

/* POST /api/perfumes/:idOrSlug/reviews — create or update the caller's review */
router.post(
  "/perfumes/:idOrSlug/reviews",
  requireAuth,
  validate(reviewSchema),
  asyncHandler(async (req, res) => {
    const perfume = await perfumeOr404(req, res);
    if (!perfume) return;
    const verifiedPurchase = !!(await Order.exists({ user: req.user._id, "items.perfume": perfume._id }));
    const existing = await Review.findOne({ perfume: perfume._id, user: req.user._id });
    const review = existing || new Review({ perfume: perfume._id, user: req.user._id });
    Object.assign(review, req.body, {
      authorName: [req.user.firstName, req.user.lastName?.[0] && `${req.user.lastName[0]}.`].filter(Boolean).join(" "),
      verifiedPurchase,
    });
    await review.save();
    const metrics = await Review.recomputePerfumeRating(perfume._id);
    res.status(existing ? 200 : 201).json({ ...review.toObject(), ...metrics });
  })
);

async function ownReviewOr403(req, res) {
  const review = await Review.findById(req.params.id);
  if (!review) {
    res.status(404).json({ message: "Review not found" });
    return null;
  }
  if (req.user.role !== "admin" && !review.user.equals(req.user._id)) {
    res.status(403).json({ message: "Not your review" });
    return null;
  }
  return review;
}

/* PATCH /api/reviews/:id — owner edits content; only admins may change status */
router.patch(
  "/reviews/:id",
  requireAuth,
  validate(idParam, "params"),
  validate(reviewUpdateSchema),
  asyncHandler(async (req, res) => {
    const review = await ownReviewOr403(req, res);
    if (!review) return;
    if (req.body.status && req.user.role !== "admin") {
      return res.status(403).json({ message: "Only admins can moderate reviews" });
    }
    Object.assign(review, req.body);
    await review.save();
    const metrics = await Review.recomputePerfumeRating(review.perfume);
    res.json({ ...review.toObject(), ...metrics });
  })
);

/* DELETE /api/reviews/:id — owner or admin */
router.delete(
  "/reviews/:id",
  requireAuth,
  validate(idParam, "params"),
  asyncHandler(async (req, res) => {
    const review = await ownReviewOr403(req, res);
    if (!review) return;
    await review.deleteOne();
    const metrics = await Review.recomputePerfumeRating(review.perfume);
    res.json({ ok: true, ...metrics });
  })
);

export default router;
