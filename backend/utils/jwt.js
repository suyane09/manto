// Helper central pra pegar o segredo do JWT.
// Em produ��o, � OBRIGAT�RIO definir JWT_SECRET no .env - o servidor recusa
// subir com o valor padr�o pra evitar que qualquer pessoa forje tokens v�lidos.
const DEV_FALLBACK_SECRET = "dev-secret-nao-use-em-producao";

export function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret || secret === DEV_FALLBACK_SECRET) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "JWT_SECRET n�o configurado (ou usando valor padr�o) em produ��o. " +
          "Defina uma string aleat�ria longa em backend/.env antes de subir o servidor."
      );
    }
    return DEV_FALLBACK_SECRET;
  }

  return secret;
}
