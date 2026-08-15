import jwt from "jsonwebtoken";
import { getJwtSecret } from "../utils/jwt.js";

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Token n�o fornecido." });
  }

  try {
    const payload = jwt.verify(token, getJwtSecret());

    // Defesa em profundidade: um token de cliente nunca pode ser usado
    // para acessar rotas administrativas, mesmo que o segredo seja o mesmo.
    if (payload.role !== "admin") {
      return res.status(403).json({ error: "Acesso n�o autorizado." });
    }

    req.admin = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Token inv�lido ou expirado." });
  }
}
