import jwt from "jsonwebtoken";
import { getJwtSecret } from "../utils/jwt.js";

function readToken(req) {
  const header = req.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7) : null;
}

// Uso em rotas que exigem cliente logado (ex: perfil, meus pedidos)
export function requireCustomerAuth(req, res, next) {
  const token = readToken(req);
  if (!token) {
    return res.status(401).json({ error: "Fa�a login para continuar." });
  }

  try {
    const payload = jwt.verify(token, getJwtSecret());
    if (payload.role !== "customer") {
      return res.status(403).json({ error: "Acesso n�o autorizado." });
    }
    req.customer = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Sess�o expirada. Fa�a login novamente." });
  }
}

// Uso em rotas p�blicas que aceitam tanto visitante quanto cliente logado
// (ex: checkout) - se vier um token v�lido de cliente, anexa req.customer;
// caso contr�rio, segue como convidado sem nunca falhar a requisi��o.
export function attachCustomerIfPresent(req, res, next) {
  const token = readToken(req);
  if (!token) return next();

  try {
    const payload = jwt.verify(token, getJwtSecret());
    if (payload.role === "customer") {
      req.customer = payload;
    }
  } catch (err) {
    // token ausente/expirado/inv�lido -> apenas segue como convidado
  }
  next();
}
