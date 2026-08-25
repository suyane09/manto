import nodemailer from "nodemailer";

// Utilitário central de e-mail. Tenta, nesta ordem:
//
// 1. Resend via API HTTP (RESEND_API_KEY no .env)
//    -> envia via https://api.resend.com, que funciona mesmo em hosts que
//       bloqueiam portas SMTP de saída (25/465/587), como o Render free tier.
//       Este é o método RECOMENDADO em produção no Render.
//
// 2. SMTP configurado (SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS no .env)
//    -> envia de verdade via SMTP (Gmail, SendGrid, etc). Só funciona se o
//       host permitir conexões de saída nessas portas.
//
// 3. Nada configurado
//    -> não quebra a aplicação: só registra no console o que seria enviado.
//       Isso deixa o dev/local funcionando sem exigir credenciais, mas avisa
//       claramente que o e-mail real não está saindo.
//
// Erros de envio nunca devem derrubar a operação principal (criar pedido,
// confirmar pagamento, etc), então toda função aqui engole exceções e só loga.

let transporter = null;
let warnedNoConfig = false;

function getDefaultFrom() {
  return (
    process.env.SMTP_FROM ||
    process.env.RESEND_FROM ||
    process.env.SMTP_USER ||
    "loja@arsenaldomanto.com.br"
  );
}

async function sendViaResendApi({ to, subject, html, text, from }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html,
      text,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend API respondeu ${res.status}: ${body}`);
  }

  return true;
}

function getTransporter() {
  if (transporter) return transporter;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return transporter;
}

export async function sendMail({ to, subject, html, text }) {
  if (!to) return;

  const from = getDefaultFrom();

  // 1) Resend via API HTTP (preferido, funciona no Render)
  if (process.env.RESEND_API_KEY) {
    try {
      await sendViaResendApi({ to, subject, html, text, from });
      return;
    } catch (err) {
      console.error(`[mailer] Falha ao enviar e-mail via Resend API para ${to}:`, err.message);
      return;
    }
  }

  // 2) SMTP tradicional
  const t = getTransporter();
  if (t) {
    try {
      await t.sendMail({ from, to, subject, html, text });
    } catch (err) {
      console.error(`[mailer] Falha ao enviar e-mail via SMTP para ${to}:`, err.message);
    }
    return;
  }

  // 3) Nada configurado -> só simula
  if (!warnedNoConfig) {
    console.warn(
      "[mailer] Nenhum provedor de e-mail configurado (RESEND_API_KEY ou " +
        "SMTP_HOST/SMTP_USER/SMTP_PASS). E-mails serão apenas exibidos no console " +
        "em vez de enviados de verdade. Configure RESEND_API_KEY no backend/.env " +
        "(recomendado no Render, pois usa HTTPS e não é bloqueado) para ativar o envio real."
    );
    warnedNoConfig = true;
  }
  console.log(`[mailer] (simulado, nenhum provedor configurado) Para: ${to} | Assunto: ${subject}`);
}

export function getAdminEmail() {
  return process.env.ADMIN_NOTIFICATION_EMAIL || process.env.SMTP_USER || null;
}