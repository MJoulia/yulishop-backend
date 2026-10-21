// Seeds demo perfumes and an admin account. Usage: npm run seed
// Admin credentials come from SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD (never hard-coded).
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import config from "../src/config.js";
import { connectDb } from "../src/db.js";
import Perfume from "../src/models/Perfume.js";
import User from "../src/models/User.js";

export const demoPerfumes = [
  {
    name: "Rose de Mai",
    brand: "Yuli",
    description: "A luminous rose with a soft musky trail.",
    olfactoryFamilies: ["floral"],
    genderTarget: "femme",
    concentration: "EDP",
    topNotes: ["bergamot", "pink pepper"],
    heartNotes: ["rose", "peony"],
    baseNotes: ["white musk", "cedar"],
    variants: [
      { sku: "YULI-ROSE-30", volumeMl: 30, priceCents: 4900, stock: 20 },
      { sku: "YULI-ROSE-50", volumeMl: 50, priceCents: 7900, stock: 12 },
    ],
  },
  {
    name: "Oud Nocturne",
    brand: "Yuli",
    description: "Smoky oud warmed with amber and vanilla.",
    olfactoryFamilies: ["woody", "oriental"],
    genderTarget: "unisex",
    concentration: "Extrait",
    topNotes: ["saffron"],
    heartNotes: ["oud", "leather"],
    baseNotes: ["amber", "vanilla"],
    variants: [{ sku: "YULI-OUD-50", volumeMl: 50, priceCents: 12900, stock: 6 }],
  },
  {
    name: "Citrus Atlas",
    brand: "Maison Atlas",
    description: "Fresh Moroccan citrus and orange blossom.",
    olfactoryFamilies: ["citrus", "fresh"],
    genderTarget: "homme",
    concentration: "EDT",
    topNotes: ["lemon", "neroli"],
    heartNotes: ["orange blossom"],
    baseNotes: ["vetiver"],
    variants: [
      { sku: "ATLAS-CIT-50", volumeMl: 50, priceCents: 5900, stock: 25 },
      { sku: "ATLAS-CIT-100", volumeMl: 100, priceCents: 8900, stock: 10 },
    ],
  },
];

async function main() {
  await connectDb(config.mongoUri);
  for (const p of demoPerfumes) {
    const existing = await Perfume.findOne({ name: p.name, brand: p.brand });
    if (existing) Object.assign(existing, p);
    await (existing || new Perfume(p)).save();
  }
  console.log(`Seeded ${demoPerfumes.length} perfumes`);

  const { SEED_ADMIN_EMAIL: email, SEED_ADMIN_PASSWORD: password } = process.env;
  if (email && password) {
    const passwordHash = await bcrypt.hash(password, 12);
    await User.updateOne(
      { email: email.toLowerCase() },
      { $set: { passwordHash, role: "admin", firstName: "Admin" } },
      { upsert: true }
    );
    console.log(`Admin account ready: ${email}`);
  } else {
    console.log("Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD to create an admin account.");
  }
  await mongoose.disconnect();
}

// Only run when executed directly (tests import demoPerfumes without seeding).
if (process.argv[1]?.endsWith("seed.js")) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
