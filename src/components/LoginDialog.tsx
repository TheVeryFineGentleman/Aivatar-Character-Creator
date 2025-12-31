import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { AnimatedTitle } from "@/components/AnimatedTitle";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

interface LoginDialogProps {
  onLogin: (email: string, licenseKey: string) => Promise<{ success: boolean; message?: string }>;
}

export const LoginDialog = ({ onLogin }: LoginDialogProps) => {
  const [email, setEmail] = useState("");
  const [licenseKey, setLicenseKey] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showRemindDialog, setShowRemindDialog] = useState(false);
  const [remindEmail, setRemindEmail] = useState("");
  const [isReminding, setIsReminding] = useState(false);
  const [remindMessage, setRemindMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const { toast } = useToast();

  const handleRemindSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!remindEmail) {
      setRemindMessage({ type: 'error', text: 'Bitte geben Sie Ihre E-Mail-Adresse ein.' });
      return;
    }

    setIsReminding(true);
    setRemindMessage(null);

    try {
      const { data, error } = await supabase.functions.invoke('license-remind', {
        body: { email: remindEmail }
      });

      if (error) throw error;

      if (data.sent) {
        setRemindMessage({ type: 'success', text: 'Ihr Lizenzschlüssel wurde an Ihre E-Mail-Adresse gesendet.' });
      } else {
        let errorText = 'Ein Fehler ist aufgetreten.';
        switch (data.reason) {
          case 'USER_NOT_FOUND':
            errorText = 'Kein Benutzer mit dieser E-Mail-Adresse gefunden.';
            break;
          case 'ACTIVE_LICENSE_NOT_FOUND':
            errorText = 'Keine aktive Lizenz für diese E-Mail-Adresse gefunden.';
            break;
          case 'INVALID_TOOL_API_KEY':
            errorText = 'Technischer Fehler. Bitte kontaktieren Sie den Support.';
            break;
          default:
            errorText = data.reason || 'Ein unbekannter Fehler ist aufgetreten.';
        }
        setRemindMessage({ type: 'error', text: errorText });
      }
    } catch (error) {
      console.error('Error reminding license:', error);
      setRemindMessage({ type: 'error', text: 'Verbindungsfehler. Bitte versuchen Sie es erneut.' });
    } finally {
      setIsReminding(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !licenseKey) {
      toast({
        title: "Fehler",
        description: "Bitte füllen Sie alle Felder aus.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    const result = await onLogin(email, licenseKey);
    setIsLoading(false);

    if (result.success) {
      toast({
        title: "Erfolgreich angemeldet",
        description: "Willkommen zurück!",
      });
    } else {
      toast({
        title: "Anmeldung fehlgeschlagen",
        description: result.message || "Bitte überprüfen Sie Ihre Zugangsdaten.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <AnimatedTitle text="AvatarCreatorStudio" className="text-3xl font-bold text-primary mb-2 block" />
          <CardTitle>Anmelden</CardTitle>
          <CardDescription>
            Bitte geben Sie Ihre E-Mail und Ihren License Key ein, um fortzufahren.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-Mail</Label>
              <Input
                id="email"
                type="text"
                placeholder="ihre@email.de"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="licenseKey">License Key</Label>
              <Input
                id="licenseKey"
                type="text"
                placeholder="Ihr License Key"
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Wird überprüft...
                </>
              ) : (
                "Anmelden"
              )}
            </Button>
            <div className="text-center pt-2">
              <button 
                type="button"
                onClick={() => {
                  setShowRemindDialog(true);
                  setRemindMessage(null);
                  setRemindEmail(email);
                }}
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                Lizenzschlüssel vergessen?
              </button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Dialog open={showRemindDialog} onOpenChange={setShowRemindDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Lizenzschlüssel anfordern</DialogTitle>
            <DialogDescription>
              Geben Sie Ihre E-Mail-Adresse ein, um Ihren Lizenzschlüssel zu erhalten.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRemindSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="remindEmail">E-Mail</Label>
              <Input
                id="remindEmail"
                type="email"
                placeholder="ihre@email.de"
                value={remindEmail}
                onChange={(e) => setRemindEmail(e.target.value)}
                disabled={isReminding}
              />
            </div>
            {remindMessage && (
              <p className={`text-sm ${remindMessage.type === 'success' ? 'text-green-500' : 'text-red-500'}`}>
                {remindMessage.text}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={isReminding}>
              {isReminding ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Wird gesendet...
                </>
              ) : (
                "Lizenzschlüssel senden"
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
