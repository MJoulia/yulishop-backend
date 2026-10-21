import { z } from "zod";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id");
const intFromQuery = (def, min, max) => z.coerce.number().int().min(min).max(max).default(def);

export const registerSchema = z.object({
  firstName: z.string().trim().max(80).optional(),
  lastName: z.string().trim().max(80).optional(),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().max(40).optional(),
  address: z.string().trim().max(300).optional(),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(128),
});

export const perfumeListQuery = z.object({
  search: z.string().trim().max(100).optional(),
  brand: z.string().trim().max(80).optional(),
  family: z.string().trim().max(200).optional(),
  minPriceCents: z.coerce.number().int().min(0).optional(),
  maxPriceCents: z.coerce.number().int().min(0).optional(),
  sort: z.enum(["rating", "price_asc", "price_desc", "recent"]).default("rating"),
  limit: intFromQuery(20, 1, 100),
  offset: intFromQuery(0, 0, 100000),
});

const variantSchema = z.object({
  sku: z.string().trim().min(1).max(60),
  volumeMl: z.coerce.number().int().min(1).max(5000),
  priceCents: z.coerce.number().int().min(0).max(10_000_000),
  stock: z.coerce.number().int().min(0).max(1_000_000).default(0),
});

const strList = z.array(z.string().trim().max(60)).max(30);

export const perfumeSchema = z.object({
  slug: z.string().trim().max(80).optional(),
  name: z.string().trim().min(1).max(120),
  brand: z.string().trim().min(1).max(80),
  description: z.string().max(5000).optional(),
  olfactoryFamilies: strList.optional(),
  genderTarget: z.enum(["unisex", "femme", "homme", "autre"]).optional(),
  concentration: z.enum(["EDC", "EDT", "EDP", "Extrait", "Autre"]).optional(),
  topNotes: strList.optional(),
  heartNotes: strList.optional(),
  baseNotes: strList.optional(),
  images: z.array(z.string().max(3_000_000)).max(10).optional(),
  variants: z.array(variantSchema).max(20).optional(),
});

export const perfumeUpdateSchema = perfumeSchema.partial();

export const reviewListQuery = z.object({
  rating: z.coerce.number().int().min(1).max(5).optional(),
  sort: z.enum(["recent", "best"]).default("recent"),
  page: intFromQuery(1, 1, 10000),
  limit: intFromQuery(10, 1, 50),
});

export const reviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().trim().max(120).optional().default(""),
  comment: z.string().trim().min(3, "Comment must be at least 3 characters").max(2000),
});

export const reviewUpdateSchema = reviewSchema.partial().extend({
  status: z.enum(["visible", "hidden", "pending"]).optional(),
});

export const orderSchema = z.object({
  customer: z.object({
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().min(1).max(80),
    email: z.string().trim().email(),
    phone: z.string().trim().max(40).optional(),
    street: z.string().trim().min(1).max(200),
    city: z.string().trim().min(1).max(100),
    postalCode: z.string().trim().min(2).max(20),
    country: z.string().trim().min(2).max(60),
    notes: z.string().trim().max(500).optional(),
  }),
  // The cart stores either `quantity` or `qty`; prices sent by the client are ignored.
  items: z
    .array(
      z
        .object({
          productId: objectId,
          sku: z.string().trim().min(1).max(60),
          quantity: z.coerce.number().int().min(1).max(20).optional(),
          qty: z.coerce.number().int().min(1).max(20).optional(),
        })
        .transform(({ productId, sku, quantity, qty }) => ({ productId, sku, quantity: quantity ?? qty ?? 1 }))
    )
    .min(1, "Cart is empty")
    .max(50),
  shippingMethod: z.enum(["standard", "express"]).default("standard"),
});

export const orderStatusSchema = z.object({
  status: z.enum(["placed", "shipped", "delivered", "cancelled"]),
});

export const idParam = z.object({ id: objectId });
