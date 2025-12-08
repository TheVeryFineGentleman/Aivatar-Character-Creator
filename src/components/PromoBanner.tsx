import { X } from "lucide-react";
import { useState } from "react";

interface PromoBannerProps {
  productId?: string;
}

const PromoBanner = ({ productId }: PromoBannerProps) => {
  const [isVisible, setIsVisible] = useState(true);

  // Only show for product ID 645699
  if (productId !== "645699" || !isVisible) {
    return null;
  }

  return (
    <div className="w-full bg-gradient-to-r from-red-600 to-red-500 text-white py-3 px-4 relative animate-fade-in">
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-center sm:text-left">
        <span className="font-bold text-sm sm:text-base whitespace-nowrap">
          🎁 Aivatar Academy Deal
        </span>
        <span className="text-xs sm:text-sm opacity-90">
          Bis 26.12.2025
        </span>
        <span className="text-xs sm:text-sm">
          Gib im Bestellformular den Rabattcode{" "}
          <span className="font-mono font-bold bg-white/20 px-2 py-0.5 rounded">
            avatarcreatorstudio-deal
          </span>{" "}
          ein.{" "}
          <span className="font-bold text-yellow-300">60% Rabatt</span>
        </span>
      </div>
      <button
        onClick={() => setIsVisible(false)}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-white/20 rounded transition-colors"
        aria-label="Banner schließen"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export default PromoBanner;
