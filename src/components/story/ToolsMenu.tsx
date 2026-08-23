import { Wrench, Image as ImageIcon, Video as VideoIcon, RefreshCw, Layers } from "lucide-react";
import { Menu, MenuItem, MenuDivider, MenuSection } from "@/components/ui/Menu";

/**
 * Alle Reparatur- und Wiederhol-Aktionen an EINEM Ort.
 *
 * Vorher lagen fünf gleich große Knöpfe nebeneinander über dem Storyboard —
 * darunter „Alle Bilder neu" (verwirft fertige Videos) und „Verwerfen"
 * (löscht alles), gleichberechtigt neben dem harmlosen „Fehlende Bilder".
 * Die teure Aktion sah aus wie die billige.
 *
 * Bewusst KEIN eigener Zustand: alle Handler kommen von außen, damit dieses
 * Menü an zwei Stellen (Bau-Bereich und über den Szenen) identisch erscheinen
 * kann, ohne dass etwas auseinanderläuft.
 */
export function ToolsMenu({
  onAllImages, onMissingImages, onAllVideos, onRewriteStory,
  hasScenes, imagesComplete, canRenderVideos, videoPlan, batchRunning,
}: {
  onAllImages: () => void;
  onMissingImages: () => void;
  onAllVideos: () => void;
  onRewriteStory: () => void;
  hasScenes: boolean;
  imagesComplete: boolean;
  canRenderVideos: boolean;
  videoPlan: boolean;
  batchRunning: boolean;
}) {
  return (
    <Menu
      align="right"
      trigger={
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 bg-ink-900/60 text-xs font-medium text-ink-50/80 hover:border-flare-400/30 hover:text-ink-50 transition-colors">
          <Wrench className="w-3.5 h-3.5" />
          Werkzeuge
        </span>
      }
    >
      <MenuSection label="Bilder">
        <MenuItem
          icon={<ImageIcon className="w-4 h-4" />}
          onClick={onMissingImages}
          disabled={!hasScenes || batchRunning || imagesComplete}
        >
          Fehlende Bilder nachziehen
        </MenuItem>
        <MenuItem
          icon={<RefreshCw className="w-4 h-4" />}
          onClick={onAllImages}
          disabled={!hasScenes || batchRunning}
          danger
        >
          Alle Bilder neu erzeugen
        </MenuItem>
      </MenuSection>

      {videoPlan && (
        <MenuSection label="Clips">
          <MenuItem
            icon={<VideoIcon className="w-4 h-4" />}
            onClick={onAllVideos}
            disabled={!canRenderVideos || batchRunning}
          >
            Clips erzeugen
          </MenuItem>
        </MenuSection>
      )}

      <MenuDivider />
      <MenuSection label="Storyboard">
        <MenuItem
          icon={<Layers className="w-4 h-4" />}
          onClick={onRewriteStory}
          disabled={batchRunning}
        >
          Storyboard neu schreiben
        </MenuItem>
        {/* „Storyboard verwerfen" stand hier — es ist jetzt der rote Knopf direkt
            rechts neben „Generieren" in Schritt 6. Dort gehört er hin: er ist der
            Gegenknopf zum Generieren und nicht eines von mehreren Werkzeugen.
            Bewusst nur EINE Stelle, damit die teuerste Aktion der Seite nicht an
            zwei Orten mit zwei Beschriftungen steht. */}
      </MenuSection>
    </Menu>
  );
}
