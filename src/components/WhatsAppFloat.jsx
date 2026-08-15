import React from "react";
import { MessageCircle } from "lucide-react";
import { WHATSAPP_NUMBER } from "@/lib/config";

export default function WhatsAppFloat() {
  const href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
    "Olá Arsenal do Manto! Gostaria de mais informações."
  )}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label="Fale conosco no WhatsApp"
      className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-neon text-black shadow-lg shadow-neon/30 transition-transform hover:scale-110"
    >
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-neon opacity-30" />
      <MessageCircle className="relative h-7 w-7" />
    </a>
  );
}