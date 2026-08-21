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
// configuração de CORS/helmet/rate-limit.
export function createApp() {
  const app = express();

  const allowedOrigins = (process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  app.set("trust proxy", 1);

  app.use(
    helmet({
      // API pura (sem HTML renderizado aqui), então a CSP padrão do helmet
      // não se aplica e pode ser desligada sem risco.
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
      // Manda o navegador sempre usar HTTPS neste domínio pelo próximo ano,
      // mesmo que alguém digite ou clique num link "http://" por engano -
      // fecha a brecha de um atacante interceptar a primeira requisição em
      // texto puro antes do redirecionamento acontecer.
      hsts: { maxAge: 31536000, includeSubDomains: true },
    })
  );

  // Redireciona qualquer requisição em HTTP puro pra HTTPS. Só entra em ação
  // em produção - em dev local (http://localhost) isso quebraria o fluxo.
  // Depende de "trust proxy" acima pra enxergar o protocolo original quando
  // o servidor está atrás de um proxy/load balancer (Render, Railway etc.).
  //
  // Ignora localhost/127.0.0.1 mesmo com NODE_ENV=production: é comum testar
  // localmente com essa variável setada (pra checar as travas de produção),
  // e como não existe certificado HTTPS rodando na própria máquina, redirecionar
  // localhost pra https:// só quebraria os testes sem nenhum ganho de segurança.
  if (process.env.NODE_ENV === "production") {
    app.use((req, res, next) => {
      const host = (req.headers.host || "").split(":")[0];
      const isLocalhost = host === "localhost" || host === "127.0.0.1";
      if (isLocalhost || req.secure || req.headers["x-forwarded-proto"] === "https") {
        return next();
      }
      return res.redirect(301, `https://${req.headers.host}${req.originalUrl}`);
    });
  }

  app.use(
    cors({
      origin(origin, callback) {
        // requisições sem "origin" (ex: apps mobile, curl, o próprio Mercado Pago no webhook)
        if (!origin) return callback(null, true);
        if (allowedOrigins.length === 0) return callback(null, true); // dev sem config
        if (allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error("Origem não autorizada pelo CORS."));
      },
    })
  );

  app.use(express.json({ limit: "1mb" }));

  // Limite geral de requisições por IP, contra abuso/força bruta em qualquer rota.
  // Desligado em teste pra não interferir em suítes que fazem várias chamadas seguidas.
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
    if (err && err.message === "Origem não autorizada pelo CORS.") {
      return res.status(403).json({ error: "Origem não autorizada." });
    }
    console.error(err);
    res.status(500).json({ error: "Erro interno do servidor." });
  });

  return app;
}

async function start() {
  // Em produção, exige ALLOWED_ORIGINS (ou FRONTEND_URL) configurado. Sem essa
  // variável, o CORS acima cai no modo "dev sem config" e libera QUALQUER site
  // pra chamar a API - ou seja, qualquer página na internet poderia fazer
  // requisições autenticadas pro backend usando o navegador de um cliente
  // logado. Isso não pode acontecer silenciosamente em produção.
  if (
    process.env.NODE_ENV === "production" &&
    !(process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL)
  ) {
    throw new Error(
      "ALLOWED_ORIGINS (ou FRONTEND_URL) não configurado em produção. Defina a " +
        "URL do site em backend/.env (ex: ALLOWED_ORIGINS=https://seudominio.com.br) " +
        "antes de subir o servidor - sem isso, o CORS libera qualquer origem."
    );
  }

  // Em produção, exige DATABASE_URL configurado. Sem essa checagem, se a
  // variável faltar por engano no deploy, o backend não quebra - ele volta
  // sozinho a usar o SQLite local (db.js escolhe o modo com base nela), o
  // que faria a loja rodar em produção com um banco de arquivo temporário,
  // sem o cliente perceber, e sem backup/replicação adequados.
  if (process.env.NODE_ENV === "production" && !process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL não configurado em produção. Defina a connection string do " +
        "Postgres em backend/.env antes de subir o servidor - sem isso, o sistema " +
        "cairia para SQLite local por engano."
    );
  }

  // Falha rápido se o JWT_SECRET não estiver configurado corretamente em
  // produção, em vez de subir o servidor com um segredo previsível.
  getJwtSecret();

  const PORT = process.env.PORT || 3001;
  const app = createApp();

  await initDb();
  app.listen(PORT, () => {
    console.log(`Arsenal backend rodando em http://localhost:${PORT}`);
  });
}

// Só sobe o servidor de verdade quando este arquivo é executado diretamente
// (node server.js) - assim os testes podem importar createApp() sem abrir
// uma porta nem exigir JWT_SECRET de produção.
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  start().catch((err) => {
    console.error("Falha ao iniciar o banco de dados:", err);
    process.exit(1);
  });
}