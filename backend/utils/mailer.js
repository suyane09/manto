import nodemailer from "nodemailer";

// Utilit�rio central de e-mail. Funciona de duas formas:
//
// 1. SMTP configurado (SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS no .env)
//    -> envia de verdade (funciona com Gmail SMTP, Resend, SendGrid, etc,
//       qualquer provedor que fale SMTP).
// 2. Nada configurado
//    -> n�o quebra a aplica��o: s� registra no console o que seria enviado.
//       Isso deixa o dev/local funcionando sem exigir credenciais, mas avisa
//       claramente que o e-mail real n�o est� saindo.
//
// Erros de envio nunca devem derrubar a opera��o principal (criar pedido,
// confirmar pagamento, etc), ent�o toda fun��o aqui engole exce��es e s� loga.

let transporter = null;
let warnedNoConfig = false;

function getTransporter() {
  if (transporter) return transporter;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    if (!warnedNoConfig) {
      console.warn(
        "[mailer] SMTP n�o configurado (SMTP_HOST/SMTP_USER/SMTP_PASS). " +
          "E-mails ser�o apenas exibidos no console em vez de enviados de verdade. " +
          "Configure essas vari�veis no backend/.env para ativar o envio real " +
          "(funciona com Gmail SMTP, Resend, SendGrid, etc)."
      );
      warnedNoConfig = true;
    }
    return null;
  }

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

  const from = process.env.SMTP_FROM || process.env.SMTP_USER || "loja@arsenaldomanto.com.br";
  const t = getTransporter();

  if (!t) {
    console.log(`[mailer] (simulado, SMTP n�o configurado) Para: ${to} | Assunto: ${subject}`);
    return;
  }

  try {
    await t.sendMail({ from, to, subject, html, text });
  } catch (err) {
    console.error(`[mailer] Falha ao enviar e-mail para ${to}:`, err.message);
  }
}

export function getAdminEmail() {
  return process.env.ADMIN_NOTIFICATION_EMAIL || process.env.SMTP_USER || null;
}
