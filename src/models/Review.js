const mongoose = require("mongoose");
const Perfume = require("./Perfume");

const ReviewSchema = new mongoose.Schema({
  perfume: { type: mongoose.Schema.Types.ObjectId, ref: "Perfume", required: true, index: true },
  user:    { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  rating:  { type: Number, min: 1, max: 5, required: true },
  title:   { type: String, trim: true },
  comment: { type: String, required: true, minlength: 3, maxlength: 2000 },
  verifiedPurchase: { type: Boolean, default: false },
  status: { type: String, enum: ["visible","hidden","pending"], default: "visible", index: true },
}, { timestamps: true });

// empêche plusieurs reviews du même user sur le même parfum
ReviewSchema.index({ perfume: 1, user: 1 }, { unique: true, partialFilterExpression: { user: { $type: "objectId" } } });

async function recomputePerfumeRating(perfumeId) {
  const agg = await Review.aggregate([
    { $match: { perfume: perfumeId, status: "visible" } },
    { $group: { _id: "$perfume", count: { $sum: 1 }, avg: { $avg: "$rating" } } },
  ]);
  const metrics = agg[0]
    ? { ratingCount: agg[0].count, ratingAvg: Number(agg[0].avg.toFixed(2)) }
    : { ratingCount: 0, ratingAvg: 0 };
  await Perfume.updateOne({ _id: perfumeId }, { $set: metrics });
}

// Hooks
ReviewSchema.post("save", function () { recomputePerfumeRating(this.perfume); });
ReviewSchema.post("findOneAndUpdate", function (doc) { if (doc) recomputePerfumeRating(doc.perfume); });
ReviewSchema.post("remove", function (doc) { if (doc) recomputePerfumeRating(doc.perfume); });
ReviewSchema.post("findOneAndDelete", function (doc) { if (doc) recomputePerfumeRating(doc.perfume); });

const Review = mongoose.model("Review", ReviewSchema);
module.exports = Review;
