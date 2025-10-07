const mongoose = require("mongoose");

/* ------------ Subschema ------------ */
const VariantSchema = new mongoose.Schema(
  {
    sku: { type: String, trim: true },
    volumeMl: { type: Number, min: 1, required: true },
    priceCents: { type: Number, min: 0, required: true },
    stock: { type: Number, min: 0, default: 0 },
  },
  { _id: false }
);

/* ------------ Helpers ------------ */
const trimArr = (arr) =>
  Array.isArray(arr)
    ? arr.map((s) => String(s).trim()).filter(Boolean)
    : [];

function slugify(str) {
  return String(str)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/* ------------ Schema ------------ */
const PerfumeSchema = new mongoose.Schema(
  {
    slug: { type: String, unique: true, index: true, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    brand: { type: String, required: true, trim: true },
    description: { type: String, default: "" },

    olfactoryFamilies: { type: [String], default: [] },
    genderTarget: { type: String, enum: ["unisex", "femme", "homme", "autre"], default: "unisex" },
    concentration: { type: String, enum: ["EDC", "EDT", "EDP", "Extrait", "Autre"], default: "EDP" },

    topNotes: { type: [String], default: [] },
    heartNotes: { type: [String], default: [] },
    baseNotes: { type: [String], default: [] },

    images: { type: [String], default: [] },

    variants: { type: [VariantSchema], default: [] },

    priceCents: { type: Number, min: 0 },
    stock: { type: Number, min: 0, default: 0 },

    ratingAvg: { type: Number, min: 0, max: 5, default: 0 },
    ratingCount: { type: Number, min: 0, default: 0 },
  },
  { timestamps: true }
);

/* ------------ Indexes ------------ */
PerfumeSchema.index({ brand: 1, ratingAvg: -1 });
PerfumeSchema.index({
  name: "text",
  brand: "text",
  description: "text",
  topNotes: "text",
  heartNotes: "text",
  baseNotes: "text",
});

/* ------------ Setters ------------ */
PerfumeSchema.path("images").set(trimArr);
PerfumeSchema.path("olfactoryFamilies").set(trimArr);
PerfumeSchema.path("topNotes").set(trimArr);
PerfumeSchema.path("heartNotes").set(trimArr);
PerfumeSchema.path("baseNotes").set(trimArr);

/* ------------ Statics & Hooks ------------ */
PerfumeSchema.statics.buildUniqueSlug = async function (base, excludeId = null) {
  const Perfume = this;
  const baseSlug = slugify(base);
  let candidate = baseSlug;
  let i = 2;
  const exists = async (slug) => {
    const q = { slug };
    if (excludeId) q._id = { $ne: excludeId };
    return !!(await Perfume.exists(q));
  };
  while (await exists(candidate)) candidate = `${baseSlug}-${i++}`;
  return candidate;
};

PerfumeSchema.pre("validate", async function (next) {
  try {
    if (!this.slug && this.name) {
      this.slug = await this.constructor.buildUniqueSlug(this.name, this._id);
    }
    if (Array.isArray(this.variants) && this.variants.length > 0) {
      const prices = this.variants
        .filter((v) => typeof v.priceCents === "number")
        .map((v) => v.priceCents);
      if (prices.length) this.priceCents = Math.min(...prices);
      this.stock = this.variants.reduce((sum, v) => sum + (v.stock || 0), 0);
    }
    next();
  } catch (e) {
    next(e);
  }
});

module.exports = mongoose.model("Perfume", PerfumeSchema);
