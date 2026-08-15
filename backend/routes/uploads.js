import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { requireAuth } from "../middleware/auth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.join(__dirname, "..", "uploads");
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, unique);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB por imagem
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      return cb(new Error("Formato de imagem n�o suportado. Use JPG, PNG, WEBP ou GIF."));
    }
    cb(null, true);
  },
});

const router = Router();

// POST /api/uploads - envia uma imagem (protegido)
router.post("/", requireAuth, (req, res) => {
  upload.single("image")(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || "Falha ao enviar imagem." });
    }
    if (!req.file) {
      return res.status(400).json({ error: "Nenhuma imagem enviada." });
    }

    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const url = `${baseUrl}/uploads/${req.file.filename}`;
    res.status(201).json({ url });
  });
});

export default router;
