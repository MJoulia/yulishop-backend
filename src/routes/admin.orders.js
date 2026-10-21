import express from "express";
import Order from "../models/Order.js";
import Perfume from "../models/Perfume.js";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { asyncHandler, validate } from "../middlewares/error.js";
import { idParam, orderStatusSchema } from "../validation.js";

const router = express.Router();
router.use(requireAuth, requireRole("admin"));

/* GET /api/admin/orders?status= */
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const where = {};
    if (["placed", "shipped", "delivered", "cancelled"].includes(req.query.status)) where.status = req.query.status;
    res.json(await Order.find(where).sort({ createdAt: -1 }).limit(200).lean());
  })
);

/* PATCH /api/admin/orders/:id — cancelling returns the items to stock */
router.patch(
  "/:id",
  validate(idParam, "params"),
  validate(orderStatusSchema),
  asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (order.status === "cancelled") return res.status(409).json({ message: "Order already cancelled" });
    if (req.body.status === "cancelled") {
      await Promise.all(
        order.items.map((it) =>
          Perfume.updateOne(
            { _id: it.perfume, "variants.sku": it.sku },
            { $inc: { "variants.$.stock": it.quantity, stock: it.quantity } }
          )
        )
      );
    }
    order.status = req.body.status;
    await order.save();
    res.json(order);
  })
);

export default router;
