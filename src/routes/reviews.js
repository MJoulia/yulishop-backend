const express = require("express");
const Review = require("../models/Review");
const Perfume = require("../models/Perfume");
// const authRequired = require("../middlewares/authRequired"); // à brancher si besoin

const router = express.Router();

// Create review
router.post("/perfumes/:perfumeId/reviews", async (req, res) => {
  const { perfumeId } = req.params;
  const { rating, title, comment } = req.body;

  const perfume = await Perfume.findById(perfumeId);
  if (!perfume) return res.status(404).json({ message: "Parfum introuvable" });

  if (![1,2,3,4,5].includes(Number(rating))) return res.status(400).json({ message: "rating 1-5" });
  if (!comment || comment.trim().length < 3) return res.status(400).json({ message: "comment trop court" });

  const review = await Review.create({
    perfume: perfume._id,
    // user: req.user._id si auth
    rating: Number(rating),
    title: title?.trim(),
    comment: comment.trim(),
    status: "visible",
  });

  res.status(201).json(review);
});

// Update review
router.patch("/:id", async (req, res) => {
  const { id } = req.params;
  const { rating, title, comment, status } = req.body;

  const review = await Review.findOneAndUpdate(
    { _id: id }, 
    { $set: { rating, title, comment, status } },
    { new: true, runValidators: true }
  );

  if (!review) return res.status(404).json({ message: "Avis introuvable" });
  res.json(review);
});

// Delete review
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  const review = await Review.findOneAndDelete({ _id: id });
  if (!review) return res.status(404).json({ message: "Avis introuvable" });
  res.json({ ok: true });
});

module.exports = router;
