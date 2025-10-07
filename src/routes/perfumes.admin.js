const express = require("express");
const Perfume = require("../models/Perfume.js");
const { requireAuth, requireRole } = require("../middlewares/auth.js");

const router = express.Router();

// Middleware global → protège toutes les routes
router.use(requireAuth, requireRole("admin"));

// CREATE
router.post("/", async (req, res, next) => {
  try {
    const doc = await Perfume.create(req.body);
    res.status(201).json(doc);
  } catch (err) {
    next(err);
  }
});

// UPDATE
router.put("/:id", async (req, res, next) => {
  try {
    const updated = await Perfume.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ message: "Introuvable" });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE
router.delete("/:id", async (req, res, next) => {
  try {
    const deleted = await Perfume.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Introuvable" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
