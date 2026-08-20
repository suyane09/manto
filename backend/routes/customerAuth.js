import crypto from "crypto";
import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { all, get, run, insertAndGetId } from "../db.js";
import { getJwtSecret } from "../utils/jwt.js";
import { requireCustomerAuth } from "../middleware/customerAuth.js";
import { sendMail } from "../utils/mailer.js";

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
const RESET_TOKEN_MINUTES = 60;

const router = Router();

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." },
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sanitizeCustomer(row) {
  if (!row) return null;
  const { password_hash, failed_attempts, locked_until, ...safe } = row;
  return safe;
}

function signCustomerToken(customer) {
  return jwt.sign({ id: customer.id, email: customer.email, role: "customer" }, getJwtSecret(), {
    expiresIn: "30d",
  });
}

function welcomeEmailHtml(customer) {
  const hasAddress = customer.street && customer.city;
  const rows = [
    ["Nome", customer.name],
    ["E-mail", customer.email],
    customer.phone ? ["Telefone", customer.phone] : null,
    hasAddress
      ? [
          "Endereço",
          `${customer.street}, ${customer.number || "s/n"}${
            customer.complement ? ` - ${customer.complement}` : ""
          } - ${customer.neighborhood || ""}, ${customer.city}/${customer.uf} - CEP ${customer.cep}`,
        ]
      : null,
  ].filter(Boolean);

  const rowsHtml = rows
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:10px 0; border-bottom:1px solid #23262c; font-size:13px; color:#9aa0ab; white-space:nowrap; vertical-align:top;">${label}</td>
          <td style="padding:10px 0 10px 16px; border-bottom:1px solid #23262c; font-size:14px; color:#f5f5f5;">${value}</td>
        </tr>`
    )
    .join("");

  return `
    <div style="background-color:#0d0f13; padding:32px 16px; font-family:Arial, Helvetica, sans-serif;">
      <div style="max-width:480px; margin:0 auto; background-color:#15171c; border-radius:12px; overflow:hidden; border:1px solid #23262c;">
        <div style="background-color:#0d0f13; padding:28px 24px; text-align:center; border-bottom:1px solid #23262c;">
          <span style="font-size:22px; font-weight:900; letter-spacing:1px; color:#a3ff1a; text-transform:uppercase;">Arsenal do Manto</span>
        </div>
        <div style="padding:28px 24px;">
          <h2 style="margin:0 0 12px; font-size:18px; color:#ffffff;">Bem-vindo, ${customer.name}!</h2>
          <p style="margin:0 0 20px; font-size:14px; line-height:1.6; color:#c7c9cf;">
            Sua conta foi criada com sucesso. Aqui está um resumo dos seus dados cadastrados:
          </p>
          <table style="width:100%; border-collapse:collapse;">
            ${rowsHtml}
          </table>
          <p style="margin:20px 0 0; font-size:13px; line-height:1.6; color:#9aa0ab;">
            Se algum dado estiver errado, você pode corrigi-lo a qualquer momento na área "Minha Conta".
          </p>
          <p style="margin:12px 0 0; font-size:13px; line-height:1.6; color:#9aa0ab;">
            Se você não fez esse cadastro, entre em contato com a gente respondendo este e-mail.
          </p>
        </div>
        <div style="padding:16px 24px; text-align:center; border-top:1px solid #23262c;">
          <p style="margin:0; font-size:11px; color:#5c6068;">Arsenal do Manto Sport's Club</p>
        </div>
      </div>
    </div>
  `;
}
// POST /api/customer-auth/register
router.post("/register", authLimiter, async (req, res) => {
  const {
    name,
    email,
    phone,
    password,
    cep,
    street,
    number,
    complement,
    neighborhood,
    city,
    uf,
  } = req.body || {};

  if (!name || !email || !password) {
    return res.status(400).json({ error: "Nome, e-mail e senha s�o obrigat�rios." });
  }
  if (!EMAIL_RE.test(String(email).trim())) {
    return res.status(400).json({ error: "Informe um e-mail v�lido." });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ error: "A senha precisa ter pelo menos 6 caracteres." });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const existing = await get("SELECT id FROM customers WHERE email = ?", [normalizedEmail]);
  if (existing) {
    return res.status(409).json({ error: "Já existe uma conta com esse e-mail." });
  }

  const hash = bcrypt.hashSync(password, 10);
  const id = await insertAndGetId(
    `INSERT INTO customers (name, email, phone, password_hash, cep, street, number, complement, neighborhood, city, uf)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      String(name).trim(),
      normalizedEmail,
      phone ? String(phone).trim() : null,
      hash,
      cep ? String(cep).trim() : null,
      street ? String(street).trim() : null,
      number ? String(number).trim() : null,
      complement ? String(complement).trim() : null,
      neighborhood ? String(neighborhood).trim() : null,
      city ? String(city).trim() : null,
      uf ? String(uf).trim() : null,
    ]
  );

  const customer = await get("SELECT * FROM customers WHERE id = ?", [id]);
  const token = signCustomerToken(customer);

  sendMail({
    to: customer.email,
    subject: "Bem-vindo ao Arsenal do Manto!",
    html: welcomeEmailHtml(customer),
  });

  res.status(201).json({ token, customer: sanitizeCustomer(customer) });
});

// POST /api/customer-auth/login
router.post("/login", authLimiter, async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "E-mail e senha s�o obrigat�rios." });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const customer = await get("SELECT * FROM customers WHERE email = ?", [normalizedEmail]);
  if (!customer) {
    return res.status(401).json({ error: "E-mail ou senha inválidos." });
  }

  if (customer.locked_until && new Date(customer.locked_until) > new Date()) {
    return res.status(423).json({
      error: "Conta temporariamente bloqueada por excesso de tentativas. Tente novamente mais tarde.",
    });
  }

  const valid = bcrypt.compareSync(password, customer.password_hash);
  if (!valid) {
    const attempts = (customer.failed_attempts || 0) + 1;
    if (attempts >= MAX_ATTEMPTS) {
      const lockedUntil = new Date(Date.now() + LOCK_MINUTES * 60 * 1000).toISOString();
      await run("UPDATE customers SET failed_attempts = 0, locked_until = ? WHERE id = ?", [lockedUntil, customer.id]);
      return res.status(423).json({
        error: `Muitas tentativas incorretas. Conta bloqueada por ${LOCK_MINUTES} minutos.`,
      });
    }
    await run("UPDATE customers SET failed_attempts = ? WHERE id = ?", [attempts, customer.id]);
    return res.status(401).json({ error: "E-mail ou senha inv�lidos." });
  }

  await run("UPDATE customers SET failed_attempts = 0, locked_until = NULL WHERE id = ?", [customer.id]);

  const token = signCustomerToken(customer);
  res.json({ token, customer: sanitizeCustomer(customer) });
});

// POST /api/customer-auth/forgot-password
// Sempre responde com sucesso gen�rico, pra n�o revelar se um e-mail existe
// ou n�o na base (evita enumera��o de contas).
router.post("/forgot-password", authLimiter, async (req, res) => {
  const { email } = req.body || {};
  const generic = {
    ok: true,
    message: "Se existir uma conta com esse e-mail, enviamos um link de redefini��o de senha.",
  };

  if (!email || !EMAIL_RE.test(String(email).trim())) {
    return res.json(generic);
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const customer = await get("SELECT * FROM customers WHERE email = ?", [normalizedEmail]);
  if (!customer) return res.json(generic);

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + RESET_TOKEN_MINUTES * 60 * 1000).toISOString();

  await run(`INSERT INTO password_resets (customer_id, token_hash, expires_at) VALUES (?, ?, ?)`, [
    customer.id,
    tokenHash,
    expiresAt,
  ]);

  const resetLink = `${FRONTEND_URL}/redefinir-senha?token=${rawToken}`;
  sendMail({
    to: customer.email,
    subject: "Redefinição de senha - Arsenal do Manto",
    html: `
      <div style="background-color:#0d0f13; padding:32px 16px; font-family:Arial, Helvetica, sans-serif;">
        <div style="max-width:480px; margin:0 auto; background-color:#15171c; border-radius:12px; overflow:hidden; border:1px solid #23262c;">
          <div style="background-color:#0d0f13; padding:28px 24px; text-align:center; border-bottom:1px solid #23262c;">
            <span style="font-size:22px; font-weight:900; letter-spacing:1px; color:#a3ff1a; text-transform:uppercase;">Arsenal do Manto</span>
          </div>
          <div style="padding:28px 24px;">
            <h2 style="margin:0 0 12px; font-size:18px; color:#ffffff;">Redefinição de senha</h2>
            <p style="margin:0 0 20px; font-size:14px; line-height:1.6; color:#c7c9cf;">
              Recebemos um pedido para redefinir a senha da sua conta.
            </p>
            <div style="text-align:center; margin:24px 0;">
              <a href="${resetLink}" style="display:inline-block; background-color:#a3ff1a; color:#0d0f13; font-weight:700; font-size:14px; text-decoration:none; padding:12px 28px; border-radius:8px;">
                Criar nova senha
              </a>
            </div>
            <p style="margin:0 0 8px; font-size:12px; line-height:1.6; color:#9aa0ab;">
              O link expira em ${RESET_TOKEN_MINUTES} minutos.
            </p>
            <p style="margin:0; font-size:12px; line-height:1.6; color:#9aa0ab;">
              Se você não pediu isso, pode ignorar este e-mail.
            </p>
          </div>
          <div style="padding:16px 24px; text-align:center; border-top:1px solid #23262c;">
            <p style="margin:0; font-size:11px; color:#5c6068;">Arsenal do Manto Sport's Club</p>
          </div>
        </div>
      </div>
    `,
  });

  res.json(generic);
});

// POST /api/customer-auth/reset-password
router.post("/reset-password", authLimiter, async (req, res) => {
  const { token, newPassword } = req.body || {};
  if (!token || !newPassword) {
    return res.status(400).json({ error: "Token e nova senha s�o obrigat�rios." });
  }
  if (String(newPassword).length < 6) {
    return res.status(400).json({ error: "A nova senha precisa ter pelo menos 6 caracteres." });
  }

  const tokenHash = crypto.createHash("sha256").update(String(token)).digest("hex");
  const reset = await get(
    `SELECT * FROM password_resets WHERE token_hash = ? AND used = 0 ORDER BY id DESC LIMIT 1`,
    [tokenHash]
  );

  if (!reset || new Date(reset.expires_at) < new Date()) {
    return res.status(400).json({ error: "Link de redefini��o inv�lido ou expirado. Pe�a um novo." });
  }

  const hash = bcrypt.hashSync(newPassword, 10);
  await run("UPDATE customers SET password_hash = ?, failed_attempts = 0, locked_until = NULL, updated_at = datetime('now') WHERE id = ?", [
    hash,
    reset.customer_id,
  ]);
  await run("UPDATE password_resets SET used = 1 WHERE id = ?", [reset.id]);

  res.json({ ok: true, message: "Senha redefinida com sucesso. Voc� j� pode entrar com a nova senha." });
});

// GET /api/customer-auth/me
router.get("/me", requireCustomerAuth, async (req, res) => {
  const customer = await get("SELECT * FROM customers WHERE id = ?", [req.customer.id]);
  if (!customer) return res.status(404).json({ error: "Conta n�o encontrada." });
  res.json(sanitizeCustomer(customer));
});

// PUT /api/customer-auth/me - atualiza perfil e endere�o padr�o
router.put("/me", requireCustomerAuth, async (req, res) => {
  const existing = await get("SELECT * FROM customers WHERE id = ?", [req.customer.id]);
  if (!existing) return res.status(404).json({ error: "Conta n�o encontrada." });

  const {
    name = existing.name,
    phone = existing.phone,
    cep = existing.cep,
    street = existing.street,
    number = existing.number,
    complement = existing.complement,
    neighborhood = existing.neighborhood,
    city = existing.city,
    uf = existing.uf,
  } = req.body || {};

  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: "Nome � obrigat�rio." });
  }

  await run(
    `UPDATE customers SET name=?, phone=?, cep=?, street=?, number=?, complement=?, neighborhood=?, city=?, uf=?, updated_at=datetime('now')
     WHERE id=?`,
    [String(name).trim(), phone, cep, street, number, complement, neighborhood, city, uf, req.customer.id]
  );

  const updated = await get("SELECT * FROM customers WHERE id = ?", [req.customer.id]);
  res.json(sanitizeCustomer(updated));
});

// POST /api/customer-auth/change-password
router.post("/change-password", requireCustomerAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "Informe a senha atual e a nova senha." });
  }
  if (String(newPassword).length < 6) {
    return res.status(400).json({ error: "A nova senha precisa ter pelo menos 6 caracteres." });
  }

  const customer = await get("SELECT * FROM customers WHERE id = ?", [req.customer.id]);
  if (!customer) return res.status(404).json({ error: "Conta n�o encontrada." });

  const valid = bcrypt.compareSync(currentPassword, customer.password_hash);
  if (!valid) {
    return res.status(401).json({ error: "Senha atual incorreta." });
  }

  const hash = bcrypt.hashSync(newPassword, 10);
  await run("UPDATE customers SET password_hash = ?, updated_at = datetime('now') WHERE id = ?", [hash, customer.id]);

  sendMail({
    to: customer.email,
    subject: "Sua senha foi alterada - Arsenal do Manto",
    html: `
      <h2>Senha alterada</h2>
      <p>Ol�, ${customer.name}. Sua senha de acesso ao Arsenal do Manto foi alterada com sucesso agora h� pouco.</p>
      <p>Se foi voc� quem fez isso, n�o precisa fazer nada.</p>
      <p>Se voc� <strong>n�o</strong> reconhece essa altera��o, entre em contato com a gente imediatamente respondendo este e-mail.</p>
    `,
  });

  res.json({ ok: true });
});

// GET /api/customer-auth/orders - hist�rico de pedidos do cliente logado
router.get("/orders", requireCustomerAuth, async (req, res) => {
  const orders = await all("SELECT * FROM orders WHERE customer_id = ? ORDER BY created_at DESC", [req.customer.id]);
  const withItems = await Promise.all(
    orders.map(async (o) => ({
      ...o,
      items: await all("SELECT * FROM order_items WHERE order_id = ?", [o.id]),
    }))
  );
  res.json(withItems);
});

export default router;
