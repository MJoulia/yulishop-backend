const mongoose = require("mongoose");

const VariantSchema = new mongoose.Schema({
  sku: { type: String, trim: true },
  volumeMl: { type: Number, min: 1, required: true },
  priceCents: { type: Number, min: 0, required: true },
  stock: { type: Number, min: 0, default: 0 },
}, { _id: false });

const PerfumeSchema = new mongoose.Schema({
  slug: { type: String, unique: true, index: true, required: true, trim: true },
  name: { type: String, required: true, trim: true },
  brand: { type: String, required: true, trim: true },
  description: { type: String, default: "" },

  olfactoryFamilies: { type: [String], default: [] },
  genderTarget: { type: String, enum: ["unisex","femme","homme","autre"], default: "unisex" },
  concentration: { type: String, enum: ["EDC","EDT","EDP","Extrait","Autre"], default: "EDP" },

  topNotes:   { type: [String], default: [] },
  heartNotes: { type: [String], default: [] },
  baseNotes:  { type: [String], default: [] },

  images: { type: [String], default: [] },

  variants: { type: [VariantSchema], default: [] },
  priceCents: { type: Number, min: 0 }, 
  stock: { type: Number, min: 0, default: 0 },

  ratingAvg: { type: Number, min: 0, max: 5, default: 0 },
  ratingCount: { type: Number, min: 0, default: 0 },
}, { timestamps: true });

PerfumeSchema.index({ brand: 1, ratingAvg: -1 });

module.exports = mongoose.model("Perfume", PerfumeSchema);
