import { describe, it, expect } from "vitest";
import { api } from "./helpers.js";

describe("App basics", () => {
  it("reports health with DB status", async () => {
    const res = await api().get("/healthz").expect(200);
    expect(res.body).toMatchObject({ ok: true, db: "connected" });
  });

  it("serves the OpenAPI spec", async () => {
    const res = await api().get("/api/openapi.json").expect(200);
    expect(res.body.openapi).toMatch(/^3\./);
    expect(Object.keys(res.body.paths)).toContain("/api/orders");
  });

  it("sets security headers and hides the framework", async () => {
    const res = await api().get("/");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers).not.toHaveProperty("x-powered-by");
  });

  it("only allows configured CORS origins", async () => {
    const ok = await api().get("/").set("Origin", "http://localhost:5173");
    expect(ok.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    const bad = await api().get("/").set("Origin", "https://evil.example");
    expect(bad.headers).not.toHaveProperty("access-control-allow-origin");
  });

  it("returns JSON 404 for unknown routes", async () => {
    const res = await api().get("/api/nope").expect(404);
    expect(res.body.message).toBe("Route not found");
  });

  it("returns 400 for malformed JSON", async () => {
    const res = await api().post("/api/auth/login").set("Content-Type", "application/json").send("{bad json").expect(400);
    expect(res.body.message).toBe("Malformed JSON body");
  });
});
