import { X, Sparkles, Gift, Timer } from "lucide-react";
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
    <div className="w-full relative overflow-hidden animate-fade-in mb-4">
      {/* Animated background */}
      <div className="absolute inset-0 bg-gradient-to-r from-red-600 via-rose-500 to-orange-500 animate-pulse" />
      <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.1)_50%,transparent_75%)] bg-[length:250%_250%] animate-[shimmer_3s_linear_infinite]" />
      
      {/* Sparkle effects */}
      <div className="absolute top-1 left-[10%] text-yellow-300 animate-bounce opacity-80">
        <Sparkles className="w-4 h-4" />
      </div>
      <div className="absolute bottom-1 left-[30%] text-yellow-200 animate-bounce opacity-60" style={{ animationDelay: '0.5s' }}>
        <Sparkles className="w-3 h-3" />
      </div>
      <div className="absolute top-2 right-[20%] text-yellow-300 animate-bounce opacity-70" style={{ animationDelay: '1s' }}>
        <Sparkles className="w-3 h-3" />
      </div>
      
      <div className="relative py-3 px-4">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-center">
          {/* Deal badge */}
          <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full border border-white/30 shadow-lg">
            <Gift className="w-4 h-4 text-yellow-300 animate-pulse" />
            <span className="font-black text-sm sm:text-base text-white tracking-wide">
              EXKLUSIV-DEAL
            </span>
          </div>
          
          {/* Timer badge */}
          <div className="flex items-center gap-1.5 text-white/90">
            <Timer className="w-4 h-4" />
            <span className="text-xs sm:text-sm font-medium">
              Bis 26.12.2025
            </span>
          </div>
          
          {/* Code section */}
          <div className="flex flex-wrap items-center justify-center gap-2 text-white">
            <span className="text-xs sm:text-sm">
              Code:
            </span>
            <span className="font-mono font-black text-sm sm:text-base bg-black/30 backdrop-blur-sm px-3 py-1 rounded-lg border-2 border-dashed border-yellow-400/60 text-yellow-300 shadow-[0_0_15px_rgba(253,224,71,0.3)] hover:shadow-[0_0_25px_rgba(253,224,71,0.5)] transition-shadow cursor-pointer select-all">
              avatarcreatorstudio-deal
            </span>
          </div>
          
          {/* Discount badge */}
          <div className="relative">
            <div className="absolute inset-0 bg-yellow-400 blur-md opacity-50 rounded-full animate-pulse" />
            <span className="relative font-black text-lg sm:text-xl bg-gradient-to-r from-yellow-300 to-amber-400 text-transparent bg-clip-text drop-shadow-lg px-2">
              60% RABATT
            </span>
          </div>
        </div>
        
        <button
          onClick={() => setIsVisible(false)}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-white/20 rounded-full transition-all hover:rotate-90 duration-300"
          aria-label="Banner schließen"
        >
          <X className="w-4 h-4 text-white/80 hover:text-white" />
        </button>
      </div>
    </div>
  );
};

export default PromoBanner;
