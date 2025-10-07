// models/review.js
const mongoose = require("mongoose");

const ReviewSchema = new mongoose.Schema(
  {
    perfume: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Perfume",
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      // non-required : permet avis anonymes si tu le souhaites (contrôle côté routes)
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      required: true,
    },
    title: {
      type: String,
      trim: true,
      default: "",
    },
    comment: {
      type: String,
      required: true,
      minlength: 3,
      maxlength: 2000,
      trim: true,
    },
    verifiedPurchase: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ["visible", "hidden", "pending"],
      default: "visible",
      index: true,
    },
  },
  { timestamps: true }
);

/* -------------------- Indexes -------------------- */
// Un seul avis par (user, perfume) quand user est défini
ReviewSchema.index(
  { perfume: 1, user: 1 },
  { unique: true, partialFilterExpression: { user: { $type: "objectId" } } }
);

// Pour lister rapidement les avis d’un parfum visibles par date
ReviewSchema.index({ perfume: 1, status: 1, createdAt: -1 });

/* -------------------- Recompute helpers -------------------- */
async function recomputePerfumeRating(perfumeId) {
  // import tardif pour éviter les cycles
  const Perfume = require("./Perfume.js");
  const Review = mongoose.model("Review");

  const agg = await Review.aggregate([
    { $match: { perfume: perfumeId, status: "visible" } },
    {
      $group: {
        _id: "$perfume",
        count: { $sum: 1 },
        avg: { $avg: "$rating" },
      },
    },
  ]);

  const metrics = agg[0]
    ? { ratingCount: agg[0].count, ratingAvg: Number(agg[0].avg.toFixed(2)) }
    : { ratingCount: 0, ratingAvg: 0 };

  await Perfume.updateOne({ _id: perfumeId }, { $set: metrics });
  return metrics;
}

/* -------------------- Hooks -------------------- */
// Post-save : recalcule sans bloquer le cycle
ReviewSchema.post("save", function () {
  recomputePerfumeRating(this.perfume);
});

// findOneAndUpdate : 'doc' est défini si l’option { new: true } est utilisée côté route
ReviewSchema.post("findOneAndUpdate", function (doc) {
  if (doc) recomputePerfumeRating(doc.perfume);
});

// deleteOne(document middleware) : le doc est accessible via 'this'
ReviewSchema.post("deleteOne", { document: true }, function () {
  if (this && this.perfume) recomputePerfumeRating(this.perfume);
});

// findOneAndDelete(query middleware) : 'doc' est passé au hook
ReviewSchema.post("findOneAndDelete", function (doc) {
  if (doc) recomputePerfumeRating(doc.perfume);
});

module.exports = mongoose.model("Review", ReviewSchema);
