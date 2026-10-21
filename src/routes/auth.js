import express from "express";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import { signToken, requireAuth } from "../middlewares/auth.js";
import { asyncHandler, validate } from "../middlewares/error.js";
import { registerSchema, loginSchema } from "../validation.js";

const router = express.Router();

// Pre-computed hash so login takes the same time whether or not the email exists.
const DUMMY_HASH = bcrypt.hashSync("timing-attack-dummy", 10);

// POST /api/auth/register
router.post(
  "/register",
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const { password, ...profile } = req.body;
    if (await User.exists({ email: profile.email })) {
      return res.status(409).json({ message: "Email already registered" });
    }
    const user = await User.create({ ...profile, passwordHash: await bcrypt.hash(password, 12), role: "user" });
    res.status(201).json({ token: signToken(user), user: user.toPublic() });
  })
);

// POST /api/auth/login
router.post(
  "/login",
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select("+passwordHash");
    const ok = await bcrypt.compare(password, user?.passwordHash || DUMMY_HASH);
    if (!user || !ok || user.isActive === false) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    res.json({ token: signToken(user), user: user.toPublic() });
  })
);

// GET /api/auth/me
router.get("/me", requireAuth, (req, res) => res.json({ user: req.user.toPublic() }));

export default router;
