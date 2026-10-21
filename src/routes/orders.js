import express from "express";
import mongoose from "mongoose";
import Perfume from "../models/Perfume.js";
import Order from "../models/Order.js";
import config from "../config.js";
import { requireAuth } from "../middlewares/auth.js";
import { asyncHandler, validate, HttpError } from "../middlewares/error.js";
import { orderSchema, idParam } from "../validation.js";

const router = express.Router();
router.use(requireAuth);

export function shippingFor(method, subtotalCents) {
  if (method === "express") return config.shipping.expressCents;
  return subtotalCents >= config.shipping.freeFromCents ? 0 : config.shipping.standardCents;
}

/**
 * Atomically reserves stock for one line. The filter only matches while enough stock is left,
 * so two concurrent orders can never oversell the same variant.
 */
async function reserve(item) {
  const res = await Perfume.updateOne(
    { _id: item.perfume, variants: { $elemMatch: { sku: item.sku, stock: { $gte: item.quantity } } } },
    { $inc: { "variants.$.stock": -item.quantity, stock: -item.quantity } }
  );
  return res.modifiedCount === 1;
}

async function release(item) {
  await Perfume.updateOne(
    { _id: item.perfume, "variants.sku": item.sku },
    { $inc: { "variants.$.stock": item.quantity, stock: item.quantity } }
  );
}

/* POST /api/orders — prices and totals are always computed on the server */
router.post(
  "/",
  validate(orderSchema),
  asyncHandler(async (req, res) => {
    const { customer, items, shippingMethod } = req.body;

    // Merge duplicate lines (same SKU) so the stock check sees the real quantity.
    const merged = new Map();
    for (const it of items) {
      const key = `${it.productId}:${it.sku}`;
      merged.set(key, { ...it, quantity: (merged.get(key)?.quantity || 0) + it.quantity });
    }

    const ids = [...new Set([...merged.values()].map((i) => i.productId))];
    const perfumes = await Perfume.find({ _id: { $in: ids } }).lean();
    const byId = new Map(perfumes.map((p) => [String(p._id), p]));

    const lines = [...merged.values()].map(({ productId, sku, quantity }) => {
      const p = byId.get(productId);
      const v = p?.variants.find((x) => x.sku === sku);
      if (!p || !v) throw new HttpError(400, `Unknown product or SKU: ${sku}`);
      if (v.stock < quantity) throw new HttpError(409, `Not enough stock for ${p.name} (${v.volumeMl} ml)`, { sku, available: v.stock });
      return {
        perfume: p._id,
        sku,
        name: p.name,
        brand: p.brand,
        volumeMl: v.volumeMl,
        unitPriceCents: v.priceCents,
        quantity,
        lineTotalCents: v.priceCents * quantity,
      };
    });

    const reserved = [];
    for (const line of lines) {
      if (!(await reserve(line))) {
        await Promise.all(reserved.map(release));
        throw new HttpError(409, `Not enough stock for ${line.name} (${line.volumeMl} ml)`, { sku: line.sku });
      }
      reserved.push(line);
    }

    const subtotalCents = lines.reduce((s, l) => s + l.lineTotalCents, 0);
    const shippingCents = shippingFor(shippingMethod, subtotalCents);
    try {
      const order = await Order.create({
        user: req.user._id,
        items: lines,
        customer,
        shippingMethod,
        subtotalCents,
        shippingCents,
        totalCents: subtotalCents + shippingCents,
      });
      res.status(201).json({ id: order._id, ...order.toObject() });
    } catch (err) {
      await Promise.all(reserved.map(release));
      throw err;
    }
  })
);

/* GET /api/orders/mine */
router.get(
  "/mine",
  asyncHandler(async (req, res) => {
    const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(100).lean();
    res.json(orders);
  })
);

/* GET /api/orders/:id — owner or admin */
router.get(
  "/:id",
  validate(idParam, "params"),
  asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id).lean();
    const allowed = order && (req.user.role === "admin" || new mongoose.Types.ObjectId(order.user).equals(req.user._id));
    if (!allowed) return res.status(404).json({ message: "Order not found" });
    res.json(order);
  })
);

export default router;
