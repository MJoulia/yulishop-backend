import mongoose from "mongoose";

const OrderItemSchema = new mongoose.Schema(
  {
    perfume: { type: mongoose.Schema.Types.ObjectId, ref: "Perfume", required: true },
    sku: { type: String, required: true },
    name: { type: String, required: true },
    brand: { type: String, required: true },
    volumeMl: { type: Number, required: true },
    unitPriceCents: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    lineTotalCents: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const OrderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    items: { type: [OrderItemSchema], validate: (v) => v.length > 0 },
    customer: {
      firstName: { type: String, required: true },
      lastName: { type: String, required: true },
      email: { type: String, required: true },
      phone: String,
      street: { type: String, required: true },
      city: { type: String, required: true },
      postalCode: { type: String, required: true },
      country: { type: String, required: true },
      notes: String,
    },
    shippingMethod: { type: String, enum: ["standard", "express"], required: true },
    subtotalCents: { type: Number, required: true, min: 0 },
    shippingCents: { type: Number, required: true, min: 0 },
    totalCents: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "EUR" },
    // Payment is simulated: card data never reaches this server. A real PSP (e.g. Stripe) would set "paid" via webhook.
    paymentStatus: { type: String, enum: ["simulated", "pending", "paid", "refunded"], default: "simulated" },
    status: { type: String, enum: ["placed", "shipped", "delivered", "cancelled"], default: "placed", index: true },
  },
  { timestamps: true }
);

export default mongoose.models.Order || mongoose.model("Order", OrderSchema);
