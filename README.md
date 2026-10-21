# YuliShop API

[![CI](https://github.com/MJoulia/yulishop-backend/actions/workflows/ci.yml/badge.svg)](https://github.com/MJoulia/yulishop-backend/actions/workflows/ci.yml)

REST API for **YuliShop**, a perfume web shop. The React front end lives in [MJoulia/YuliShop](https://github.com/MJoulia/YuliShop).

**Stack:** Node.js 22 · Express · MongoDB/Mongoose · JWT · zod · Vitest + Supertest + mongodb-memory-server · OpenAPI/Swagger · Docker · GitHub Actions

## Features

- **Catalogue:** search (full-text on name, brand and notes), filters, sorting, pagination
- **Accounts:** register and login with bcrypt-hashed passwords, JWT, `user`/`admin` roles, rate-limited auth
- **Reviews:** one per user and perfume, live rating average, "verified purchase" badge, moderation by admins
- **Orders:** the server computes all prices and shipping, and stock is reserved **atomically** so concurrent orders can't oversell
- **Admin:** manage perfumes, images and orders; cancelling an order puts the items back in stock
- **API docs:** interactive Swagger UI at `/api/docs`, spec at `/api/openapi.json`

## Quality and security

| Risk | How it is handled |
|---|---|
| Price tampering | Client prices are ignored; totals are recalculated from the database |
| Overselling | Conditional `$inc` update per variant, with rollback if any line fails |
| Broken access control | Every write route requires a JWT; admin routes check the role; users only see their own orders and reviews |
| NoSQL injection | Every input is validated with zod; `{"$ne": null}` payloads are rejected with `400` |
| Brute force | Login and register are limited to 20 requests per 15 minutes per IP |
| User enumeration | Same `401` response and timing for an unknown email and a wrong password |
| Secrets | Configuration comes only from env vars; the app refuses to start in production without `JWT_SECRET` |
| Card data | Payment is simulated; card numbers never reach the server |

## Tests

63 automated API tests run against a real in-memory MongoDB. They cover positive and negative cases, boundary values (the free-shipping threshold), role checks, concurrency (three buyers racing for the last items) and security cases.

```bash
npm test               # run once
npm run test:coverage  # with coverage report in coverage/
```

## Run locally

```bash
cp .env.example .env    # set JWT_SECRET
npm install
npm run seed            # demo perfumes (+ admin if SEED_ADMIN_* is set)
npm run dev             # http://localhost:5124, docs at /api/docs
```

Or with Docker (API + MongoDB):

```bash
JWT_SECRET=$(openssl rand -hex 32) docker compose up --build
```

## Project structure

```
server.js            start-up, DB connection, graceful shutdown
src/app.js           Express app (exported for tests)
src/config.js        env-based configuration
src/validation.js    zod request schemas
src/middlewares/     auth (JWT, roles), error handling and validation
src/models/          User, Perfume, Review, Order
src/routes/          public, user and admin routes
tests/               Vitest + Supertest API tests
openapi.yaml         API specification
```

## License

MIT
