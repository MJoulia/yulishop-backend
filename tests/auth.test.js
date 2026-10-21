import { describe, it, expect } from "vitest";
import { api, createUser } from "./helpers.js";

describe("Auth", () => {
  const body = { email: "New.User@Test.dev", password: "Sup3rSecret", firstName: "Joulia" };

  it("registers a user, normalises the email and returns a token", async () => {
    const res = await api().post("/api/auth/register").send(body).expect(201);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user).toMatchObject({ email: "new.user@test.dev", role: "user", firstName: "Joulia" });
    expect(res.body.user).not.toHaveProperty("passwordHash");
  });

  it("ignores a client-supplied admin role", async () => {
    const res = await api().post("/api/auth/register").send({ ...body, role: "admin" }).expect(201);
    expect(res.body.user.role).toBe("user");
  });

  it("rejects a duplicate email with 409", async () => {
    await api().post("/api/auth/register").send(body).expect(201);
    await api().post("/api/auth/register").send(body).expect(409);
  });

  it.each([
    [{ email: "not-an-email", password: "Sup3rSecret" }, "email"],
    [{ email: "a@b.dev", password: "short" }, "password"],
    [{ password: "Sup3rSecret" }, "email"],
  ])("rejects invalid input %j with 400", async (payload, field) => {
    const res = await api().post("/api/auth/register").send(payload).expect(400);
    expect(res.body.errors.map((e) => e.path)).toContain(field);
  });

  it("logs in with correct credentials", async () => {
    const { user } = await createUser({ email: "login@test.dev" });
    const res = await api().post("/api/auth/login").send({ email: "LOGIN@test.dev", password: "Passw0rd!" }).expect(200);
    expect(res.body.user.id).toBe(String(user._id));
  });

  it("returns the same 401 for a wrong password and an unknown email", async () => {
    await createUser({ email: "login@test.dev" });
    const wrong = await api().post("/api/auth/login").send({ email: "login@test.dev", password: "nope" }).expect(401);
    const unknown = await api().post("/api/auth/login").send({ email: "ghost@test.dev", password: "nope" }).expect(401);
    expect(wrong.body).toEqual(unknown.body);
  });

  it("blocks NoSQL operator injection in login", async () => {
    await createUser({ email: "login@test.dev" });
    await api().post("/api/auth/login").send({ email: { $ne: null }, password: { $ne: null } }).expect(400);
  });

  it("GET /me requires a valid token", async () => {
    await api().get("/api/auth/me").expect(401);
    await api().get("/api/auth/me").set("Authorization", "Bearer garbage").expect(401);
    const { auth, user } = await createUser();
    const res = await api().get("/api/auth/me").set(auth).expect(200);
    expect(res.body.user.email).toBe(user.email);
  });

  it("rejects tokens of deactivated users", async () => {
    const { auth } = await createUser({ isActive: false });
    await api().get("/api/auth/me").set(auth).expect(401);
  });
});
