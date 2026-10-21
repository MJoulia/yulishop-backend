import { describe, it, expect, beforeEach } from "vitest";
import { api, createUser, createAdmin, seedPerfumes } from "./helpers.js";

describe("Catalogue (public)", () => {
  let perfumes;
  beforeEach(async () => {
    perfumes = await seedPerfumes();
  });

  it("lists perfumes with a total count header", async () => {
    const res = await api().get("/api/perfumes").expect(200);
    expect(res.body).toHaveLength(3);
    expect(res.headers["x-total-count"]).toBe("3");
  });

  it("derives price (cheapest variant) and stock (sum) from variants", async () => {
    const res = await api().get("/api/perfumes/rose-de-mai").expect(200);
    expect(res.body.priceCents).toBe(4900);
    expect(res.body.stock).toBe(32);
  });

  it("finds a perfume by id or slug", async () => {
    await api().get(`/api/perfumes/${perfumes[1]._id}`).expect(200);
    await api().get("/api/perfumes/oud-nocturne").expect(200);
    await api().get("/api/perfumes/does-not-exist").expect(404);
  });

  it("sorts by price ascending and descending", async () => {
    const asc = await api().get("/api/perfumes?sort=price_asc").expect(200);
    const desc = await api().get("/api/perfumes?sort=price_desc").expect(200);
    expect(asc.body.map((p) => p.priceCents)).toEqual([4900, 5900, 12900]);
    expect(desc.body.map((p) => p.priceCents)).toEqual([12900, 5900, 4900]);
  });

  it("filters by brand, family and price range", async () => {
    expect((await api().get("/api/perfumes?brand=Yuli")).body).toHaveLength(2);
    expect((await api().get("/api/perfumes?family=citrus")).body).toHaveLength(1);
    expect((await api().get("/api/perfumes?minPriceCents=5000&maxPriceCents=10000")).body).toHaveLength(1);
  });

  it("supports full-text search on notes", async () => {
    const res = await api().get("/api/perfumes?search=saffron").expect(200);
    expect(res.body.map((p) => p.name)).toEqual(["Oud Nocturne"]);
  });

  it("paginates with limit and offset", async () => {
    const res = await api().get("/api/perfumes?limit=2&offset=2").expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.headers["x-total-count"]).toBe("3");
  });

  it.each(["limit=0", "limit=101", "offset=-1", "sort=cheapest", "brand[$ne]=x"])("rejects bad query %s with 400", async (qs) => {
    await api().get(`/api/perfumes?${qs}`).expect(400);
  });
});

describe("Catalogue writes are admin-only", () => {
  const perfume = { name: "Test Scent", brand: "QA", variants: [{ sku: "QA-1", volumeMl: 50, priceCents: 1000, stock: 3 }] };

  it("has no public write endpoints", async () => {
    await api().post("/api/perfumes").send(perfume).expect(404);
  });

  it("rejects anonymous and non-admin users", async () => {
    await api().post("/api/admin/perfumes").send(perfume).expect(401);
    const { auth } = await createUser();
    await api().post("/api/admin/perfumes").set(auth).send(perfume).expect(403);
  });

  it("lets an admin create, update, search and delete a perfume", async () => {
    const { auth } = await createAdmin();
    const created = await api().post("/api/admin/perfumes").set(auth).send(perfume).expect(201);
    expect(created.body.slug).toBe("test-scent");

    const updated = await api()
      .put(`/api/admin/perfumes/${created.body._id}`)
      .set(auth)
      .send({ variants: [{ sku: "QA-1", volumeMl: 50, priceCents: 1500, stock: 3 }] })
      .expect(200);
    expect(updated.body.priceCents).toBe(1500);

    const found = await api().get("/api/admin/perfumes?search=test").set(auth).expect(200);
    expect(found.body).toHaveLength(1);

    await api().delete(`/api/admin/perfumes/${created.body._id}`).set(auth).expect(200);
    await api().get("/api/perfumes/test-scent").expect(404);
  });

  it("generates unique slugs for duplicate names", async () => {
    const { auth } = await createAdmin();
    await api().post("/api/admin/perfumes").set(auth).send(perfume).expect(201);
    const second = await api().post("/api/admin/perfumes").set(auth).send(perfume).expect(201);
    expect(second.body.slug).toBe("test-scent-2");
  });

  it("validates the payload", async () => {
    const { auth } = await createAdmin();
    const res = await api().post("/api/admin/perfumes").set(auth).send({ brand: "QA", variants: [{ sku: "x", volumeMl: 0, priceCents: -5 }] }).expect(400);
    expect(res.body.errors.map((e) => e.path)).toEqual(expect.arrayContaining(["name", "variants.0.volumeMl", "variants.0.priceCents"]));
  });

  it("returns 400 for a malformed id and 404 for an unknown one", async () => {
    const { auth } = await createAdmin();
    await api().put("/api/admin/perfumes/not-an-id").set(auth).send({ name: "x" }).expect(400);
    await api().put("/api/admin/perfumes/0123456789abcdef01234567").set(auth).send({ name: "x" }).expect(404);
  });
});
