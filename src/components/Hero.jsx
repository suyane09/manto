import React, { useState } from "react";
import { Zap, PencilRuler, ArrowRight } from "lucide-react";

const HERO_PRONTA = "https://i.pinimg.com/1200x/ef/6a/f3/ef6af34771847685ccd3db2688dcdd7f.jpg";
const HERO_ENCOMENDA = "https://otempo.scene7.com/is/image/sempreeditora/futebol%20internacional-camisas%20copa%202026-copa_2026-adidas-1762364496?qlt=90&ts=1762364586341&dpr=off";

function Panel({ side, active, setActive, badge, title, desc, cta, img }) {
  const isActive = active === side;
  const isOther = active && active !== side;
  return (
    <div
      onMouseEnter={() => setActive(side)}
      className={`group relative min-h-[280px] flex-1 cursor-pointer overflow-hidden transition-all duration-500 sm:min-h-0 ${
        isActive ? "flex-[1.6]" : isOther ? "flex-[0.5]" : ""
      }`}
    >
      <div
        className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
        style={{ backgroundImage: `url(${img})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/50" />
      <div className="relative flex h-full flex-col justify-end p-6 sm:p-10">
        <span
          className={`mb-3 inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wide ${
            side === "pronta"
              ? "bg-neon text-black"
              : "bg-white/15 text-white backdrop-blur"
          }`}
        >
          {side === "pronta" ? <Zap className="h-3 w-3" /> : <PencilRuler className="h-3 w-3" />}
          {badge}
        </span>
        <h2 className="font-heading text-2xl uppercase tracking-wide leading-none text-white sm:text-4xl">
          {title}
        </h2>
        <p className="mt-2 max-w-sm text-sm text-white/70">{desc}</p>
        <a
          href="#produtos"
          className="mt-4 inline-flex w-fit items-center gap-2 text-sm font-bold uppercase tracking-wide text-neon transition-transform hover:translate-x-1"
        >
          {cta} <ArrowRight className="h-4 w-4" />
        </a>
      </div>
    </div>
  );
}

export default function Hero() {
  const [active, setActive] = useState(null);

  return (
    <section id="top" className="relative h-[82vh] min-h-[560px] w-full overflow-hidden bg-background">
      <div className="flex h-full w-full flex-col md:flex-row">
        <Panel
          side="pronta"
          active={active}
          setActive={setActive}
          img={HERO_PRONTA}
          badge="Pronta Entrega"
          title="Vista o Manto Agora"
          desc="Mantos e chuteiras em estoque, despachados em 24h. A paixão não espera."
          cta="Ver disponíveis"
        />
        <div className="h-px w-full bg-border md:h-auto md:w-px" />
        <Panel
          side="encomenda"
          active={active}
          setActive={setActive}
          img={HERO_ENCOMENDA}
          badge="Sob Encomenda"
          title="Crie seu Manto"
          desc="Personalize com nome e número. Produção sob medida, exclusiva para você."
          cta="Personalizar"
        />
      </div>
    </section>
  );
}