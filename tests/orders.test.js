import { describe, it, expect, beforeEach } from "vitest";
import { api, createUser, createAdmin, seedPerfumes, validCustomer } from "./helpers.js";
import Perfume from "../src/models/Perfume.js";

describe("Orders", () => {
  let rose, oud;
  beforeEach(async () => {
    [rose, oud] = await seedPerfumes();
  });

  const order = (items, extra = {}) => ({ customer: validCustomer, items, ...extra });
  const line = (p, sku, quantity = 1) => ({ productId: String(p._id), sku, quantity });

  it("requires login", async () => {
    await api().post("/api/orders").send(order([line(rose, "YULI-ROSE-30")])).expect(401);
  });

  it("computes prices on the server and ignores client prices", async () => {
    const { auth } = await createUser();
    const res = await api()
      .post("/api/orders")
      .set(auth)
      .send(order([{ ...line(rose, "YULI-ROSE-50", 2), priceCents: 1 }], { totals: { totalCents: 1 } }))
      .expect(201);
    expect(res.body.items[0]).toMatchObject({ unitPriceCents: 7900, quantity: 2, lineTotalCents: 15800 });
    expect(res.body).toMatchObject({ subtotalCents: 15800, shippingCents: 0, totalCents: 15800, paymentStatus: "simulated" });
  });

  it.each([
    ["standard", "YULI-ROSE-30", 1, 490], // 49.00 € — just below the 50 € free-shipping threshold
    ["standard", "YULI-ROSE-30", 2, 0], //   98.00 € — above the threshold
    ["standard", "YULI-ROSE-50", 1, 0],
    ["express", "YULI-ROSE-50", 1, 990],
  ])("charges correct %s shipping for %s x%i", async (shippingMethod, sku, qty, expected) => {
    const { auth } = await createUser();
    const res = await api().post("/api/orders").set(auth).send(order([line(rose, sku, qty)], { shippingMethod })).expect(201);
    expect(res.body.shippingCents).toBe(expected);
  });

  it("accepts the cart's `qty` field as quantity", async () => {
    const { auth } = await createUser();
    const res = await api()
      .post("/api/orders")
      .set(auth)
      .send(order([{ productId: String(oud._id), sku: "YULI-OUD-50", qty: 2 }]))
      .expect(201);
    expect(res.body.items[0].quantity).toBe(2);
  });

  it("decrements stock and refuses to oversell", async () => {
    const { auth } = await createUser();
    await api().post("/api/orders").set(auth).send(order([line(oud, "YULI-OUD-50", 5)])).expect(201);
    const after = await Perfume.findById(oud._id);
    expect(after.variants[0].stock).toBe(1);
    expect(after.stock).toBe(1);

    const res = await api().post("/api/orders").set(auth).send(order([line(oud, "YULI-OUD-50", 2)])).expect(409);
    expect(res.body.details).toMatchObject({ sku: "YULI-OUD-50", available: 1 });
  });

  it("merges duplicate cart lines before checking stock", async () => {
    const { auth } = await createUser();
    await api()
      .post("/api/orders")
      .set(auth)
      .send(order([line(oud, "YULI-OUD-50", 4), line(oud, "YULI-OUD-50", 4)]))
      .expect(409);
  });

  it("never oversells under concurrent orders", async () => {
    const buyers = await Promise.all([createUser(), createUser(), createUser()]);
    const results = await Promise.all(
      buyers.map((b) => api().post("/api/orders").set(b.auth).send(order([line(oud, "YULI-OUD-50", 3)])))
    );
    const created = results.filter((r) => r.status === 201).length;
    expect(created).toBe(2);
    expect((await Perfume.findById(oud._id)).variants[0].stock).toBe(0);
  });

  it.each([
    ["empty cart", { customer: validCustomer, items: [] }],
    ["unknown sku", { customer: validCustomer, items: [{ productId: "0123456789abcdef01234567", sku: "NOPE" }] }],
    ["bad email", { customer: { ...validCustomer, email: "x" }, items: [{ productId: "0123456789abcdef01234567", sku: "A" }] }],
    ["quantity above limit", { customer: validCustomer, items: [{ productId: "0123456789abcdef01234567", sku: "A", quantity: 21 }] }],
  ])("rejects %s with 400", async (_name, body) => {
    const { auth } = await createUser();
    await api().post("/api/orders").set(auth).send(body).expect(400);
  });

  it("only shows users their own orders", async () => {
    const alice = await createUser();
    const bob = await createUser();
    const { body: placed } = await api().post("/api/orders").set(alice.auth).send(order([line(rose, "YULI-ROSE-30")])).expect(201);

    expect((await api().get("/api/orders/mine").set(alice.auth)).body).toHaveLength(1);
    expect((await api().get("/api/orders/mine").set(bob.auth)).body).toHaveLength(0);
    await api().get(`/api/orders/${placed.id}`).set(alice.auth).expect(200);
    await api().get(`/api/orders/${placed.id}`).set(bob.auth).expect(404);
  });

  it("marks reviews from buyers as verified purchases", async () => {
    const { auth } = await createUser();
    await api().post("/api/orders").set(auth).send(order([line(rose, "YULI-ROSE-30")])).expect(201);
    const res = await api().post("/api/perfumes/rose-de-mai/reviews").set(auth).send({ rating: 5, comment: "Bought it" }).expect(201);
    expect(res.body.verifiedPurchase).toBe(true);
  });

  it("lets an admin cancel an order and restores stock", async () => {
    const buyer = await createUser();
    const admin = await createAdmin();
    const { body: placed } = await api().post("/api/orders").set(buyer.auth).send(order([line(oud, "YULI-OUD-50", 2)])).expect(201);

    await api().patch(`/api/admin/orders/${placed.id}`).set(buyer.auth).send({ status: "cancelled" }).expect(403);
    await api().patch(`/api/admin/orders/${placed.id}`).set(admin.auth).send({ status: "cancelled" }).expect(200);
    await api().patch(`/api/admin/orders/${placed.id}`).set(admin.auth).send({ status: "cancelled" }).expect(409);
    expect((await Perfume.findById(oud._id)).variants[0].stock).toBe(6);

    const list = await api().get("/api/admin/orders?status=cancelled").set(admin.auth).expect(200);
    expect(list.body).toHaveLength(1);
  });
});
