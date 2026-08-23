import { Link } from "react-router-dom";
import { Home, Compass } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function NotFoundPage() {
  return (
    <Card glowing className="max-w-xl mx-auto text-center py-16">
      <Compass className="w-12 h-12 text-flare-400 mx-auto mb-4" />
      <div className="text-5xl font-semibold grad-text mb-2">404</div>
      <h1 className="text-lg font-semibold mb-2">Hier ist nichts zu sehen.</h1>
      <p className="text-ink-50/55 mb-6 max-w-sm mx-auto">Die Seite gibt's nicht (mehr). Vielleicht warst du im falschen Studio?</p>
      <Link to="/"><Button iconLeft={<Home className="w-4 h-4" />}>Zurück zur Startseite</Button></Link>
    </Card>
  );
}
