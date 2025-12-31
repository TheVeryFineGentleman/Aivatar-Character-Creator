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
        
        {/* Floating particles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* Circle particles */}
          <div className="absolute w-3 h-3 bg-white/20 rounded-full animate-[float1_8s_ease-in-out_infinite]" style={{ left: '5%', top: '20%' }} />
          <div className="absolute w-2 h-2 bg-yellow-300/30 rounded-full animate-[float2_6s_ease-in-out_infinite]" style={{ left: '15%', top: '60%' }} />
          <div className="absolute w-4 h-4 bg-white/15 rounded-full animate-[float3_10s_ease-in-out_infinite]" style={{ left: '25%', top: '30%' }} />
          <div className="absolute w-2 h-2 bg-orange-200/25 rounded-full animate-[float1_7s_ease-in-out_infinite]" style={{ left: '35%', top: '70%' }} />
          <div className="absolute w-3 h-3 bg-white/20 rounded-full animate-[float2_9s_ease-in-out_infinite]" style={{ left: '55%', top: '25%' }} />
          <div className="absolute w-2 h-2 bg-yellow-200/30 rounded-full animate-[float3_5s_ease-in-out_infinite]" style={{ left: '65%', top: '65%' }} />
          <div className="absolute w-4 h-4 bg-white/10 rounded-full animate-[float1_11s_ease-in-out_infinite]" style={{ left: '75%', top: '40%' }} />
          <div className="absolute w-2 h-2 bg-white/25 rounded-full animate-[float2_8s_ease-in-out_infinite]" style={{ left: '85%', top: '55%' }} />
          <div className="absolute w-3 h-3 bg-orange-100/20 rounded-full animate-[float3_7s_ease-in-out_infinite]" style={{ left: '92%', top: '20%' }} />
          
          {/* Star shapes */}
          <div className="absolute text-yellow-300/40 animate-[float2_6s_ease-in-out_infinite] text-lg" style={{ left: '10%', top: '40%' }}>✦</div>
          <div className="absolute text-white/30 animate-[float1_8s_ease-in-out_infinite] text-sm" style={{ left: '45%', top: '50%' }}>✦</div>
          <div className="absolute text-yellow-200/35 animate-[float3_7s_ease-in-out_infinite] text-base" style={{ left: '80%', top: '30%' }}>✦</div>
        </div>
        
        <div className="relative py-4 px-6">
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-5 text-center">
            {/* Deal badge */}
            <a 
              href="https://www.digistore24.com/product/644591?voucher=avatarcreatorstudio-deal"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-white/15 backdrop-blur-sm px-4 py-1.5 rounded-full border border-white/20 hover:bg-white/25 hover:scale-105 transition-all duration-200 cursor-pointer"
            >
              <Gift className="w-4 h-4 text-yellow-300" />
              <span className="font-bold text-sm text-white tracking-wide">
                EXKLUSIV-DEAL
              </span>
            </a>
            
            {/* Pro badge */}
            <div className="flex items-center gap-1.5 text-white/90">
              <span className="text-sm font-medium">
                Avatar Creator Studio „PRO"
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
            <a 
              href="https://www.digistore24.com/product/644591?voucher=avatarcreatorstudio-deal"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-yellow-400 text-black font-black text-sm sm:text-base px-4 py-1 rounded-full shadow-lg hover:bg-yellow-300 hover:scale-105 transition-all duration-200 cursor-pointer"
            >
              60% RABATT
            </a>
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
