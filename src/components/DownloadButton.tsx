import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download } from "lucide-react";
import { cn } from "@/lib/utils";

interface DownloadButtonProps {
  imageUrl: string;
  fileName: string;
  variant?: "gallery" | "lightbox";
  className?: string;
}

const RESOLUTION_OPTIONS = [
  { label: "500px", maxWidth: 500 },
  { label: "1K", maxWidth: 1024 },
  { label: "2K", maxWidth: 2048 },
  { label: "4K (Original)", maxWidth: 0 }, // 0 = no resize
];

const resizeImage = (src: string, maxWidth: number): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (maxWidth === 0 || img.naturalWidth <= maxWidth) {
        resolve(src);
        return;
      }
      const scale = maxWidth / img.naturalWidth;
      const canvas = document.createElement("canvas");
      canvas.width = maxWidth;
      canvas.height = Math.round(img.naturalHeight * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Canvas not supported")); return; }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = src;
  });
};

export const DownloadButton: React.FC<DownloadButtonProps> = ({
  imageUrl,
  fileName,
  variant = "gallery",
  className,
}) => {
  const [isResizing, setIsResizing] = useState(false);

  const handleDownload = async (maxWidth: number) => {
    setIsResizing(true);
    try {
      const finalUrl = maxWidth === 0 ? imageUrl : await resizeImage(imageUrl, maxWidth);
      const link = document.createElement("a");
      link.href = finalUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Download resize failed:", err);
      // Fallback: download original
      const link = document.createElement("a");
      link.href = imageUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      setIsResizing(false);
    }
  };

  const isLightbox = variant === "lightbox";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={isLightbox ? "ghost" : "secondary"}
          size="icon"
          className={cn(
            "rounded-full",
            isLightbox && "h-10 w-10 bg-white/10 hover:bg-white/20 text-white",
            className
          )}
          disabled={isResizing}
          onClick={(e) => e.stopPropagation()}
        >
          <Download className="w-5 h-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        side={isLightbox ? "top" : "bottom"}
        className="min-w-[140px]"
        onClick={(e) => e.stopPropagation()}
      >
        {RESOLUTION_OPTIONS.map((opt) => (
          <DropdownMenuItem
            key={opt.label}
            onClick={(e) => {
              e.stopPropagation();
              handleDownload(opt.maxWidth);
            }}
          >
            <Download className="w-4 h-4 mr-2" />
            {opt.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
