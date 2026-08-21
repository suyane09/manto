import React from "react";
import { Zap, PencilRuler, ShieldCheck, Truck } from "lucide-react";

const features = [
  {
    icon: Zap,
    title: "Pronta Entrega",
    desc: "Mantos e chuteiras em estoque, prontos para despachar em 24h.",
  },
  {
    icon: PencilRuler,
    title: "Sob Encomenda",
    desc: "Personalize com nome e número. Produção sob medida.",
  },
  {
    icon: ShieldCheck,
    title: "Qualidade Garantida",
    desc: "Tecidos e acabamento premium em cada Manto.",
  },
  {
    icon: Truck,
    title: "Envio para todo Brasil",
    desc: "Entregamos onde o jogo acontecer.",
  },
];

export default function AboutSection() {
  return (
    <section id="sobre" className="relative overflow-hidden border-y border-border bg-card/40 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <h2 className="mt-2 font-heading text-3xl uppercase tracking-wide text-white sm:text-5xl">
              Mais que uma camisa.
              <br />
              Um Manto.
            </h2>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-muted-foreground">
              O Arsenal do Manto nasceu da paixão pelo futebol e pelo manto que
              vestimos em campo. Reunimos camisas e chuteiras de alta qualidade,
              a pronta entrega ou sob encomenda, para que você vista sua paixão
              com orgulho — dentro e fora das quatro linhas.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {features.map((f) => (
              <div
                key={f.title}
                className="rounded-xl border border-border bg-background p-5 transition-colors hover:border-neon/50"
              >
                <f.icon className="h-7 w-7 text-neon" />
                <h3 className="mt-3 font-heading text-sm uppercase tracking-wide text-white">
                  {f.title}
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}