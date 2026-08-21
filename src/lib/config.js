export const STORE_NAME = "Arsenal do Manto";

// Logo used in the navbar and footer
export const LOGO_URL = "/logo-square.png";

// WhatsApp number in international format (no + or spaces), used for order requests
export const WHATSAPP_NUMBER = "5582996270952";

export const INSTAGRAM_URL = "https://www.instagram.com/arsenaldomanto?igsh=c3ZlM21rZnl3OQ==";

export function formatBRL(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}