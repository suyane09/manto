import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "path";
import { fileURLToPath } from "url";
import { initDb } from "./db.js";
import { getJwtSecret } from "./utils/jwt.js";

import authRoutes from "./routes/auth.js";
import customerAuthRoutes from "./routes/customerAuth.js";
import productsRoutes from "./routes/products.js";
import ordersRoutes from "./routes/orders.js";
import dashboardRoutes from "./routes/dashboard.js";
import uploadsRoutes from "./routes/uploads.js";
import shippingRoutes from "./routes/shipping.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Monta o app Express (rotas, middlewares) sem subir o servidor nem o banco.
// Separado do bootstrap em `start()` pra que os testes automatizados possam
// montar o mesmo app contra um banco de teste isolado, sem duplicar a
// configura��o de CORS/helmet/rate-limit.
export function createApp() {
  const app = express();

  const allowedOrigins = (process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  app.set("trust proxy", 1);

  app.use(
    helmet({
      // API pura (sem HTML renderizado aqui), ent�o a CSP padr�o do helmet
      // n�o se aplica e pode ser desligada sem risco.
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
    })
  );

  app.use(
    cors({
      origin(origin, callback) {
        // requisi��es sem "origin" (ex: apps mobile, curl, o pr�prio Mercado Pago no webhook)
        if (!origin) return callback(null, true);
        if (allowedOrigins.length === 0) return callback(null, true); // dev sem config
        if (allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error("Origem n�o autorizada pelo CORS."));
      },
    })
  );

  app.use(express.json({ limit: "1mb" }));

  // Limite geral de requisi��es por IP, contra abuso/for�a bruta em qualquer rota.
  // Desligado em teste pra n�o interferir em su�tes que fazem v�rias chamadas seguidas.
  if (process.env.NODE_ENV !== "test") {
    const globalLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 300,
      standardHeaders: true,
      legacyHeaders: false,
    });
    app.use("/api", globalLimiter);
  }

  app.use("/uploads", express.static(path.join(__dirname, "uploads")));

  app.use("/api/auth", authRoutes);
  app.use("/api/customer-auth", customerAuthRoutes);
  app.use("/api/products", productsRoutes);
  app.use("/api/orders", ordersRoutes);
  app.use("/api/dashboard", dashboardRoutes);
  app.use("/api/uploads", uploadsRoutes);
  app.use("/api/shipping", shippingRoutes);

  app.get("/api/health", (req, res) => res.json({ ok: true }));

  // Nunca vaza detalhes internos de erro pro cliente.
  app.use((err, req, res, next) => {
    if (err && err.message === "Origem n�o autorizada pelo CORS.") {
      return res.status(403).json({ error: "Origem n�o autorizada." });
    }
    console.error(err);
    res.status(500).json({ error: "Erro interno do servidor." });
  });

  return app;
}

async function start() {
  // Falha r�pido se o JWT_SECRET n�o estiver configurado corretamente em
  // produ��o, em vez de subir o servidor com um segredo previs�vel.
  getJwtSecret();

  const PORT = process.env.PORT || 3001;
  const app = createApp();

  await initDb();
  app.listen(PORT, () => {
    console.log(`Arsenal backend rodando em http://localhost:${PORT}`);
  });
}

// S� sobe o servidor de verdade quando este arquivo � executado diretamente
// (node server.js) - assim os testes podem importar createApp() sem abrir
// uma porta nem exigir JWT_SECRET de produ��o.
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  start().catch((err) => {
    console.error("Falha ao iniciar o banco de dados:", err);
    process.exit(1);
  });
}

