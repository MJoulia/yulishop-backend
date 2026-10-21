import request from "supertest";
import bcrypt from "bcryptjs";
import { createApp } from "../src/app.js";
import User from "../src/models/User.js";
import Perfume from "../src/models/Perfume.js";
import { signToken } from "../src/middlewares/auth.js";
import { demoPerfumes } from "../scripts/seed.js";

export const app = createApp();
export const api = () => request(app);

export async function createUser(overrides = {}) {
  const user = await User.create({
    email: `user${Math.random().toString(36).slice(2, 8)}@test.dev`,
    firstName: "Test",
    lastName: "User",
    passwordHash: await bcrypt.hash("Passw0rd!", 4),
    role: "user",
    ...overrides,
  });
  return { user, token: signToken(user), auth: { Authorization: `Bearer ${signToken(user)}` } };
}

export const createAdmin = () => createUser({ role: "admin", firstName: "Admin" });

export async function seedPerfumes() {
  const docs = [];
  for (const p of demoPerfumes) docs.push(await Perfume.create(structuredClone(p)));
  return docs;
}

export const validCustomer = {
  firstName: "Joulia",
  lastName: "Mazid",
  email: "buyer@test.dev",
  street: "Teststraße 1",
  city: "Berlin",
  postalCode: "10115",
  country: "Germany",
};
