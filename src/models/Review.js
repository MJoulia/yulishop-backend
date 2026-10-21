import mongoose from "mongoose";
import Perfume from "./Perfume.js";

const ReviewSchema = new mongoose.Schema(
  {
    perfume: { type: mongoose.Schema.Types.ObjectId, ref: "Perfume", required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    authorName: { type: String, trim: true, default: "" },
    rating: { type: Number, min: 1, max: 5, required: true },
    title: { type: String, trim: true, default: "", maxlength: 120 },
    comment: { type: String, required: true, minlength: 3, maxlength: 2000, trim: true },
    verifiedPurchase: { type: Boolean, default: false },
    status: { type: String, enum: ["visible", "hidden", "pending"], default: "visible", index: true },
  },
  { timestamps: true }
);

// One review per user and perfume.
ReviewSchema.index({ perfume: 1, user: 1 }, { unique: true });
ReviewSchema.index({ perfume: 1, status: 1, createdAt: -1 });

/** Recomputes the perfume's average rating from visible reviews. Called explicitly by the routes. */
ReviewSchema.statics.recomputePerfumeRating = async function (perfumeId) {
  const [agg] = await this.aggregate([
    { $match: { perfume: new mongoose.Types.ObjectId(String(perfumeId)), status: "visible" } },
    { $group: { _id: "$perfume", count: { $sum: 1 }, avg: { $avg: "$rating" } } },
  ]);
  const metrics = agg
    ? { ratingCount: agg.count, ratingAvg: Number(agg.avg.toFixed(2)) }
    : { ratingCount: 0, ratingAvg: 0 };
  await Perfume.updateOne({ _id: perfumeId }, { $set: metrics });
  return metrics;
};

export default mongoose.models.Review || mongoose.model("Review", ReviewSchema);
