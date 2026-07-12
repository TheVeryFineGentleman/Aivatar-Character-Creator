import { ArrowRight } from "lucide-react";
import promoImg from "@/assets/aivatar-academy-promo.jpg";

export function AivatarAcademyPromo() {
  return (
    <div className="w-full mt-12 mb-8 px-4">
      <a
        href="https://aivataracademy.com"
        target="_blank"
        rel="noopener noreferrer"
        className="block max-w-3xl mx-auto group cursor-pointer"
      >
        <div className="relative overflow-hidden rounded-3xl border border-flare-400/30 bg-gradient-to-br from-ink-800/80 via-ink-800/60 to-flare-500/10 shadow-soft transition-all duration-500 hover:shadow-glow hover:scale-[1.02] hover:border-flare-400/50">
          <div className="absolute inset-0 bg-gradient-to-r from-flare-500/0 via-flare-500/10 to-flare-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

          <div className="relative flex flex-col items-center gap-6 p-6 md:p-8">
            <div className="relative w-full max-w-lg overflow-hidden rounded-2xl">
              <div className="absolute inset-0 bg-gradient-to-t from-ink-950/60 via-transparent to-transparent z-10" />
              <img
                src={promoImg}
                alt="Aivatar Academy"
                className="w-full h-56 object-cover transform group-hover:scale-105 transition-transform duration-700"
              />
            </div>

            <div className="text-center space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-flare-500/20 rounded-full text-xs font-semibold text-flare-300 uppercase tracking-wide">
                <span className="w-2 h-2 bg-flare-400 rounded-full animate-pulse" />
                Aivatar Academy
              </div>
              <h3 className="text-xl md:text-2xl font-semibold tracking-tight text-ink-50 group-hover:text-flare-300 transition-colors duration-300">
                Willst du deinen Avatar richtig groß rausbringen?
              </h3>
              <p className="text-sm text-ink-50/65 leading-relaxed max-w-md mx-auto">
                Mehr Reichweite, mehr Style, mehr Möglichkeiten – entdecke unser exklusives Webinar und hebe dein KI-Game aufs nächste Level.
              </p>
              <div className="inline-flex items-center gap-2 text-flare-300 font-bold pt-2 group-hover:gap-3 transition-all duration-300">
                Jetzt entdecken
                <ArrowRight className="w-5 h-5 transform group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </div>
        </div>
      </a>
    </div>
  );
}
