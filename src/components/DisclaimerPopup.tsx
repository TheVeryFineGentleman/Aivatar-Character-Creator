import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle } from "lucide-react";

const DISCLAIMER_STORAGE_KEY = "disclaimer_accepted";

export const DisclaimerPopup = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    const disclaimerAccepted = localStorage.getItem(DISCLAIMER_STORAGE_KEY);
    if (!disclaimerAccepted) {
      setIsOpen(true);
    }
  }, []);

  const handleAccept = () => {
    if (dontShowAgain) {
      localStorage.setItem(DISCLAIMER_STORAGE_KEY, "true");
    }
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Wichtiger Hinweis
          </DialogTitle>
          <DialogDescription className="text-base pt-2">
            Verwende ausschließlich Bilder, deren Nutzung dir rechtlich erlaubt ist. Für alle generierten Inhalte trägt der Nutzer selbst die volle Verantwortung.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center space-x-2 py-4">
          <Checkbox
            id="dont-show"
            checked={dontShowAgain}
            onCheckedChange={(checked) => setDontShowAgain(checked === true)}
          />
          <label
            htmlFor="dont-show"
            className="text-sm text-muted-foreground cursor-pointer select-none"
          >
            Nicht mehr anzeigen
          </label>
        </div>
        <DialogFooter>
          <Button onClick={handleAccept} className="w-full">
            Verstanden
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
