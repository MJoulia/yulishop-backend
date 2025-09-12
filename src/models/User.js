const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  firstName: { type: String, trim: true },
  lastName:  { type: String, trim: true },
  email:     { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone:     { type: String, trim: true },
  address:   { type: String, trim: true },
  passwordHash: { type: String, required: true },

  // 🆕 rôle: "user" par défaut, "admin" pour toi
  role: { type: String, enum: ["user", "admin"], default: "user", index: true }
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);