import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { get, run } from "../db.js";
import { getJwtSecret } from "../utils/jwt.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

// Limita tentativas de login por IP, al�m do bloqueio por conta abaixo.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." },
});

router.post("/login", loginLimiter, async (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ error: "Usuario e senha são obrigatorios." });
  }

  const admin = await get("SELECT * FROM admins WHERE username = ?", [username]);
  if (!admin) {
    return res.status(401).json({ error: "Usuario ou senha invalidos." });
  }

  if (admin.locked_until && new Date(admin.locked_until) > new Date()) {
    return res.status(423).json({
      error: `Conta temporariamente bloqueada por excesso de tentativas. Tente novamente mais tarde.`,
    });
  }

  const valid = bcrypt.compareSync(password, admin.password_hash);
  if (!valid) {
    const attempts = (admin.failed_attempts || 0) + 1;
    if (attempts >= MAX_ATTEMPTS) {
      const lockedUntil = new Date(Date.now() + LOCK_MINUTES * 60 * 1000).toISOString();
      await run("UPDATE admins SET failed_attempts = 0, locked_until = ? WHERE id = ?", [lockedUntil, admin.id]);
      return res.status(423).json({
        error: `Muitas tentativas incorretas. Conta bloqueada por ${LOCK_MINUTES} minutos.`,
      });
    }
    await run("UPDATE admins SET failed_attempts = ? WHERE id = ?", [attempts, admin.id]);
    return res.status(401).json({ error: "Usuario ou senha invalidos." });
  }

  await run("UPDATE admins SET failed_attempts = 0, locked_until = NULL WHERE id = ?", [admin.id]);

  const token = jwt.sign(
    { id: admin.id, username: admin.username, role: "admin" },
    getJwtSecret(),
    { expiresIn: "12h" }
  );

  res.json({ token, username: admin.username });
});

router.get("/me", requireAuth, (req, res) => {
  res.json({ ok: true, username: req.admin.username });
});

export default router;
