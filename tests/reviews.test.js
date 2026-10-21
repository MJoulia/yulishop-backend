import { describe, it, expect, beforeEach } from "vitest";
import { api, createUser, createAdmin, seedPerfumes } from "./helpers.js";

describe("Reviews", () => {
  beforeEach(seedPerfumes);
  const url = "/api/perfumes/rose-de-mai/reviews";

  it("requires login to post a review", async () => {
    await api().post(url).send({ rating: 5, comment: "Lovely" }).expect(401);
  });

  it("creates a review and updates the perfume rating", async () => {
    const a = await createUser();
    const b = await createUser();
    await api().post(url).set(a.auth).send({ rating: 5, comment: "Lovely rose" }).expect(201);
    const res = await api().post(url).set(b.auth).send({ rating: 2, comment: "Too sweet" }).expect(201);
    expect(res.body).toMatchObject({ ratingAvg: 3.5, ratingCount: 2 });

    const perfume = await api().get("/api/perfumes/rose-de-mai");
    expect(perfume.body).toMatchObject({ ratingAvg: 3.5, ratingCount: 2 });
  });

  it("keeps one review per user: posting again updates it", async () => {
    const { auth } = await createUser();
    await api().post(url).set(auth).send({ rating: 5, comment: "First" }).expect(201);
    await api().post(url).set(auth).send({ rating: 3, comment: "Changed my mind" }).expect(200);
    const list = await api().get(url).expect(200);
    expect(list.body.total).toBe(1);
    expect(list.body.reviews[0]).toMatchObject({ rating: 3, comment: "Changed my mind" });
  });

  it("does not leak reviewer user ids in the public list", async () => {
    const { auth } = await createUser();
    await api().post(url).set(auth).send({ rating: 4, comment: "Nice" }).expect(201);
    const list = await api().get(url).expect(200);
    expect(list.body.reviews[0]).not.toHaveProperty("user");
    expect(list.body.reviews[0].authorName).toBe("Test U.");
  });

  it("returns my own review", async () => {
    const { auth } = await createUser();
    await api().get(`${url}/me`).set(auth).expect(404);
    await api().post(url).set(auth).send({ rating: 4, title: "Good", comment: "Nice" }).expect(201);
    const me = await api().get(`${url}/me`).set(auth).expect(200);
    expect(me.body.title).toBe("Good");
  });

  it.each([
    [{ rating: 0, comment: "ok ok" }],
    [{ rating: 6, comment: "ok ok" }],
    [{ rating: 4, comment: "no" }],
    [{ comment: "missing rating" }],
  ])("rejects invalid review %j", async (body) => {
    const { auth } = await createUser();
    await api().post(url).set(auth).send(body).expect(400);
  });

  it("paginates with page and limit", async () => {
    for (let i = 0; i < 3; i++) {
      const { auth } = await createUser();
      await api().post(url).set(auth).send({ rating: 4, comment: `Review ${i}` }).expect(201);
    }
    const page2 = await api().get(`${url}?page=2&limit=2`).expect(200);
    expect(page2.body).toMatchObject({ total: 3, page: 2, limit: 2 });
    expect(page2.body.reviews).toHaveLength(1);
  });

  it("only lets the owner (or an admin) edit or delete a review", async () => {
    const owner = await createUser();
    const stranger = await createUser();
    const admin = await createAdmin();
    const { body: review } = await api().post(url).set(owner.auth).send({ rating: 5, comment: "Mine" }).expect(201);

    await api().patch(`/api/reviews/${review._id}`).set(stranger.auth).send({ comment: "Hacked" }).expect(403);
    await api().delete(`/api/reviews/${review._id}`).set(stranger.auth).expect(403);
    await api().patch(`/api/reviews/${review._id}`).set(owner.auth).send({ status: "hidden" }).expect(403);

    await api().patch(`/api/reviews/${review._id}`).set(owner.auth).send({ comment: "Still mine" }).expect(200);
    const hidden = await api().patch(`/api/reviews/${review._id}`).set(admin.auth).send({ status: "hidden" }).expect(200);
    expect(hidden.body.ratingCount).toBe(0);
    expect((await api().get(url)).body.total).toBe(0);

    await api().delete(`/api/reviews/${review._id}`).set(owner.auth).expect(200);
    await api().delete(`/api/reviews/${review._id}`).set(owner.auth).expect(404);
  });
});
