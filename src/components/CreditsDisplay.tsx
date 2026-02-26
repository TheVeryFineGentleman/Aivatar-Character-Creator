import { Loader2, Coins } from "lucide-react";

interface CreditsDisplayProps {
  balance: number | null;
  isLoading: boolean;
  error: string | null;
}

export const CreditsDisplay = ({ balance, isLoading, error }: CreditsDisplayProps) => {
  if (isLoading) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono select-none">
        <Loader2 className="w-3 h-3 animate-spin" />
        <span>Credits...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-destructive font-mono select-none" title={error}>
        <Coins className="w-3 h-3" />
        <span>–</span>
      </div>
    );
  }

  if (balance === null) return null;

  return (
    <div className="flex items-center gap-1.5 text-xs font-mono select-none">
      <Coins className="w-3.5 h-3.5 text-primary" />
      <span className={`font-semibold ${balance <= 5 ? 'text-destructive' : 'text-foreground'}`}>
        {balance}
      </span>
      <span className="text-muted-foreground">Credits</span>
    </div>
  );
};
