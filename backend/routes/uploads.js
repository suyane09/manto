import { Router } from "express";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { requireAuth } from "../middleware/auth.js";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

// O mimetype que o navegador manda no upload é só um "rótulo" escolhido pelo
// cliente - dá pra falsificar (ex: renomear um .html malicioso pra .jpg e
// mandar mimetype "image/jpeg"). Por isso, além do fileFilter abaixo, também
// conferimos a assinatura real dos primeiros bytes do arquivo (magic bytes),
// que é o próprio formato do arquivo se auto-identificando e não pode ser
// alterada só trocando a extensão/mimetype declarados.
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

let cloudinaryConfigured = false;
function ensureCloudinaryConfigured() {
  // Configura só na primeira chamada (não no import), pra dar tempo do
  // dotenv já ter carregado o .env quando este código rodar.
  if (cloudinaryConfigured) return;
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    throw new Error(
      "Cloudinary não configurado. Defina CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY " +
        "e CLOUDINARY_API_SECRET em backend/.env (veja o painel da sua conta Cloudinary)."
    );
  }
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true,
  });
  cloudinaryConfigured = true;
}

// Guarda o arquivo em memória (não em disco) - só o suficiente pra validar
// os magic bytes e repassar pro Cloudinary, sem depender do disco local do
// servidor, que em muitas hospedagens (Render, Railway free tier etc.) é
// apagado a cada novo deploy.
const upload = multer({
  storage: multer.memoryStorage(),
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

function uploadBufferToCloudinary(buffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "arsenal-do-manto", resource_type: "image" },
      (err, result) => {
        if (err) return reject(err);
        resolve(result);
      }
    );
    stream.end(buffer);
  });
}

const router = Router();

// POST /api/uploads - envia uma imagem (protegido)
router.post("/", requireAuth, (req, res) => {
  upload.single("image")(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || "Falha ao enviar imagem." });
    }
    if (!req.file) {
      return res.status(400).json({ error: "Nenhuma imagem enviada." });
    }

    // Segunda barreira, a que realmente importa: confere a assinatura dos
    // bytes do arquivo recebido. Se não bater com nenhum dos formatos de
    // imagem aceitos, recusa antes de sequer tentar enviar pro Cloudinary -
    // assim um arquivo malicioso disfarçado de imagem nunca chega a ser
    // hospedado publicamente.
    const realType = detectRealImageType(req.file.buffer);
    if (!realType) {
      return res.status(400).json({
        error: "O conteúdo do arquivo não corresponde a uma imagem válida (JPG, PNG, WEBP ou GIF).",
      });
    }

    try {
      ensureCloudinaryConfigured();
      const result = await uploadBufferToCloudinary(req.file.buffer);
      res.status(201).json({ url: result.secure_url });
    } catch (uploadErr) {
      console.error(uploadErr);
      res.status(502).json({ error: "Falha ao enviar a imagem para o armazenamento externo." });
    }
  });
});

export default router;