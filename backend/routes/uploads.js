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

// O mimetype que o navegador manda no upload é só um "rótulo" escolhido pelo
// cliente - dá pra falsificar (ex: renomear um .html malicioso pra .jpg e
// mandar mimetype "image/jpeg"). Por isso, além do fileFilter abaixo, também
// conferimos a assinatura real dos primeiros bytes do arquivo salvo (magic
// bytes), que é o próprio formato do arquivo se auto-identificando e não
// pode ser alterada só trocando a extensão/mimetype declarados.
const MAGIC_BYTES = [
  { type: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { type: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { type: "image/gif", bytes: [0x47, 0x49, 0x46, 0x38] }, // "GIF8"
  // WEBP: bytes 0-3 "RIFF", bytes 8-11 "WEBP" (checado à parte abaixo)
];

function detectRealImageType(buffer) {
  for (const { type, bytes } of MAGIC_BYTES) {
    if (buffer.length >= bytes.length && bytes.every((b, i) => buffer[i] === b)) {
      return type;
    }
  }
  const isRiff = buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF";
  const isWebp = isRiff && buffer.toString("ascii", 8, 12) === "WEBP";
  if (isWebp) return "image/webp";
  return null;
}

function verifyMagicBytes(filePath) {
  // Basta ler os primeiros 12 bytes - suficiente pra identificar qualquer um
  // dos formatos aceitos, sem precisar carregar o arquivo inteiro em memória.
  const fd = fs.openSync(filePath, "r");
  const header = Buffer.alloc(12);
  fs.readSync(fd, header, 0, 12, 0);
  fs.closeSync(fd);
  return detectRealImageType(header);
}

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
    // Primeira barreira: descarta de cara mimetypes fora da lista. Barata,
    // mas insuficiente sozinha porque o cliente escolhe esse valor.
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      return cb(new Error("Formato de imagem não suportado. Use JPG, PNG, WEBP ou GIF."));
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

    // Segunda barreira, a que realmente importa: confere a assinatura dos
    // bytes do arquivo que já está em disco. Se não bater com nenhum dos
    // formatos de imagem aceitos, apaga o arquivo e recusa - assim um
    // arquivo malicioso disfarçado de imagem nunca fica publicamente
    // acessível em /uploads.
    const realType = verifyMagicBytes(req.file.path);
    if (!realType) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({
        error: "O conteúdo do arquivo não corresponde a uma imagem válida (JPG, PNG, WEBP ou GIF).",
      });
    }

    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const url = `${baseUrl}/uploads/${req.file.filename}`;
    res.status(201).json({ url });
  });
});

export default router;