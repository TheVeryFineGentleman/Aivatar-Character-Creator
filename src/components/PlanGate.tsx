import { Link } from "react-router-dom";
import { Lock, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { meetsTier, PLANS, type PlanTier } from "@/lib/plans";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

export function PlanGate({ requires, children, feature }: { requires: PlanTier; feature: string; children: React.ReactNode }) {
  const { license, plan, credentials } = useAuth();
  const tier = license?.tier ?? "basic";

  if (!credentials) {
    return (
      <Card glowing className="text-center max-w-xl mx-auto py-12">
        <Lock className="w-10 h-10 text-flare-400 mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">Bitte anmelden</h2>
        <p className="text-ink-50/55 mb-6">
          {feature} ist nach Login verfügbar. Du brauchst nur deinen Lizenzschlüssel.
        </p>
      </Card>
    );
  }

  if (!meetsTier(tier, requires)) {
    const requiredLabel = PLANS[requires].label;
    return (
      <Card glowing className="text-center max-w-xl mx-auto py-12">
        <Badge tone="accent" className="mb-4">
          <Sparkles className="w-3 h-3" /> {requiredLabel}-Feature
        </Badge>
        <h2 className="text-xl font-semibold mb-2">{feature} ist ab {requiredLabel} enthalten</h2>
        <p className="text-ink-50/55 mb-6">
          Du nutzt aktuell <span className="text-ink-50">{plan.label}</span>. Upgrade dauert keine Minute und schaltet sofort frei.
        </p>
        <Link to="/pricing"><Button>Pläne anzeigen</Button></Link>
      </Card>
    );
  }

  return <>{children}</>;
}
