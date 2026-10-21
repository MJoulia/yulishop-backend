import mongoose from "mongoose";

/* ------------ Subschema ------------ */
const VariantSchema = new mongoose.Schema(
  {
    sku: { type: String, trim: true, required: true },
    volumeMl: { type: Number, min: 1, required: true },
    priceCents: { type: Number, min: 0, required: true },
    stock: { type: Number, min: 0, default: 0 },
  },
  { _id: false }
);

/* ------------ Helpers ------------ */
const trimArr = (arr) => (Array.isArray(arr) ? arr.map((s) => String(s).trim()).filter(Boolean) : []);

export function slugify(str) {
  return String(str)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/* ------------ Schema ------------ */
const PerfumeSchema = new mongoose.Schema(
  {
    slug: { type: String, unique: true, index: true, required: true, trim: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    brand: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, default: "", maxlength: 5000 },

    olfactoryFamilies: { type: [String], default: [], set: trimArr },
    genderTarget: { type: String, enum: ["unisex", "femme", "homme", "autre"], default: "unisex" },
    concentration: { type: String, enum: ["EDC", "EDT", "EDP", "Extrait", "Autre"], default: "EDP" },

    topNotes: { type: [String], default: [], set: trimArr },
    heartNotes: { type: [String], default: [], set: trimArr },
    baseNotes: { type: [String], default: [], set: trimArr },

    images: { type: [String], default: [], set: trimArr },
    variants: { type: [VariantSchema], default: [] },

    // Derived from variants in the pre-validate hook.
    priceCents: { type: Number, min: 0, default: 0 },
    stock: { type: Number, min: 0, default: 0 },

    ratingAvg: { type: Number, min: 0, max: 5, default: 0 },
    ratingCount: { type: Number, min: 0, default: 0 },
  },
  { timestamps: true }
);

/* ------------ Indexes ------------ */
PerfumeSchema.index({ brand: 1, ratingAvg: -1 });
PerfumeSchema.index({ "variants.sku": 1 });
PerfumeSchema.index({
  name: "text",
  brand: "text",
  description: "text",
  topNotes: "text",
  heartNotes: "text",
  baseNotes: "text",
});

/* ------------ Statics & Hooks ------------ */
PerfumeSchema.statics.buildUniqueSlug = async function (base, excludeId = null) {
  const baseSlug = slugify(base) || "perfume";
  let candidate = baseSlug;
  let i = 2;
  const exists = async (slug) => {
    const q = { slug };
    if (excludeId) q._id = { $ne: excludeId };
    return !!(await this.exists(q));
  };
  while (await exists(candidate)) candidate = `${baseSlug}-${i++}`;
  return candidate;
};

PerfumeSchema.methods.recomputeDerived = function () {
  if (Array.isArray(this.variants) && this.variants.length > 0) {
    this.priceCents = Math.min(...this.variants.map((v) => v.priceCents));
    this.stock = this.variants.reduce((sum, v) => sum + (v.stock || 0), 0);
  }
};

PerfumeSchema.pre("validate", async function () {
  if (!this.slug && this.name) {
    this.slug = await this.constructor.buildUniqueSlug(this.name, this._id);
  }
  this.recomputeDerived();
});

export default mongoose.models.Perfume || mongoose.model("Perfume", PerfumeSchema);
