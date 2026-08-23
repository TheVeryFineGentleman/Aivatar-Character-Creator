import promoImg from "@/assets/aivatar-academy-promo.jpg";

export function AivatarAcademyPromo() {
  return (
    <div className="w-full mt-12 mb-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="relative overflow-hidden rounded-3xl border border-flare-400/30 bg-gradient-to-br from-ink-800/80 via-ink-800/60 to-flare-500/10 shadow-soft">
          <div className="relative flex flex-col items-center p-6 md:p-8">
            <div className="relative w-full max-w-lg overflow-hidden rounded-2xl">
              <div className="absolute inset-0 bg-gradient-to-t from-ink-950/60 via-transparent to-transparent z-10" />
              <img
                src={promoImg}
                alt="Aivatar Academy"
                className="w-full h-56 object-cover"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
