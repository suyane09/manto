import React from "react";
import { Instagram, MessageCircle, MapPin } from "lucide-react";
import { WHATSAPP_NUMBER, STORE_NAME, INSTAGRAM_URL, LOGO_URL } from "@/lib/config";

export default function Footer() {
  return (
    <footer className="border-t border-border bg-background py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid gap-10 md:grid-cols-3">
          <div>
            <div className="flex items-center gap-3">
              <img
                src={LOGO_URL}
                alt="Arsenal do Manto"
                width="44"
                height="44"
                decoding="async"
                className="h-11 w-11 rounded-full object-cover ring-2 ring-neon"
              />
              <div className="leading-none">
                <p className="font-heading text-sm uppercase tracking-wider text-white">
                  {STORE_NAME}
                </p>
                <p className="text-[10px] uppercase tracking-[0.3em] text-neon">
                  Sport's Club
                </p>
              </div>
            </div>
            <p className="mt-4 max-w-xs text-sm text-muted-foreground">
              Mantos e chuteiras a pronta entrega e sob encomenda. Vista sua
              paixão com orgulho.
            </p>
          </div>

          <div>
            <h4 className="font-heading text-sm uppercase tracking-wider text-white">
              Navegação
            </h4>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              <li><a href="#produtos" className="hover:text-neon">Produtos</a></li>
              <li><a href="#produtos" className="hover:text-neon">Pronta Entrega</a></li>
              <li><a href="#produtos" className="hover:text-neon">Sob Encomenda</a></li>
              <li><a href="#sobre" className="hover:text-neon">Sobre</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-heading text-sm uppercase tracking-wider text-white">
              Contato
            </h4>
            <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
              <li>
                <a
                  href={`https://wa.me/${WHATSAPP_NUMBER}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 hover:text-neon"
                >
                  <MessageCircle className="h-4 w-4 text-neon" /> WhatsApp
                </a>
              </li>
              <li>
                <a
                  href={INSTAGRAM_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 hover:text-neon"
                >
                  <Instagram className="h-4 w-4 text-neon" /> Instagram
                </a>
              </li>
              <li className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-neon" /> Arapiraca — envio nacional
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-border pt-6 text-center text-xs uppercase tracking-wider text-muted-foreground">
          © {new Date().getFullYear()} {STORE_NAME}. Todos os direitos
          reservados.
        </div>
      </div>
    </footer>
  );
}