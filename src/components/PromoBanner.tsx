import { X, Gift, Timer } from "lucide-react";
import { useState } from "react";

interface PromoBannerProps {
  planCode?: string;
}

const PromoBanner = ({ planCode }: PromoBannerProps) => {
  const [isVisible, setIsVisible] = useState(true);

  // Show for Basic users
  if (planCode !== "BASIC" || !isVisible) {
    return null;
  }

  return (
    <div className="w-full px-4 mb-4 animate-fade-in">
      <div className="relative overflow-hidden rounded-2xl shadow-xl">
        {/* Smooth gradient background */}
        <div className="absolute inset-0 bg-gradient-to-r from-red-600 via-rose-500 to-orange-500" />
        <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent" />
        
        <div className="relative py-4 px-6">
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-5 text-center">
            {/* Deal badge */}
            <div className="flex items-center gap-2 bg-white/15 backdrop-blur-sm px-4 py-1.5 rounded-full border border-white/20">
              <Gift className="w-4 h-4 text-yellow-300" />
              <span className="font-bold text-sm text-white tracking-wide">
                EXKLUSIV-DEAL
              </span>
            </div>
            
            {/* Timer badge */}
            <div className="flex items-center gap-1.5 text-white/90">
              <Timer className="w-4 h-4" />
              <span className="text-sm font-medium">
                Bis 26.12.2025
              </span>
            </div>
            
            {/* Code section */}
            <div className="flex flex-wrap items-center justify-center gap-2 text-white">
              <span className="text-sm">
                Code:
              </span>
              <span className="font-mono font-bold text-sm bg-black/25 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-yellow-400/40 text-yellow-300 hover:bg-black/35 transition-colors cursor-pointer select-all">
                avatarcreatorstudio-deal
              </span>
            </div>
            
            {/* Discount badge */}
            <div className="bg-yellow-400 text-black font-black text-sm sm:text-base px-4 py-1 rounded-full shadow-lg">
              60% RABATT
            </div>
          </div>
          
          <button
            onClick={() => setIsVisible(false)}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 hover:bg-white/20 rounded-full transition-all duration-200"
            aria-label="Banner schließen"
          >
            <X className="w-4 h-4 text-white/70 hover:text-white" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default PromoBanner;
